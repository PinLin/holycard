import nfcManager, { NfcTech } from 'react-native-nfc-manager';
import { FailedToReadCardError } from '../error/failedToReadCardError';
import { MissingNecessaryKeysError } from '../error/missingNecessaryKeysError';
import { Card, TpassInfo } from '../types';

const MIFARE_BLOCK_SIZE = 16;
const MAX_READ_RETRIES = 10;

export function initializeNfc() {
    return nfcManager.start();
}

export async function requestMifareClassic<T>(
    handler: (uid: string) => Promise<T>,
): Promise<T> {
    try {
        await nfcManager.cancelTechnologyRequest();
    } catch (error) {}

    try {
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
        await nfcManager.cancelTechnologyRequest();
    }
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
        if (
            (error as Error).message ===
            'mifareClassicAuthenticate fail: AUTH_FAIL'
        ) {
            throw new FailedToReadCardError();
        }
    }
}

async function readBlock(block: number): Promise<number[]> {
    const data =
        (await nfcManager.mifareClassicHandlerAndroid.mifareClassicReadBlock(
            block as never,
        )) as number[];

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
