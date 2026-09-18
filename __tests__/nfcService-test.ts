import { MissingNecessaryKeysError } from '../src/error/missingNecessaryKeysError';
import { readBalance, readTpassInfo } from '../src/services/nfcService';
import { Card, CardType } from '../src/types';

const mockAuthenticateA = jest.fn();
const mockReadBlock = jest.fn();

jest.mock('react-native-nfc-manager', () => ({
    __esModule: true,
    default: {
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
