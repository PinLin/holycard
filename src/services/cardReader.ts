import { EasyCardAppletUnavailableError } from '../error/easyCardAppletUnavailableError';
import { FailedToReadCardError } from '../error/failedToReadCardError';
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
): Promise<CardReadResult> {
    const card = await getCard(session.uid);
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

/**
 * 單次感應讀取分流。MIFARE Classic 優先：只要卡片有 MIFARE 面向就先走後端金鑰
 * 路徑，因為那是唯一能同時取得餘額與通勤月票的介面——晶片悠遊卡(9122)的 applet
 * 只給卡號與餘額，月票僅存在 MIFARE Classic 的第 6、8 磁區。
 *
 * 金鑰路徑失敗(後端查無此卡、缺必要金鑰、認證失敗)時，只要卡片還有 IsoDep 就
 * 退回免金鑰路徑：先試悠遊卡 applet，再試 icash 2.0(DESFire)。這條退路讓後端
 * 沒有紀錄的晶片卡仍讀得出卡號與餘額。無 IsoDep 的純舊卡則直接把錯誤往上拋。
 */
export async function readCard(session: CardSession): Promise<CardReadResult> {
    if (session.hasMifareClassic) {
        try {
            await session.connectMifareClassic();
            return await readViaServerKeys(session);
        } catch (err) {
            // 有 IsoDep 時，金鑰路徑的任何失敗都退回免金鑰 applet：認證失敗造成的
            // halt 可由 connectIsoDep()(先 close 再 connect)重新 select 復原。
            // 不分辨錯誤型別也不發降級警告——後端查無此卡與缺金鑰是常態，applet
            // 補得上；其餘失敗退回後若月票讀不到，寧可安靜少一欄也不丟看不懂的提示。
            if (!session.hasIsoDep) {
                throw err;
            }
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

        return readViaIcash(session);
    }

    throw new FailedToReadCardError();
}
