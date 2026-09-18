import { CardUnavailableError } from '../src/error/cardUnavailableError';
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
    test('1. 晶片卡但後端沒有磁區金鑰: 金鑰路徑先試再退回 applet, 餘額取自 applet, serverKeysUsed false', async () => {
        readEasyCardChip.mockResolvedValue({
            number: '9134',
            balance: 111,
            tpass: { purchaseDate: null, expiryDate: null },
        });
        getCard.mockResolvedValue(makeCard({ sectors: [] }));
        readBalance.mockRejectedValue(new MissingNecessaryKeysError());
        const session = makeSession({
            hasIsoDep: true,
            hasMifareClassic: true,
        });

        const result = await readCard(session);

        expect(session.connectMifareClassic).toHaveBeenCalledTimes(1);
        expect(session.connectIsoDep).toHaveBeenCalledTimes(1);
        expect(result.balance).toBe(111);
        expect(result.serverKeysUsed).toBe(false);
    });

    test('2. 聯名卡/舊卡(有 MIFARE + 後端有金鑰): 金鑰路徑直接成功, 完全不碰免金鑰介面', async () => {
        getCard.mockResolvedValue(
            makeCard({ sectors: [{ index: 2, keyA: 'AA', keyB: null }] }),
        );
        readBalance.mockResolvedValue(500);
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
        expect(readEasyCardChip).not.toHaveBeenCalled();
        expect(readIcashCard).not.toHaveBeenCalled();
        expect(result.balance).toBe(500);
        expect(result.serverKeysUsed).toBe(true);
        expect(result.warnings).toEqual([]);
    });

    test('2b. icash card (金鑰路徑失敗後退回, applet 6A82, icash 成功): reads via icash, serverKeysUsed false', async () => {
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

        expect(session.connectMifareClassic).toHaveBeenCalledTimes(1);
        expect(result.card.type).toBe(CardType.ICASH);
        expect(result.card.number).toBe('7511 1701 7301 0654');
        expect(result.balance).toBe(-17);
        expect(result.serverKeysUsed).toBe(false);
    });

    test('3. applet 6A82 且 icash 也不可用，且無 MIFARE Classic: IcashUnavailableError propagates, MIFARE not connected', async () => {
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

    test('4. applet 的非 6A82 錯誤: 不退回 icash 也不被吞掉, 直接往上拋', async () => {
        getCard.mockRejectedValue(new CardUnavailableError());
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

    test('5. legacy card (no IsoDep, has MIFARE): reads via server keys, IsoDep not connected, serverKeysUsed true', async () => {
        getCard.mockResolvedValue(
            makeCard({ sectors: [{ index: 2, keyA: 'AA', keyB: null }] }),
        );
        readBalance.mockResolvedValue(300);
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
        expect(result.balance).toBe(300);
        expect(result.serverKeysUsed).toBe(true);
    });

    test('6. neither IsoDep nor MIFARE Classic: FailedToReadCardError', async () => {
        const session = makeSession({
            hasIsoDep: false,
            hasMifareClassic: false,
        });

        await expect(readCard(session)).rejects.toBeInstanceOf(
            FailedToReadCardError,
        );
    });

    test('9. 晶片悠遊卡 9122(有 MIFARE + 後端有金鑰): 先走金鑰路徑讀到月票, 不呼叫 applet', async () => {
        getCard.mockResolvedValue(
            makeCard({ sectors: [{ index: 2, keyA: 'AA', keyB: null }] }),
        );
        readBalance.mockResolvedValue(0);
        readTpassInfo.mockResolvedValue({
            purchaseDate: new Date('2026-8-24'),
            expiryDate: new Date('2026-9-22'),
        });
        const session = makeSession({
            hasIsoDep: true,
            hasMifareClassic: true,
        });

        const result = await readCard(session);

        expect(session.connectMifareClassic).toHaveBeenCalledTimes(1);
        expect(readEasyCardChip).not.toHaveBeenCalled();
        expect(result.balance).toBe(0);
        expect(result.tpass?.expiryDate).toEqual(new Date('2026-9-22'));
        expect(result.serverKeysUsed).toBe(true);
    });

    test('10. 有 MIFARE 但後端無此卡紀錄: 退回 applet 免金鑰路徑', async () => {
        getCard.mockRejectedValue(new CardUnavailableError());
        readEasyCardChip.mockResolvedValue({
            number: '9122 0188 3517 9777',
            balance: 50,
            tpass: undefined,
        });
        const session = makeSession({
            hasIsoDep: true,
            hasMifareClassic: true,
        });

        const result = await readCard(session);

        expect(session.connectMifareClassic).toHaveBeenCalledTimes(1);
        expect(session.connectIsoDep).toHaveBeenCalledTimes(1);
        expect(result.card.number).toBe('9122 0188 3517 9777');
        expect(result.balance).toBe(50);
        expect(result.serverKeysUsed).toBe(false);
        // 後端查無此卡是預期情況,免金鑰路徑本來就補得上,不該產生雜訊警告。
        expect(result.warnings).toEqual([]);
    });

    test('11. MIFARE 認證失敗(金鑰不符/RF 中斷)且有 IsoDep: 退回 applet', async () => {
        getCard.mockResolvedValue(
            makeCard({ sectors: [{ index: 2, keyA: 'AA', keyB: null }] }),
        );
        readBalance.mockRejectedValue(new FailedToReadCardError());
        readEasyCardChip.mockResolvedValue({
            number: '9132 0000 0000 0000',
            balance: 77,
            tpass: undefined,
        });
        const session = makeSession({
            hasIsoDep: true,
            hasMifareClassic: true,
        });

        const result = await readCard(session);

        expect(result.balance).toBe(77);
        expect(result.serverKeysUsed).toBe(false);
    });

    test('13. 餘額讀到但月票讀取中斷: 安靜退回 applet, 不產生警告', async () => {
        getCard.mockResolvedValue(
            makeCard({ sectors: [{ index: 2, keyA: 'AA', keyB: null }] }),
        );
        readBalance.mockResolvedValue(0);
        readTpassInfo.mockRejectedValue(new FailedToReadCardError());
        readEasyCardChip.mockResolvedValue({
            number: '9122 0188 3517 9777',
            balance: 0,
            tpass: undefined,
        });
        const session = makeSession({
            hasIsoDep: true,
            hasMifareClassic: true,
        });

        const result = await readCard(session);

        expect(result.tpass).toBeUndefined();
        // 依產品決定：退回免金鑰路徑一律安靜進行，不對使用者丟降級提示。
        expect(result.warnings).toEqual([]);
    });

    test('15. 超級悠遊卡(applet 自帶月票): 金鑰路徑失敗後退回, 月票仍由 applet 補回', async () => {
        getCard.mockResolvedValue(
            makeCard({ sectors: [{ index: 2, keyA: 'AA', keyB: null }] }),
        );
        readBalance.mockRejectedValue(new FailedToReadCardError());
        readEasyCardChip.mockResolvedValue({
            number: '9132 0000 0000 0000',
            balance: 350,
            tpass: {
                purchaseDate: new Date('2026-8-24'),
                expiryDate: new Date('2026-9-22'),
            },
        });
        const session = makeSession({
            hasIsoDep: true,
            hasMifareClassic: true,
        });

        const result = await readCard(session);

        expect(result.balance).toBe(350);
        expect(result.tpass?.expiryDate).toEqual(new Date('2026-9-22'));
        expect(result.warnings).toEqual([]);
    });

    test('14. 缺磁區金鑰而退回: 屬預期降級, 不加降級警告', async () => {
        getCard.mockResolvedValue(makeCard({ sectors: [] }));
        readBalance.mockRejectedValue(new MissingNecessaryKeysError());
        readEasyCardChip.mockResolvedValue({
            number: '9134 0000 0000 0000',
            balance: 20,
            tpass: undefined,
        });
        const session = makeSession({
            hasIsoDep: true,
            hasMifareClassic: true,
        });

        const result = await readCard(session);

        expect(result.balance).toBe(20);
        expect(result.warnings).toEqual([]);
    });

    test('12. 純舊卡(無 IsoDep)金鑰路徑失敗: 錯誤往上拋, 不吞掉', async () => {
        getCard.mockRejectedValue(new CardUnavailableError());
        const session = makeSession({
            hasIsoDep: false,
            hasMifareClassic: true,
        });

        await expect(readCard(session)).rejects.toBeInstanceOf(
            CardUnavailableError,
        );
        expect(readEasyCardChip).not.toHaveBeenCalled();
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
