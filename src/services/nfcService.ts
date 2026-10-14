import nfcManager, { NfcEvents, NfcTech } from 'react-native-nfc-manager';
// @ts-ignore internal module, no bundled types
import { callNative } from 'react-native-nfc-manager/src/NativeNfcManager';
import { CardLostError } from '../error/cardLostError';
import { FailedToReadCardError } from '../error/failedToReadCardError';
import { MissingNecessaryKeysError } from '../error/missingNecessaryKeysError';
import { Card, TpassInfo } from '../types';

const MIFARE_BLOCK_SIZE = 16;
const MAX_READ_RETRIES = 10;

// Android Tag.getTechList() fully-qualified class names, as surfaced in the
// DiscoverTag event's `techTypes`.
const TECH_ISO_DEP = 'android.nfc.tech.IsoDep';
const TECH_MIFARE_CLASSIC = 'android.nfc.tech.MifareClassic';

// NfcAdapter reader-mode flags: NFC_A (0x1) + SKIP_NDEF_CHECK (0x80) +
// NO_PLATFORM_SOUNDS (0x100), summed as they are disjoint bits. Only consulted
// when reader mode is enabled; the scanner uses foreground dispatch, so these
// are passed but ignored.
const READER_MODE_FLAGS = 0x1 + 0x80 + 0x100;

// 原生回報卡已離開（TAG_LOST，含已打補丁的 connect／transceive）或連線已不存在。
// 這種情況同一次感應內重試不會好，只能請使用者重刷。
function isTagLostError(error: unknown): boolean {
    const message = String((error as Error)?.message ?? error);
    return (
        message.includes('TAG_LOST') ||
        message.includes('no tech request available')
    );
}

const CONNECT_ATTEMPTS = 2;

// connect 失敗不一定是卡離開（SmartMX 偶爾會暫時連不上），先多試一次再下結論。
async function connectTech(tech: NfcTech) {
    for (let attempt = 1; ; attempt++) {
        try {
            await nfcManager.close();
        } catch (error) {}
        try {
            await nfcManager.connect([tech]);
            return;
        } catch (error) {
            if (!isTagLostError(error)) {
                throw error;
            }
            if (attempt >= CONNECT_ATTEMPTS) {
                throw new CardLostError();
            }
        }
    }
}

export function initializeNfc() {
    return nfcManager.start();
}

export async function cancelScanning() {
    try {
        await nfcManager.cancelTechnologyRequest();
    } catch (error) {}
}

export async function requestMifareClassic<T>(
    handler: (uid: string) => Promise<T>,
    onReady?: () => void,
): Promise<T> {
    await cancelScanning();

    try {
        onReady?.();
        await nfcManager.requestTechnology(NfcTech.MifareClassic);

        const tag = await nfcManager.getTag();
        const uid = tag!.id!;

        let retryCount = 0;
        while (retryCount < MAX_READ_RETRIES) {
            try {
                return await handler(uid);
            } catch (error) {
                if (error instanceof FailedToReadCardError) {
                    retryCount += 1;
                    continue;
                }

                throw error;
            }
        }

        throw new FailedToReadCardError();
    } finally {
        await cancelScanning();
    }
}

export interface CardSession {
    uid: string;
    techTypes: string[];
    hasIsoDep: boolean;
    hasMifareClassic: boolean;
    /** Connects the IsoDep (ISO14443-4) tech so `transceive` can send APDUs. */
    connectIsoDep: () => Promise<void>;
    /**
     * Switches to MIFARE Classic on the SAME tapped card (closes IsoDep first if
     * it was connected). Verified safe on dual-interface cards: the tag survives
     * the IsoDep→MifareClassic switch within one tap.
     */
    connectMifareClassic: () => Promise<void>;
    /** Raw APDU transceive; only valid after `connectIsoDep`. */
    transceive: (apdu: number[]) => Promise<number[]>;
}

export interface CardScanHandle {
    /** Stops scanning and releases the tag / NFC field. Idempotent. */
    stop: () => Promise<void>;
}

export interface CardScanHandlers<T> {
    onReady?: () => void;
    onReading?: () => void;
    onResult: (result: T) => void;
    onError: (error: unknown) => void;
}

/**
 * Starts CONTINUOUS single-tap card scanning via foreground dispatch. Registers
 * the tag event ONCE and keeps it registered: DiscoverTag fires per tap and a
 * fresh tap reads the next card (a `busy` guard drops re-entrant events while a
 * read is in flight). Foreground dispatch is used over reader mode because some
 * NXP/Samsung controllers fail MIFARE Classic authentication under reader mode.
 *
 * The handler talks IsoDep (chip EasyCard applet) and/or switches to MIFARE
 * Classic (legacy / co-branded) on the same card via `session`. Per-tap cleanup
 * uses `closeTechnology` (nulls the native techRequest without invoking its
 * pending callback); it must NEVER call cancelTechnologyRequest, which would
 * re-invoke the connect() callback and abort the app.
 */
export function startCardScanning<T>(
    handler: (session: CardSession) => Promise<T>,
    handlers: CardScanHandlers<T>,
): CardScanHandle {
    let stopped = false;
    let busy = false;

    const onTag = async (tag: any) => {
        // Ignore re-entrant events while a read is in flight; reader-mode presence
        // keeps the same resting card from firing again once handled.
        if (stopped || busy) {
            return;
        }
        busy = true;
        handlers.onReading?.();

        const techTypes: string[] = tag?.techTypes || [];
        // applet／icash 會把 transceive 錯誤一律轉成 FailedToReadCardError，
        // 所以卡離開的事實記在這裡，讓下面的重試迴圈看得到。
        let tagLost = false;
        const session: CardSession = {
            uid: tag?.id ?? '',
            techTypes,
            hasIsoDep: techTypes.includes(TECH_ISO_DEP),
            hasMifareClassic: techTypes.includes(TECH_MIFARE_CLASSIC),
            // Close any tech already open (e.g. MifareClassic from a prior retry)
            // so each connect is a clean re-select, not a live tech switch.
            connectIsoDep: () => connectTech(NfcTech.IsoDep),
            connectMifareClassic: () => connectTech(NfcTech.MifareClassic),
            transceive: async (apdu) => {
                try {
                    return await nfcManager.transceive(apdu);
                } catch (error) {
                    if (isTagLostError(error)) {
                        tagLost = true;
                    }
                    throw error;
                }
            },
        };

        try {
            let retryCount = 0;
            for (;;) {
                tagLost = false;
                try {
                    const result = await handler(session);
                    if (!stopped) {
                        handlers.onResult(result);
                    }
                    break;
                } catch (caught) {
                    // 只改寫被 applet／icash 包起來的錯誤，其他型別（例如查無金鑰）照原樣回報。
                    const error =
                        tagLost && caught instanceof FailedToReadCardError
                            ? new CardLostError()
                            : caught;
                    if (
                        error instanceof FailedToReadCardError &&
                        retryCount < MAX_READ_RETRIES
                    ) {
                        retryCount += 1;
                        continue;
                    }
                    if (!stopped) {
                        handlers.onError(error);
                    }
                    break;
                }
            }
        } finally {
            // Release the tech handle but KEEP reader mode registered.
            try {
                await callNative('closeTechnology');
            } catch (error) {}
            busy = false;
        }
    };

    nfcManager.setEventListener(NfcEvents.DiscoverTag, onTag);
    handlers.onReady?.();
    nfcManager
        .registerTagEvent({
            isReaderModeEnabled: false,
            readerModeFlags: READER_MODE_FLAGS,
            readerModeDelay: 5,
        })
        .catch((error) => {
            if (!stopped) {
                handlers.onError(error);
            }
        });

    return {
        stop: async () => {
            if (stopped) {
                return;
            }
            stopped = true;
            try {
                await callNative('closeTechnology');
            } catch (error) {}
            try {
                await nfcManager.unregisterTagEvent();
            } catch (error) {}
            nfcManager.setEventListener(NfcEvents.DiscoverTag, null);
        },
    };
}

function convertKey(keyHexString: string): number[] {
    const result = [] as number[];
    for (let i = 0; i < keyHexString.length; i += 2) {
        result.push(parseInt(keyHexString.slice(i, i + 2), 16));
    }

    return result;
}

async function authenticateWithKeyA(sector: number, keyA: string) {
    try {
        return await nfcManager.mifareClassicHandlerAndroid.mifareClassicAuthenticateA(
            sector,
            convertKey(keyA),
        );
    } catch (error) {
        // Any auth failure must abort this read rather than silently falling
        // through to read an unauthenticated block.
        if (isTagLostError(error)) {
            throw new CardLostError();
        }
        throw new FailedToReadCardError();
    }
}

async function readBlock(block: number): Promise<number[]> {
    let data: number[];
    try {
        data =
            (await nfcManager.mifareClassicHandlerAndroid.mifareClassicReadBlock(
                block as never,
            )) as number[];
    } catch (error) {
        if (isTagLostError(error)) {
            throw new CardLostError();
        }
        throw new FailedToReadCardError();
    }

    if (data.length !== MIFARE_BLOCK_SIZE) {
        throw new FailedToReadCardError();
    }

    return data;
}

function parseSignedBalance(block: number[]): number {
    let balance = 0;
    for (let index = 0; index < 4; index++) {
        balance *= 256;
        balance += block[3 - index];
    }

    if (balance >= 2147483648) {
        balance -= 2147483648 * 2;
    }

    return balance;
}

function parseTransitDate(data1: number, data2: number): Date {
    const year = Math.floor(data2 / 2) + 1980;
    const month = Math.floor(data1 / 32) + (data2 % 2) * 8;
    const day = data1 % 32;

    return new Date(`${year}-${month}-${day}`);
}

export async function readBalance(card: Card): Promise<number> {
    const sector2KeyA = card.sectors.find((sector) => sector.index === 2)?.keyA;
    if (!sector2KeyA) {
        throw new MissingNecessaryKeysError();
    }

    await authenticateWithKeyA(2, sector2KeyA);
    const block8 = await readBlock(8);

    return parseSignedBalance(block8);
}

export async function readKuokuangPoints(card: Card): Promise<number> {
    const sector11KeyA = card.sectors.find(
        (sector) => sector.index === 11,
    )?.keyA;
    if (!sector11KeyA) {
        throw new MissingNecessaryKeysError();
    }

    await authenticateWithKeyA(11, sector11KeyA);
    const block44 = await readBlock(44);
    const block46 = await readBlock(46);

    return block44[4] - block46[0];
}

export async function readTpassInfo(card: Card): Promise<TpassInfo> {
    const sector8KeyA = card.sectors.find((sector) => sector.index === 8)?.keyA;
    const sector6KeyA = card.sectors.find((sector) => sector.index === 6)?.keyA;
    if (!sector8KeyA || !sector6KeyA) {
        throw new MissingNecessaryKeysError();
    }

    await authenticateWithKeyA(8, sector8KeyA);
    const block32 = await readBlock(32);

    if (block32[1] === 0 || block32[2] === 0) {
        return { purchaseDate: null, expiryDate: null };
    }

    const purchaseDate = parseTransitDate(block32[1], block32[2]);
    await authenticateWithKeyA(6, sector6KeyA);
    const block26 = await readBlock(26);

    let expiryDate: Date | null = null;
    if (block26[14] > 0 && block26[15] > 0) {
        const candidate = parseTransitDate(block26[14], block26[15]);
        if (candidate > purchaseDate) {
            expiryDate = candidate;
        }
    }

    return { purchaseDate, expiryDate };
}
