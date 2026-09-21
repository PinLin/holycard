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

beforeEach(() => {
    jest.clearAllMocks();
});

describe('readCard', () => {
    test('1. 晶片悠遊卡(IsoDep+MIFARE): applet 讀卡號餘額(+月票), 不碰 MIFARE 金鑰路徑', async () => {
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

    test('3. applet 6A82 + icash 不可用 + 有 MIFARE: 退回後端金鑰路徑讀餘額月票', async () => {
        readEasyCardChip.mockRejectedValue(
            new EasyCardAppletUnavailableError(),
        );
        readIcashCard.mockRejectedValue(new IcashUnavailableError());
        getCard.mockResolvedValue(
            makeCard({ sectors: [{ index: 2, keyA: 'AA', keyB: null }] }),
        );
        readBalance.mockResolvedValue(300);
        readTpassInfo.mockResolvedValue({
            purchaseDate: null,
            expiryDate: null,
        });
        const session = makeSession({
            hasIsoDep: true,
            hasMifareClassic: true,
        });

        const result = await readCard(session);

        expect(session.connectMifareClassic).toHaveBeenCalledTimes(1);
        expect(result.balance).toBe(300);
        expect(result.serverKeysUsed).toBe(true);
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
