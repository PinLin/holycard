import { EasyCardAppletUnavailableError } from '../error/easyCardAppletUnavailableError';
import { FailedToReadCardError } from '../error/failedToReadCardError';
import { IcashUnavailableError } from '../error/icashUnavailableError';
import { MissingNecessaryKeysError } from '../error/missingNecessaryKeysError';
import { Card, CardReadResult, CardType, TpassInfo } from '../types';
import { getCard } from './cardService';
import { readEasyCardChip } from './easyCardApplet';
import { readIcashCard } from './icashCard';
import {
    CardSession,
    readBalance,
    readKuokuangPoints,
    readTpassInfo,
} from './nfcService';

/**
 * 晶片悠遊卡(9122/9132)透過 applet 免金鑰讀取，不需後端金鑰；後端可能沒有此卡
 * 紀錄，所以缺後端 metadata 不算失敗。serverKeysUsed = false。
 */
export async function readViaApplet(
    session: CardSession,
): Promise<CardReadResult> {
    const chip = await readEasyCardChip(session.transceive);

    let meta: Card | null = null;
    try {
        meta = await getCard(session.uid);
    } catch (err) {
        // 免金鑰讀取即使後端查無此卡也成立。
    }

    const card: Card = {
        uid: session.uid,
        type: CardType.EASY_CARD,
        number: chip.number,
        nickname: meta?.nickname ?? '',
        is_kuokuang_card: meta?.is_kuokuang_card ?? false,
        sectors: meta?.sectors ?? [],
    };

    return {
        card,
        balance: chip.balance,
        tpass: chip.tpass,
        warnings: [],
        serverKeysUsed: false,
    };
}

/**
 * icash 2.0(MIFARE DESFire EV1)透過其 DESFire application 免金鑰讀取，不需
 * 後端金鑰；後端可能沒有此卡紀錄，所以缺後端 metadata 不算失敗。serverKeysUsed = false。
 */
export async function readViaIcash(
    session: CardSession,
): Promise<CardReadResult> {
    const icash = await readIcashCard(session.transceive);

    let meta: Card | null = null;
    try {
        meta = await getCard(session.uid);
    } catch (err) {
        // 免金鑰讀取即使後端查無此卡也成立。
    }

    const card: Card = {
        uid: session.uid,
        type: CardType.ICASH,
        number: icash.number,
        nickname: meta?.nickname ?? '',
        is_kuokuang_card: meta?.is_kuokuang_card ?? false,
        sectors: meta?.sectors ?? [],
    };

    return {
        card,
        balance: icash.balance,
        warnings: [],
        serverKeysUsed: false,
    };
}

/**
 * 聯名卡 / 舊卡：EasyCard 資料在 MIFARE Classic 加密磁區，需後端每磁區金鑰。缺選填
 * 金鑰(國光點數、月票)降級為 warning 而非整筆失敗。serverKeysUsed = true。
 */
export async function readViaServerKeys(
    session: CardSession,
    prefetched?: Card,
): Promise<CardReadResult> {
    const card = prefetched ?? (await getCard(session.uid));
    const balance = await readBalance(card);

    const warnings: string[] = [];

    let kuokuangPoints: number | undefined;
    if (card.is_kuokuang_card) {
        try {
            kuokuangPoints = await readKuokuangPoints(card);
        } catch (err) {
            if (err instanceof MissingNecessaryKeysError) {
                warnings.push('缺少讀取國光點數的金鑰');
            } else {
                throw err;
            }
        }
    }

    let tpass: TpassInfo | undefined;
    if (!card.is_kuokuang_card && card.type === CardType.EASY_CARD) {
        try {
            tpass = await readTpassInfo(card);
        } catch (err) {
            if (err instanceof MissingNecessaryKeysError) {
                warnings.push('缺少讀取通勤月票資訊的金鑰');
            } else {
                throw err;
            }
        }
    }

    return {
        card,
        balance,
        kuokuangPoints,
        tpass,
        warnings,
        serverKeysUsed: true,
    };
}

const CLASSIC_ATTEMPTS = 10;

/**
 * 雙介面卡(晶片悠遊卡)且金鑰來源有餘額金鑰時，整次感應只走 MIFARE Classic，餘額與
 * 月票一起讀。不先碰 IsoDep：SmartMX 在同一次感應內從 IsoDep 切到 classic 會連續
 * 認證失敗。連線一次、同 handle 重試；沒有金鑰或全數失敗回 null，交給 applet。
 */
async function tryClassicWithKeys(
    session: CardSession,
): Promise<CardReadResult | null> {
    let card: Card;
    try {
        card = await getCard(session.uid);
    } catch (err) {
        return null;
    }
    if (!card?.sectors?.some((sector) => sector.index === 2 && sector.keyA)) {
        return null;
    }

    await session.connectMifareClassic();
    for (let attempt = 1; attempt <= CLASSIC_ATTEMPTS; attempt++) {
        try {
            return await readViaServerKeys(session, card);
        } catch (err) {
            if (!(err instanceof FailedToReadCardError)) {
                throw err;
            }
        }
    }
    return null;
}

/**
 * 單次感應讀取分流：
 * 1. 雙介面卡有金鑰 → MIFARE Classic(餘額＋月票)，見 tryClassicWithKeys。
 * 2. 有 IsoDep → 悠遊卡 applet，免金鑰(卡號＋餘額；9122 不含月票，超級悠遊卡含)。
 * 3. applet 非悠遊卡(6A82) → icash 2.0(DESFire)，免金鑰。
 * 4. 都不是但有 MIFARE 面向，或無 applet 的純舊卡/聯名卡 → 後端金鑰路徑。
 * 都不成立才拋 FailedToReadCardError。
 */
export async function readCard(session: CardSession): Promise<CardReadResult> {
    if (session.hasIsoDep && session.hasMifareClassic) {
        const result = await tryClassicWithKeys(session);
        if (result) {
            return result;
        }
    }

    if (session.hasIsoDep) {
        await session.connectIsoDep();
        try {
            return await readViaApplet(session);
        } catch (err) {
            if (!(err instanceof EasyCardAppletUnavailableError)) {
                throw err;
            }
        }

        try {
            return await readViaIcash(session);
        } catch (err) {
            if (
                !(err instanceof IcashUnavailableError) ||
                !session.hasMifareClassic
            ) {
                throw err;
            }
        }
    }

    if (session.hasMifareClassic) {
        await session.connectMifareClassic();
        return readViaServerKeys(session);
    }

    throw new FailedToReadCardError();
}
