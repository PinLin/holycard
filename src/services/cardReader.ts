import { EasyCardAppletUnavailableError } from '../error/easyCardAppletUnavailableError';
import { FailedToReadCardError } from '../error/failedToReadCardError';
import { MissingNecessaryKeysError } from '../error/missingNecessaryKeysError';
import { Card, CardReadResult, CardType, TpassInfo } from '../types';
import { getCard } from './cardService';
import { readEasyCardChip } from './easyCardApplet';
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

    return { card, balance, kuokuangPoints, tpass, warnings, serverKeysUsed: true };
}

/**
 * 單次感應讀取分流。applet 優先：晶片悠遊卡(IsoDep + applet)免金鑰讀；聯名卡
 * 暴露 IsoDep 但無 applet(6A82)，同一次感應內切到 MIFARE Classic 用後端金鑰；
 * 純舊卡(無 IsoDep)直接走 MIFARE Classic。
 */
export async function readCard(
    session: CardSession,
): Promise<CardReadResult> {
    if (session.hasIsoDep) {
        await session.connectIsoDep();
        try {
            return await readViaApplet(session);
        } catch (err) {
            if (
                err instanceof EasyCardAppletUnavailableError &&
                session.hasMifareClassic
            ) {
                await session.connectMifareClassic();
                return readViaServerKeys(session);
            }
            throw err;
        }
    }

    if (session.hasMifareClassic) {
        await session.connectMifareClassic();
        return readViaServerKeys(session);
    }

    throw new FailedToReadCardError();
}
