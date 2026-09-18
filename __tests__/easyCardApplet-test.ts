import { EasyCardAppletUnavailableError } from '../src/error/easyCardAppletUnavailableError';
import { FailedToReadCardError } from '../src/error/failedToReadCardError';
import {
    EASY_CARD_AID,
    GET_CARD_DATA_APDU,
    READ_TPASS_PURCHASE_RECORD_APDU,
    SELECT_APPLET_APDU,
    Transceive,
    parseEasyCardBalance,
    parseEasyCardNumber,
    parseTransitDate,
    readEasyCardChip,
} from '../src/services/easyCardApplet';

const OK = [0x90, 0x00];

function hexToBytes(hex: string): number[] {
    const out: number[] = [];
    for (let i = 0; i < hex.length; i += 2) {
        out.push(parseInt(hex.slice(i, i + 2), 16));
    }
    return out;
}

// A spec-accurate `80 30` data block: lead byte, card number in BCD at [1..8],
// little-endian balance at [39..40]; everything else is card-specific padding.
function buildCardData(
    cardNumberBytes: number[],
    balanceBytes: [number, number],
): number[] {
    const data = new Array(48).fill(0);
    data[0] = 0x02;
    cardNumberBytes.forEach((byte, index) => {
        data[1 + index] = byte;
    });
    data[39] = balanceBytes[0];
    data[40] = balanceBytes[1];
    return data;
}

const CARD_NUMBER_BYTES = [0x91, 0x34, 0x12, 0x38, 0x02, 0x71, 0x58, 0x88];

// Real-card SFI5 record-1 responses (full APDU response, incl. SW 90 00),
// captured with pm3 against physical cards. [4..5] = 購買日, [6..7] = 啟用日.
//
// 舊卡:購買 E1 56 -> 2023-07-01,啟用 00 00(購買即啟用)-> 到期 2023-07-30。
const TPASS_OLD_CARD =
    '0200004BE15600001E00000000000000000000000000000000009000';
// 續購卡:購買 ee 5c -> 2026-07-14,啟用 f5 5c -> 2026-07-21 -> 到期 2026-08-19。
const TPASS_CONTINUED_CARD =
    '0200004Bee5cf55c1eb0040000000000000000000000000000009000';
// 無月票卡:SFI5 rec1 全零 -> 無月票。
const TPASS_NONE_CARD =
    '00000000000000000000000000000000000000000000000000009000';

describe('EasyCard applet command bytes', () => {
    // Pin the exact wire bytes with hardcoded literals. A single wrong byte makes
    // a real card silently stop responding, and that can't be caught by a unit
    // test — so these guard against a typo slipping in unnoticed. Do NOT rewrite
    // them in terms of the exported constants: that would just be a tautology.
    test('EASY_CARD_AID is the physical EasyCard applet AID', () => {
        expect(EASY_CARD_AID).toEqual([
            0xa0, 0x00, 0x00, 0x03, 0x22, 0x10, 0x07, 0x01,
        ]);
    });

    test('SELECT_APPLET_APDU selects the AID over ISO7816', () => {
        expect(SELECT_APPLET_APDU).toEqual([
            0x00, 0xa4, 0x04, 0x00, 0x08, 0xa0, 0x00, 0x00, 0x03, 0x22, 0x10,
            0x07, 0x01, 0x00,
        ]);
    });

    test('GET_CARD_DATA_APDU is the proprietary 80 30 command', () => {
        expect(GET_CARD_DATA_APDU).toEqual([
            0x80, 0x30, 0x00, 0x00, 0x08, 0x01, 0x02, 0x01, 0x03, 0x02, 0x02,
            0x02, 0x01, 0x00,
        ]);
    });

    test('READ_TPASS_PURCHASE_RECORD_APDU reads SFI5 record 1', () => {
        expect(READ_TPASS_PURCHASE_RECORD_APDU).toEqual([
            0x00, 0xb2, 0x01, 0x2c, 0x00,
        ]);
    });
});

describe('EasyCard applet parsers', () => {
    test('parses card number from BCD bytes [1..8] grouped in fours', () => {
        const data = buildCardData(CARD_NUMBER_BYTES, [0x00, 0x00]);
        expect(parseEasyCardNumber(data)).toBe('9134 1238 0271 5888');
    });

    test('keeps leading-zero BCD nibbles (does not drop digits)', () => {
        const data = buildCardData(
            [0x09, 0x05, 0x00, 0x12, 0x34, 0x56, 0x78, 0x90],
            [0x00, 0x00],
        );
        expect(parseEasyCardNumber(data)).toBe('0905 0012 3456 7890');
    });

    test('parses a negative balance as little-endian int16 NT$', () => {
        // -5: FB FF；-100: 9C FF；-1: FF FF。負餘額只會是幾十元，不可顯示成 65531。
        expect(
            parseEasyCardBalance(
                buildCardData(CARD_NUMBER_BYTES, [0xfb, 0xff]),
            ),
        ).toBe(-5);
        expect(
            parseEasyCardBalance(
                buildCardData(CARD_NUMBER_BYTES, [0x9c, 0xff]),
            ),
        ).toBe(-100);
        expect(
            parseEasyCardBalance(
                buildCardData(CARD_NUMBER_BYTES, [0xff, 0xff]),
            ),
        ).toBe(-1);
        // 0x7FFF 是有號 16 位元的正數上限，必須維持正值。
        expect(
            parseEasyCardBalance(
                buildCardData(CARD_NUMBER_BYTES, [0xff, 0x7f]),
            ),
        ).toBe(32767);
    });

    test('parses balance as little-endian int16 NT$', () => {
        expect(
            parseEasyCardBalance(
                buildCardData(CARD_NUMBER_BYTES, [0x64, 0x00]),
            ),
        ).toBe(100);
        expect(
            parseEasyCardBalance(
                buildCardData(CARD_NUMBER_BYTES, [0xe8, 0x03]),
            ),
        ).toBe(1000);
        expect(
            parseEasyCardBalance(
                buildCardData(CARD_NUMBER_BYTES, [0x00, 0x00]),
            ),
        ).toBe(0);
    });

    // Assert via getFullYear/getMonth/getDate (not string comparison) so the
    // tests aren't sensitive to the runner's timezone.
    test('parses a transit-date field at the given offset (購買日 [4..5])', () => {
        const record = hexToBytes(TPASS_OLD_CARD);
        const date = parseTransitDate(record, 4);
        expect(date).toBeInstanceOf(Date);
        expect(date!.getFullYear()).toBe(2023);
        expect(date!.getMonth() + 1).toBe(7);
        expect(date!.getDate()).toBe(1);
    });

    test('parses a transit-date field at a second offset (啟用日 [6..7])', () => {
        const record = hexToBytes(TPASS_CONTINUED_CARD);
        const date = parseTransitDate(record, 6);
        expect(date!.getFullYear()).toBe(2026);
        expect(date!.getMonth() + 1).toBe(7);
        expect(date!.getDate()).toBe(21);
    });

    test('returns null when the record is too short for the offset', () => {
        expect(parseTransitDate([0, 0, 0, 0, 0xe1], 4)).toBeNull();
    });

    test('returns null when the first date byte is zero', () => {
        expect(parseTransitDate([0, 0, 0, 0, 0x00, 0x56], 4)).toBeNull();
    });

    test('returns null when the second date byte is zero', () => {
        expect(parseTransitDate([0, 0, 0, 0, 0xe1, 0x00], 4)).toBeNull();
    });
});

describe('readEasyCardChip', () => {
    function fakeTransceive(
        responses: {
            select: number[];
            data: number[];
            // SFI5 rec1 (00 b2 01 2c 00). Optional so "no applet / GET DATA
            // fails" scenarios that never reach the TPASS read can omit it.
            tpass?: number[];
        },
        log?: number[][],
    ): Transceive {
        return async (apdu: number[]) => {
            log?.push(apdu);
            if (apdu[1] === 0xa4) {
                return responses.select;
            }
            if (apdu[1] === 0x30) {
                return responses.data;
            }
            // TPASS read is SFI5 rec1: 00 b2 01 2c 00.
            if (apdu[1] === 0xb2 && apdu[2] === 0x01) {
                if (!responses.tpass) {
                    throw new Error(
                        'fakeTransceive: tpass response not configured',
                    );
                }
                return responses.tpass;
            }
            throw new Error(`unexpected APDU: ${apdu}`);
        };
    }

    test('reads number, balance and TPASS, sending the correct APDUs', async () => {
        const log: number[][] = [];
        const transceive = fakeTransceive(
            {
                select: OK,
                data: [
                    ...buildCardData(CARD_NUMBER_BYTES, [0x64, 0x00]),
                    ...OK,
                ],
                tpass: hexToBytes(TPASS_OLD_CARD),
            },
            log,
        );

        const result = await readEasyCardChip(transceive);

        expect(result.number).toBe('9134 1238 0271 5888');
        expect(result.balance).toBe(100);
        expect(result.tpass?.purchaseDate?.getFullYear()).toBe(2023);
        expect(result.tpass!.purchaseDate!.getMonth() + 1).toBe(7);
        expect(result.tpass?.purchaseDate?.getDate()).toBe(1);

        expect(log[0]).toEqual(SELECT_APPLET_APDU);
        expect(log[1]).toEqual(GET_CARD_DATA_APDU);
        expect(log[2]).toEqual(READ_TPASS_PURCHASE_RECORD_APDU);
    });

    // (b) 啟用日為零 → 有效起始日 = 購買日 → 到期 = 購買 + 29。
    test('expiry = 購買日 + 29 when the activation field ([6..7]) is zero', async () => {
        const transceive = fakeTransceive({
            select: OK,
            data: [...buildCardData(CARD_NUMBER_BYTES, [0x64, 0x00]), ...OK],
            tpass: hexToBytes(TPASS_OLD_CARD),
        });

        const result = await readEasyCardChip(transceive);

        expect(result.tpass?.expiryDate?.getFullYear()).toBe(2023);
        expect(result.tpass!.expiryDate!.getMonth() + 1).toBe(7);
        expect(result.tpass?.expiryDate?.getDate()).toBe(30);
    });

    // (a) 有獨立啟用日 → 有效起始日 = 啟用日 → 到期 = 啟用 + 29(跨月)。
    test('expiry = 啟用日 + 29 when an activation date is present', async () => {
        const transceive = fakeTransceive({
            select: OK,
            data: [...buildCardData(CARD_NUMBER_BYTES, [0x64, 0x00]), ...OK],
            tpass: hexToBytes(TPASS_CONTINUED_CARD),
        });

        const result = await readEasyCardChip(transceive);

        // 購買 2026-07-14,啟用 2026-07-21,到期 2026-08-19。
        expect(result.tpass?.purchaseDate?.getFullYear()).toBe(2026);
        expect(result.tpass!.purchaseDate!.getMonth() + 1).toBe(7);
        expect(result.tpass?.purchaseDate?.getDate()).toBe(14);
        expect(result.tpass?.expiryDate?.getFullYear()).toBe(2026);
        expect(result.tpass!.expiryDate!.getMonth() + 1).toBe(8);
        expect(result.tpass?.expiryDate?.getDate()).toBe(19);
    });

    // (c) SFI5 rec1 全零 → 無月票。
    test('omits TPASS when SFI5 rec1 is all-zero (non-TPASS card)', async () => {
        const transceive = fakeTransceive({
            select: OK,
            data: [...buildCardData(CARD_NUMBER_BYTES, [0x00, 0x00]), ...OK],
            tpass: hexToBytes(TPASS_NONE_CARD),
        });

        const result = await readEasyCardChip(transceive);

        expect(result.tpass).toBeUndefined();
    });

    // (d) 非 9000 status → 無月票。
    test('omits TPASS when the SFI5 read returns a non-9000 status', async () => {
        const transceive = fakeTransceive({
            select: OK,
            data: [...buildCardData(CARD_NUMBER_BYTES, [0x64, 0x00]), ...OK],
            tpass: [...new Array(50).fill(0), 0x69, 0x85],
        });

        const result = await readEasyCardChip(transceive);

        expect(result.tpass).toBeUndefined();
    });

    // (e) TPASS 讀取 transceive 丟例外 → 可重試的 FailedToReadCardError。
    test('propagates a transient TPASS read failure instead of reporting no TPASS', async () => {
        const transceive: Transceive = async (apdu) => {
            if (apdu[1] === 0xa4) {
                return OK;
            }
            if (apdu[1] === 0x30) {
                return [
                    ...buildCardData(CARD_NUMBER_BYTES, [0x64, 0x00]),
                    ...OK,
                ];
            }
            throw new Error('RF lost');
        };

        await expect(readEasyCardChip(transceive)).rejects.toBeInstanceOf(
            FailedToReadCardError,
        );
    });

    test('throws EasyCardAppletUnavailableError when the applet is not present', async () => {
        const transceive = fakeTransceive({
            select: [0x6a, 0x82],
            data: [],
        });

        await expect(readEasyCardChip(transceive)).rejects.toBeInstanceOf(
            EasyCardAppletUnavailableError,
        );
    });

    test('throws FailedToReadCardError when GET DATA returns a non-9000 status', async () => {
        const transceive = fakeTransceive({
            select: OK,
            data: [0x6a, 0x86],
        });

        await expect(readEasyCardChip(transceive)).rejects.toBeInstanceOf(
            FailedToReadCardError,
        );
    });

    test('throws FailedToReadCardError when GET DATA transceive throws', async () => {
        const transceive: Transceive = async (apdu) => {
            if (apdu[1] === 0xa4) {
                return OK;
            }
            throw new Error('RF lost');
        };

        await expect(readEasyCardChip(transceive)).rejects.toBeInstanceOf(
            FailedToReadCardError,
        );
    });

    test('throws FailedToReadCardError when GET DATA response is shorter than 41 bytes', async () => {
        const transceive = fakeTransceive({
            select: OK,
            data: [...new Array(39).fill(0), ...OK],
        });

        await expect(readEasyCardChip(transceive)).rejects.toBeInstanceOf(
            FailedToReadCardError,
        );
    });
});

/**
 * 四張實體卡 applet(GET DATA `80 30`)回應的前 41 個位元組。用途：釘住卡號在
 * [1..8]、餘額在 [39..40]（含負餘額須以有號數解讀），並確認 [27..29] 的
 * C4 FF FF (-60) 是固定的透支下限、不是餘額。
 */
describe('實體卡 GET DATA 解析', () => {
    const hex = hexToBytes;

    const CARDS = [
        {
            name: '晶片悠遊卡 9122(餘額 0, 持有月票)',
            data: hex(
                '01912201883517977711202020201E0600CDC75B8017E87F102700C4FFFF1027000000000000000000',
            ),
            number: '9122 0188 3517 9777',
            balance: 0,
        },
        {
            name: '超級悠遊卡 9134(餘額 0, 持有月票)',
            data: hex(
                '02913412380271588811202020201E0C00BC66648017E87F102700C4FFFF1027000000000000000000',
            ),
            number: '9134 1238 0271 5888',
            balance: 0,
        },
        {
            name: '超級悠遊卡 9134(餘額 100, 未買月票)',
            data: hex(
                '02913412481711158411202020201E0C000449678017E87F102700C4FFFF1027000000000000006400',
            ),
            number: '9134 1248 1711 1584',
            balance: 100,
        },
        {
            // 負餘額樣本：E3 FF 當無號數會變成 65507，必須以有號數解讀為 -29。
            name: '晶片悠遊卡 9123(餘額 -29, 透支中)',
            data: hex(
                '01912301762340984111202020201E06005EC05980CD6E7F102700C4FFFF102700000000000000E3FF',
            ),
            number: '9123 0176 2340 9841',
            balance: -29,
        },
    ];

    test.each(CARDS)(
        '$name 解出正確的卡號與餘額',
        ({ data, number, balance }) => {
            expect(parseEasyCardNumber(data)).toBe(number);
            expect(parseEasyCardBalance(data)).toBe(balance);
        },
    );

    test('[27..29] 的 -60 是透支下限參數，四張卡一致，不是餘額', () => {
        CARDS.forEach(({ data }) => {
            expect(data.slice(27, 30)).toEqual([0xc4, 0xff, 0xff]);
        });
    });
});
