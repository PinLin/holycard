import { FailedToReadCardError } from '../src/error/failedToReadCardError';
import { IcashUnavailableError } from '../src/error/icashUnavailableError';
import {
    GET_ICASH_BALANCE_APDU,
    ICASH_AID,
    READ_ICASH_CARDNO_APDU,
    SELECT_ICASH_AID_APDU,
    Transceive,
    parseIcashBalance,
    parseIcashNumber,
    readIcashCard,
} from '../src/services/icashCard';

const OK = [0x91, 0x00];

// pm3 實測(2026-07-11):卡號 ReadData(file 03)回應。
const CARD_NUMBER_BYTES = [0x75, 0x11, 0x17, 0x01, 0x73, 0x01, 0x06, 0x54];
// pm3 實測:GetValue(file 06)回應,LE signed int32 = -17。
const BALANCE_BYTES = [0xef, 0xff, 0xff, 0xff];

describe('icash 2.0 command bytes', () => {
    // Pin the exact wire bytes with hardcoded literals — a typo here silently
    // stops a real card from responding, which no test could otherwise catch.
    test('ICASH_AID is the physical icash 2.0 DESFire AID', () => {
        expect(ICASH_AID).toEqual([0x11, 0x87, 0x16]);
    });

    test('SELECT_ICASH_AID_APDU selects the DESFire application', () => {
        expect(SELECT_ICASH_AID_APDU).toEqual([
            0x90, 0x5a, 0x00, 0x00, 0x03, 0x11, 0x87, 0x16, 0x00,
        ]);
    });

    test('READ_ICASH_CARDNO_APDU is ReadData on file 03', () => {
        expect(READ_ICASH_CARDNO_APDU).toEqual([
            0x90, 0xbd, 0x00, 0x00, 0x07, 0x03, 0x00, 0x00, 0x00, 0x08, 0x00,
            0x00, 0x00,
        ]);
    });

    test('GET_ICASH_BALANCE_APDU is GetValue on file 06', () => {
        expect(GET_ICASH_BALANCE_APDU).toEqual([
            0x90, 0x6c, 0x00, 0x00, 0x01, 0x06, 0x00,
        ]);
    });
});

describe('icash 2.0 parsers', () => {
    test('parses card number from 8 BCD bytes grouped in fours', () => {
        expect(parseIcashNumber(CARD_NUMBER_BYTES)).toBe('7511 1701 7301 0654');
    });

    test('parses balance as little-endian signed int32', () => {
        // 待正常餘額的卡校準：目前先驗證已實測的負值向量。
        expect(parseIcashBalance(BALANCE_BYTES)).toBe(-17);
        expect(parseIcashBalance([0x00, 0x00, 0x00, 0x00])).toBe(0);
        expect(parseIcashBalance([0x64, 0x00, 0x00, 0x00])).toBe(100);
    });
});

describe('readIcashCard', () => {
    function fakeTransceive(
        responses: { select: number[]; cardNo?: number[]; balance?: number[] },
        log?: number[][],
    ): Transceive {
        return async (apdu: number[]) => {
            log?.push(apdu);
            if (apdu[1] === 0x5a) {
                return responses.select;
            }
            if (apdu[1] === 0xbd) {
                if (!responses.cardNo) {
                    throw new Error('fakeTransceive: cardNo response not configured');
                }
                return responses.cardNo;
            }
            if (apdu[1] === 0x6c) {
                if (!responses.balance) {
                    throw new Error('fakeTransceive: balance response not configured');
                }
                return responses.balance;
            }
            throw new Error(`unexpected APDU: ${apdu}`);
        };
    }

    test('reads number and balance, sending SELECT -> ReadData -> GetValue in order', async () => {
        const log: number[][] = [];
        const transceive = fakeTransceive(
            {
                select: OK,
                cardNo: [...CARD_NUMBER_BYTES, ...OK],
                balance: [...BALANCE_BYTES, ...OK],
            },
            log,
        );

        const result = await readIcashCard(transceive);

        expect(result.number).toBe('7511 1701 7301 0654');
        expect(result.balance).toBe(-17);
        expect(log[0]).toEqual(SELECT_ICASH_AID_APDU);
        expect(log[1]).toEqual(READ_ICASH_CARDNO_APDU);
        expect(log[2]).toEqual(GET_ICASH_BALANCE_APDU);
    });

    test('throws IcashUnavailableError when SELECT does not return 91 00', async () => {
        const transceive = fakeTransceive({ select: [0x6a, 0x82] });

        await expect(readIcashCard(transceive)).rejects.toBeInstanceOf(
            IcashUnavailableError,
        );
    });

    test('throws FailedToReadCardError when SELECT transceive throws', async () => {
        const transceive: Transceive = async () => {
            throw new Error('RF lost');
        };

        await expect(readIcashCard(transceive)).rejects.toBeInstanceOf(
            FailedToReadCardError,
        );
    });

    test('throws FailedToReadCardError when ReadData returns a non-91 00 status', async () => {
        const transceive = fakeTransceive({
            select: OK,
            cardNo: [0x6a, 0x82],
        });

        await expect(readIcashCard(transceive)).rejects.toBeInstanceOf(
            FailedToReadCardError,
        );
    });

    test('throws FailedToReadCardError when GetValue transceive throws', async () => {
        const transceive: Transceive = async (apdu) => {
            if (apdu[1] === 0x5a) {
                return OK;
            }
            if (apdu[1] === 0xbd) {
                return [...CARD_NUMBER_BYTES, ...OK];
            }
            throw new Error('RF lost');
        };

        await expect(readIcashCard(transceive)).rejects.toBeInstanceOf(
            FailedToReadCardError,
        );
    });
});
