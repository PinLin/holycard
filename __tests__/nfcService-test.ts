import { CardLostError } from '../src/error/cardLostError';
import { FailedToReadCardError } from '../src/error/failedToReadCardError';
import { MissingNecessaryKeysError } from '../src/error/missingNecessaryKeysError';
import {
    CardSession,
    readBalance,
    readTpassInfo,
    startCardScanning,
} from '../src/services/nfcService';
import { Card, CardType } from '../src/types';

const mockAuthenticateA = jest.fn();
const mockReadBlock = jest.fn();
const mockConnect = jest.fn();
const mockTransceive = jest.fn();
let mockTagListener: ((tag: unknown) => Promise<void>) | null = null;

jest.mock('react-native-nfc-manager', () => ({
    __esModule: true,
    default: {
        setEventListener: (_event: string, listener: never) => {
            mockTagListener = listener;
        },
        registerTagEvent: () => Promise.resolve(),
        unregisterTagEvent: () => Promise.resolve(),
        close: () => Promise.resolve(),
        connect: (...args: unknown[]) => mockConnect(...args),
        transceive: (...args: unknown[]) => mockTransceive(...args),
        mifareClassicHandlerAndroid: {
            mifareClassicAuthenticateA: (...args: unknown[]) =>
                mockAuthenticateA(...args),
            mifareClassicReadBlock: (...args: unknown[]) =>
                mockReadBlock(...args),
        },
    },
    NfcEvents: { DiscoverTag: 'DiscoverTag' },
    NfcTech: { IsoDep: 'IsoDep', MifareClassic: 'MifareClassic' },
}));

jest.mock('react-native-nfc-manager/src/NativeNfcManager', () => ({
    callNative: jest.fn(),
}));

/**
 * 實體晶片悠遊卡(9122)MIFARE Classic 面向的 block 原文：持有仍在效期內的月票、
 * 餘額 0。9122 的 applet 不暴露月票，月票只能從這兩個磁區解出，這組樣本守住解析
 * 邏輯不被改壞。
 */
const REAL_9122 = {
    // 第 2 磁區 block 8：餘額，前 4 bytes 小端有號整數。
    balanceBlock8: [
        0x00, 0x00, 0x00, 0x00, 0xff, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x00,
        0x00, 0xff, 0x00, 0xff,
    ],
    // 第 8 磁區 block 32：[1..2] = 購買日 18 5D -> 2026-08-24。
    purchaseBlock32: [
        0x4b, 0x18, 0x5d, 0x00, 0x00, 0x00, 0x00, 0x1e, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00,
    ],
    // 第 6 磁區 block 26：[14..15] = 到期日 36 5D -> 2026-09-22。
    expiryBlock26: [
        0x77, 0x06, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x01, 0x01, 0x36, 0x5d,
    ],
};

/**
 * 實體晶片悠遊卡(9123)第 2 磁區 block 8：標準 MIFARE 數值區塊，[0..3] 餘額 -29、
 * [4..7] 其補數、[8..11] 再放一次餘額；同卡 applet 也解出 -29。
 */
const REAL_9123_NEGATIVE_BALANCE_BLOCK8 = [
    0xe3, 0xff, 0xff, 0xff, 0x1c, 0x00, 0x00, 0x00, 0xe3, 0xff, 0xff, 0xff,
    0x00, 0xff, 0x00, 0xff,
];

function makeCard(sectorIndexes: number[]): Card {
    return {
        uid: 'A13FD62C',
        type: CardType.EASY_CARD,
        number: '9122 0188 3517 9777',
        nickname: '',
        is_kuokuang_card: false,
        sectors: sectorIndexes.map((index) => ({
            index,
            keyA: 'AABBCCDDEEFF',
            keyB: null,
        })),
    };
}

beforeEach(() => {
    jest.clearAllMocks();
    mockAuthenticateA.mockResolvedValue(true);
});

describe('readBalance (實體 9122 卡資料)', () => {
    test('第 2 磁區 block 8 解出餘額 0 元', async () => {
        mockReadBlock.mockResolvedValue(REAL_9122.balanceBlock8);

        await expect(readBalance(makeCard([2]))).resolves.toBe(0);
        expect(mockAuthenticateA).toHaveBeenCalledWith(2, expect.any(Array));
    });

    test('負餘額卡解出 -29，不是無號數的 4294967267', async () => {
        mockReadBlock.mockResolvedValue(REAL_9123_NEGATIVE_BALANCE_BLOCK8);

        await expect(readBalance(makeCard([2]))).resolves.toBe(-29);
    });

    test('缺第 2 磁區金鑰時要求金鑰，不讀出錯誤的餘額', async () => {
        await expect(readBalance(makeCard([6, 8]))).rejects.toBeInstanceOf(
            MissingNecessaryKeysError,
        );
        expect(mockReadBlock).not.toHaveBeenCalled();
    });
});

describe('readTpassInfo (實體 9122 卡資料)', () => {
    test('解出購買日 2026-08-24 與到期日 2026-09-22', async () => {
        mockReadBlock.mockImplementation((block: number) =>
            Promise.resolve(
                block === 32
                    ? REAL_9122.purchaseBlock32
                    : REAL_9122.expiryBlock26,
            ),
        );

        const tpass = await readTpassInfo(makeCard([6, 8]));

        // 用本地時間建構，與卡片列印的日期一致(裝置為 UTC+8)。
        expect(tpass.purchaseDate).toEqual(new Date('2026-8-24'));
        expect(tpass.expiryDate).toEqual(new Date('2026-9-22'));
    });

    test('效期為 30 日：到期日比購買日晚 29 天', async () => {
        mockReadBlock.mockImplementation((block: number) =>
            Promise.resolve(
                block === 32
                    ? REAL_9122.purchaseBlock32
                    : REAL_9122.expiryBlock26,
            ),
        );

        const tpass = await readTpassInfo(makeCard([6, 8]));
        const days =
            (tpass.expiryDate!.getTime() - tpass.purchaseDate!.getTime()) /
            86400000;

        expect(days).toBe(29);
    });

    test('缺第 6 或第 8 磁區金鑰時要求金鑰', async () => {
        await expect(readTpassInfo(makeCard([2, 8]))).rejects.toBeInstanceOf(
            MissingNecessaryKeysError,
        );
        await expect(readTpassInfo(makeCard([2, 6]))).rejects.toBeInstanceOf(
            MissingNecessaryKeysError,
        );
    });
});

// 原生錯誤字串（react-native-nfc-manager 3.16.1 ＋ patches/ 的補丁）。
const AUTH_FAIL = 'mifareClassicAuthenticate fail: AUTH_FAIL';
const AUTH_TAG_LOST = 'mifareClassicAuthenticate fail: TAG_LOST';

describe('MIFARE 讀取錯誤分類', () => {
    test('金鑰被拒（AUTH_FAIL）是可重試的 FailedToReadCardError', async () => {
        mockAuthenticateA.mockRejectedValue(new Error(AUTH_FAIL));
        await expect(readBalance(makeCard([2]))).rejects.toBeInstanceOf(
            FailedToReadCardError,
        );
    });

    test('卡已離開（TAG_LOST）是 CardLostError', async () => {
        mockAuthenticateA.mockRejectedValue(new Error(AUTH_TAG_LOST));
        await expect(readBalance(makeCard([2]))).rejects.toBeInstanceOf(
            CardLostError,
        );
    });
});

describe('startCardScanning 重試策略', () => {
    const TAG = {
        id: 'A13FD62C',
        techTypes: [
            'android.nfc.tech.IsoDep',
            'android.nfc.tech.MifareClassic',
        ],
    };

    async function tapWith(handler: (session: CardSession) => Promise<string>) {
        const onResult = jest.fn();
        const onError = jest.fn();
        const scan = startCardScanning(handler, { onResult, onError });
        await mockTagListener!(TAG);
        await scan.stop();
        return { onResult, onError };
    }

    test('卡片在場的暫時性失敗會重試，之後成功', async () => {
        const handler = jest
            .fn()
            .mockRejectedValueOnce(new FailedToReadCardError())
            .mockResolvedValue('ok');
        const { onResult, onError } = await tapWith(handler);
        expect(handler).toHaveBeenCalledTimes(2);
        expect(onResult).toHaveBeenCalledWith('ok');
        expect(onError).not.toHaveBeenCalled();
    });

    test('MIFARE 讀取回報卡已離開：不重試，回報 CardLostError', async () => {
        const handler = jest.fn().mockRejectedValue(new CardLostError());
        const { onError } = await tapWith(handler);
        expect(handler).toHaveBeenCalledTimes(1);
        expect(onError.mock.calls[0][0]).toBeInstanceOf(CardLostError);
    });

    test('applet 把 transceive 的 TAG_LOST 包成 FailedToReadCardError 時，仍視為卡已離開', async () => {
        mockTransceive.mockRejectedValue(
            new Error('transceive fail: TAG_LOST'),
        );
        const handler = jest.fn(async (session: CardSession) => {
            try {
                await session.transceive([0x00]);
            } catch (error) {
                throw new FailedToReadCardError();
            }
            return 'unreachable';
        });
        const { onError } = await tapWith(handler);
        expect(handler).toHaveBeenCalledTimes(1);
        expect(onError.mock.calls[0][0]).toBeInstanceOf(CardLostError);
    });

    test('一般 transceive 失敗（非 TAG_LOST）照常重試', async () => {
        mockTransceive
            .mockRejectedValueOnce(new Error('transceive fail'))
            .mockResolvedValue([0x90, 0x00]);
        const handler = jest.fn(async (session: CardSession) => {
            try {
                await session.transceive([0x00]);
            } catch (error) {
                throw new FailedToReadCardError();
            }
            return 'ok';
        });
        const { onResult } = await tapWith(handler);
        expect(handler).toHaveBeenCalledTimes(2);
        expect(onResult).toHaveBeenCalledWith('ok');
    });

    test('connect 暫時失敗一次、第二次連上：照常讀取', async () => {
        mockConnect
            .mockRejectedValueOnce(new Error('connect fail: TAG_LOST'))
            .mockResolvedValue(undefined);
        const handler = jest.fn(async (session: CardSession) => {
            await session.connectMifareClassic();
            return 'ok';
        });
        const { onResult } = await tapWith(handler);
        expect(mockConnect).toHaveBeenCalledTimes(2);
        expect(onResult).toHaveBeenCalledWith('ok');
    });

    test('transceive 曾 TAG_LOST，但 handler 最後丟的是別種錯誤：照原樣回報', async () => {
        mockTransceive.mockRejectedValue(
            new Error('transceive fail: TAG_LOST'),
        );
        const otherError = new Error('查無金鑰');
        const handler = jest.fn(async (session: CardSession) => {
            try {
                await session.transceive([0x00]);
            } catch (error) {}
            throw otherError;
        });
        const { onError } = await tapWith(handler);
        expect(onError).toHaveBeenCalledWith(otherError);
    });

    test('connect 連續失敗（補丁回報 TAG_LOST）轉成 CardLostError，不重試', async () => {
        mockConnect.mockRejectedValue(new Error('connect fail: TAG_LOST'));
        const handler = jest.fn(async (session: CardSession) => {
            await session.connectMifareClassic();
            return 'unreachable';
        });
        const { onError } = await tapWith(handler);
        expect(handler).toHaveBeenCalledTimes(1);
        expect(onError.mock.calls[0][0]).toBeInstanceOf(CardLostError);
    });
});
