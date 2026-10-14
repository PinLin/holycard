import { CardLostError } from '../src/error/cardLostError';
import { EasyCardAppletUnavailableError } from '../src/error/easyCardAppletUnavailableError';
import { FailedToReadCardError } from '../src/error/failedToReadCardError';
import { IcashUnavailableError } from '../src/error/icashUnavailableError';
import { MissingNecessaryKeysError } from '../src/error/missingNecessaryKeysError';
import {
    readCard,
    readViaApplet,
    readViaIcash,
    readViaServerKeys,
} from '../src/services/cardReader';
import type { CardSession } from '../src/services/nfcService';
import { Card, CardType } from '../src/types';

jest.mock('../src/services/cardService', () => ({ getCard: jest.fn() }));
jest.mock('../src/services/easyCardApplet', () => ({
    readEasyCardChip: jest.fn(),
}));
jest.mock('../src/services/icashCard', () => ({
    readIcashCard: jest.fn(),
}));
jest.mock('../src/services/nfcService', () => ({
    readBalance: jest.fn(),
    readKuokuangPoints: jest.fn(),
    readTpassInfo: jest.fn(),
}));

const { getCard } = require('../src/services/cardService');
const { readEasyCardChip } = require('../src/services/easyCardApplet');
const { readIcashCard } = require('../src/services/icashCard');
const {
    readBalance,
    readKuokuangPoints,
    readTpassInfo,
} = require('../src/services/nfcService');

function makeSession(overrides: Partial<CardSession> = {}): CardSession {
    return {
        uid: 'ABCD1234',
        techTypes: [],
        hasIsoDep: false,
        hasMifareClassic: false,
        connectIsoDep: jest.fn().mockResolvedValue(undefined),
        connectMifareClassic: jest.fn().mockResolvedValue(undefined),
        transceive: jest.fn().mockResolvedValue([]),
        ...overrides,
    };
}

function makeCard(overrides: Partial<Card> = {}): Card {
    return {
        uid: 'ABCD1234',
        type: CardType.EASY_CARD,
        number: '0000',
        nickname: '',
        is_kuokuang_card: false,
        sectors: [],
        ...overrides,
    };
}

const KEYED_CARD = makeCard({
    sectors: [
        { index: 2, keyA: 'AA', keyB: null },
        { index: 6, keyA: 'BB', keyB: null },
        { index: 8, keyA: 'CC', keyB: null },
    ],
});

beforeEach(() => {
    // reset 而非 clear：連 mockResolvedValue／Once 佇列一起清，測試之間不會互相外溢。
    jest.resetAllMocks();
    // 預設金鑰來源查無此卡。
    getCard.mockRejectedValue(new Error('not found'));
});

describe('readCard', () => {
    test('1. 晶片悠遊卡(IsoDep+MIFARE)沒有餘額金鑰: applet 讀卡號餘額(+月票), 不碰 MIFARE 金鑰路徑', async () => {
        readEasyCardChip.mockResolvedValue({
            number: '9134',
            balance: 111,
            tpass: { purchaseDate: null, expiryDate: null },
        });
        getCard.mockResolvedValue(makeCard({ sectors: [] }));
        const session = makeSession({
            hasIsoDep: true,
            hasMifareClassic: true,
        });

        const result = await readCard(session);

        expect(session.connectIsoDep).toHaveBeenCalledTimes(1);
        expect(session.connectMifareClassic).not.toHaveBeenCalled();
        expect(readBalance).not.toHaveBeenCalled();
        expect(result.balance).toBe(111);
        expect(result.serverKeysUsed).toBe(false);
    });

    test('2. applet 非悠遊卡(6A82) + icash 成功: 走 icash, serverKeysUsed false', async () => {
        readEasyCardChip.mockRejectedValue(
            new EasyCardAppletUnavailableError(),
        );
        readIcashCard.mockResolvedValue({
            number: '7511 1701 7301 0654',
            balance: -17,
        });
        getCard.mockRejectedValue(new Error('not found'));
        const session = makeSession({
            hasIsoDep: true,
            hasMifareClassic: true,
        });

        const result = await readCard(session);

        expect(result.card.type).toBe(CardType.ICASH);
        expect(result.card.number).toBe('7511 1701 7301 0654');
        expect(result.balance).toBe(-17);
        expect(result.serverKeysUsed).toBe(false);
        expect(session.connectMifareClassic).not.toHaveBeenCalled();
    });

    test('3. 雙介面卡有金鑰(9122 等): 只走 classic 讀餘額＋月票, 不碰 IsoDep', async () => {
        getCard.mockResolvedValue(KEYED_CARD);
        readBalance.mockResolvedValue(300);
        readTpassInfo.mockResolvedValue({
            purchaseDate: new Date('2026-08-24'),
            expiryDate: new Date('2026-09-22'),
        });
        const session = makeSession({
            hasIsoDep: true,
            hasMifareClassic: true,
        });

        const result = await readCard(session);

        expect(session.connectIsoDep).not.toHaveBeenCalled();
        expect(readEasyCardChip).not.toHaveBeenCalled();
        expect(session.connectMifareClassic).toHaveBeenCalledTimes(1);
        expect(result.balance).toBe(300);
        expect(result.tpass?.expiryDate).toEqual(new Date('2026-09-22'));
        expect(result.serverKeysUsed).toBe(true);
    });

    test('3a. 雙介面卡 classic 暫時性失敗: 同一連線重試, 不重新連線', async () => {
        getCard.mockResolvedValue(KEYED_CARD);
        readBalance
            .mockRejectedValueOnce(new FailedToReadCardError())
            .mockResolvedValue(300);
        readTpassInfo.mockResolvedValue({
            purchaseDate: null,
            expiryDate: null,
        });
        const session = makeSession({
            hasIsoDep: true,
            hasMifareClassic: true,
        });

        const result = await readCard(session);

        expect(readBalance).toHaveBeenCalledTimes(2);
        expect(session.connectMifareClassic).toHaveBeenCalledTimes(1);
        expect(result.balance).toBe(300);
    });

    test('3b. 雙介面卡 classic 連續失敗 10 次: 退回 applet', async () => {
        getCard.mockResolvedValue(KEYED_CARD);
        readBalance.mockRejectedValue(new FailedToReadCardError());
        readEasyCardChip.mockResolvedValue({ number: '9122', balance: 50 });
        const session = makeSession({
            hasIsoDep: true,
            hasMifareClassic: true,
        });

        const result = await readCard(session);

        expect(readBalance).toHaveBeenCalledTimes(10);
        expect(session.connectIsoDep).toHaveBeenCalledTimes(1);
        expect(result.balance).toBe(50);
        expect(result.serverKeysUsed).toBe(false);
    });

    test('3c. 雙介面卡 classic 途中卡已離開: 直接拋出, 不退回 applet', async () => {
        getCard.mockResolvedValue(KEYED_CARD);
        readBalance.mockRejectedValue(new CardLostError());
        const session = makeSession({
            hasIsoDep: true,
            hasMifareClassic: true,
        });

        await expect(readCard(session)).rejects.toBeInstanceOf(CardLostError);
        expect(readBalance).toHaveBeenCalledTimes(1);
        expect(session.connectIsoDep).not.toHaveBeenCalled();
    });

    test('3d. 雙介面卡有紀錄但缺餘額金鑰: 走 applet', async () => {
        getCard.mockResolvedValue(
            makeCard({ sectors: [{ index: 8, keyA: 'CC', keyB: null }] }),
        );
        readEasyCardChip.mockResolvedValue({ number: '9122', balance: 70 });
        const session = makeSession({
            hasIsoDep: true,
            hasMifareClassic: true,
        });

        const result = await readCard(session);

        expect(session.connectMifareClassic).not.toHaveBeenCalled();
        expect(result.balance).toBe(70);
    });

    test('3e. 雙介面聯名卡查無金鑰 + applet 6A82 + icash 不可用: 後端查無此卡的錯誤往上拋', async () => {
        const notFound = new Error('not found');
        getCard.mockRejectedValue(notFound);
        readEasyCardChip.mockRejectedValue(
            new EasyCardAppletUnavailableError(),
        );
        readIcashCard.mockRejectedValue(new IcashUnavailableError());
        const session = makeSession({
            hasIsoDep: true,
            hasMifareClassic: true,
        });

        await expect(readCard(session)).rejects.toBe(notFound);
        expect(session.connectIsoDep).toHaveBeenCalledTimes(1);
        expect(session.connectMifareClassic).toHaveBeenCalledTimes(1);
    });

    test('4. applet 6A82 + icash 不可用 + 無 MIFARE: IcashUnavailableError 往上拋', async () => {
        readEasyCardChip.mockRejectedValue(
            new EasyCardAppletUnavailableError(),
        );
        readIcashCard.mockRejectedValue(new IcashUnavailableError());
        const session = makeSession({
            hasIsoDep: true,
            hasMifareClassic: false,
        });

        await expect(readCard(session)).rejects.toBeInstanceOf(
            IcashUnavailableError,
        );
        expect(session.connectMifareClassic).not.toHaveBeenCalled();
    });

    test('5. applet 非 6A82 的暫時性錯誤: 不退回 icash, 直接往上拋', async () => {
        readEasyCardChip.mockRejectedValue(new FailedToReadCardError());
        const session = makeSession({
            hasIsoDep: true,
            hasMifareClassic: true,
        });

        await expect(readCard(session)).rejects.toBeInstanceOf(
            FailedToReadCardError,
        );
        expect(readIcashCard).not.toHaveBeenCalled();
    });

    test('6. 純舊卡(無 IsoDep + 有 MIFARE): 走後端金鑰路徑, 不碰 applet', async () => {
        getCard.mockResolvedValue(
            makeCard({ sectors: [{ index: 2, keyA: 'AA', keyB: null }] }),
        );
        readBalance.mockResolvedValue(500);
        readTpassInfo.mockResolvedValue({
            purchaseDate: null,
            expiryDate: null,
        });
        const session = makeSession({
            hasIsoDep: false,
            hasMifareClassic: true,
        });

        const result = await readCard(session);

        expect(session.connectIsoDep).not.toHaveBeenCalled();
        expect(session.connectMifareClassic).toHaveBeenCalledTimes(1);
        expect(readEasyCardChip).not.toHaveBeenCalled();
        expect(result.balance).toBe(500);
        expect(result.serverKeysUsed).toBe(true);
    });

    test('7. 既無 IsoDep 也無 MIFARE: FailedToReadCardError', async () => {
        const session = makeSession({
            hasIsoDep: false,
            hasMifareClassic: false,
        });

        await expect(readCard(session)).rejects.toBeInstanceOf(
            FailedToReadCardError,
        );
    });
});

describe('readViaApplet', () => {
    test('7. backend has no record (getCard throws): still succeeds, nickname empty, sectors empty, serverKeysUsed false', async () => {
        readEasyCardChip.mockResolvedValue({
            number: '9134',
            balance: 88,
            tpass: undefined,
        });
        getCard.mockRejectedValue(new Error('not found'));
        const session = makeSession({
            hasIsoDep: true,
            hasMifareClassic: true,
        });

        const result = await readViaApplet(session);

        expect(result.card.number).toBe('9134');
        expect(result.card.nickname).toBe('');
        expect(result.card.sectors).toEqual([]);
        expect(result.balance).toBe(88);
        expect(result.serverKeysUsed).toBe(false);
    });
});

describe('readViaIcash', () => {
    test('backend has no record (getCard throws): still succeeds, nickname empty, sectors empty, serverKeysUsed false', async () => {
        readIcashCard.mockResolvedValue({
            number: '7511 1701 7301 0654',
            balance: -17,
        });
        getCard.mockRejectedValue(new Error('not found'));
        const session = makeSession({
            hasIsoDep: true,
            hasMifareClassic: true,
        });

        const result = await readViaIcash(session);

        expect(result.card.type).toBe(CardType.ICASH);
        expect(result.card.number).toBe('7511 1701 7301 0654');
        expect(result.card.nickname).toBe('');
        expect(result.card.sectors).toEqual([]);
        expect(result.balance).toBe(-17);
        expect(result.serverKeysUsed).toBe(false);
    });
});

describe('readViaServerKeys', () => {
    test('8a. kuokuang card: reads points, does not read tpass, serverKeysUsed true', async () => {
        getCard.mockResolvedValue(
            makeCard({
                is_kuokuang_card: true,
                sectors: [{ index: 2, keyA: 'AA', keyB: null }],
            }),
        );
        readBalance.mockResolvedValue(200);
        readKuokuangPoints.mockResolvedValue(15);

        const result = await readViaServerKeys(makeSession());

        // 後端金鑰查詢要用 session 的 uid,而非誤傳整個 session。
        expect(getCard).toHaveBeenCalledWith('ABCD1234');
        expect(result.kuokuangPoints).toBe(15);
        expect(readTpassInfo).not.toHaveBeenCalled();
        expect(result.serverKeysUsed).toBe(true);
    });

    test('8b. kuokuang card missing points key: warning recorded, kuokuangPoints undefined', async () => {
        getCard.mockResolvedValue(
            makeCard({
                is_kuokuang_card: true,
                sectors: [{ index: 2, keyA: 'AA', keyB: null }],
            }),
        );
        readBalance.mockResolvedValue(200);
        readKuokuangPoints.mockRejectedValue(new MissingNecessaryKeysError());

        const result = await readViaServerKeys(makeSession());

        expect(result.warnings).toContain('缺少讀取國光點數的金鑰');
        expect(result.kuokuangPoints).toBeUndefined();
    });

    test('9. easycard missing tpass key: warning recorded, tpass undefined', async () => {
        getCard.mockResolvedValue(
            makeCard({
                is_kuokuang_card: false,
                sectors: [{ index: 2, keyA: 'AA', keyB: null }],
            }),
        );
        readBalance.mockResolvedValue(400);
        readTpassInfo.mockRejectedValue(new MissingNecessaryKeysError());

        const result = await readViaServerKeys(makeSession());

        expect(result.warnings).toContain('缺少讀取通勤月票資訊的金鑰');
        expect(result.tpass).toBeUndefined();
    });
});
