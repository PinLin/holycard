import { EasyCardAppletUnavailableError } from '../error/easyCardAppletUnavailableError';
import { FailedToReadCardError } from '../error/failedToReadCardError';
import { TpassInfo } from '../types';

/**
 * Reads EasyCard chip cards (晶片悠遊卡 9122 / 超級悠遊卡 9132, SAK 0x28) through the
 * EasyCard T=CL applet `A000000322100701` over ISO14443-4 (IsoDep) APDUs.
 *
 * Unlike the MIFARE Classic path this needs NO sector keys: card number, balance
 * and TPASS (定期票) expiry are all exposed by the applet. This module is kept free
 * of any native (`react-native-nfc-manager`) imports so the parsing/command logic
 * can be unit tested without hardware — the caller injects a `Transceive`.
 */

/** EasyCard application identifier (shared by physical 9122 / 9132 cards). */
export const EASY_CARD_AID = [
    0xa0, 0x00, 0x00, 0x03, 0x22, 0x10, 0x07, 0x01,
];

/** SELECT the EasyCard applet by AID. */
export const SELECT_APPLET_APDU = [
    0x00, 0xa4, 0x04, 0x00, 0x08, ...EASY_CARD_AID, 0x00,
];

/**
 * Proprietary GET DATA command whose response carries the card number and the
 * live balance. Also acts as the mandatory precondition for the READ RECORD
 * commands below (skipping it makes them return 69 85).
 */
export const GET_CARD_DATA_APDU = [
    0x80, 0x30, 0x00, 0x00, 0x08, 0x01, 0x02, 0x01, 0x03, 0x02, 0x02, 0x02,
    0x01, 0x00,
];

/** READ RECORD — SFI 5 record 1: holds the TPASS 購買日/啟用日 when present. */
export const READ_TPASS_PURCHASE_RECORD_APDU = [0x00, 0xb2, 0x01, 0x2c, 0x00];

export type Transceive = (apdu: number[]) => Promise<number[]>;

export interface EasyCardChipData {
    number: string;
    balance: number;
    tpass?: TpassInfo;
}

function isStatusOk(response: number[]): boolean {
    return (
        response.length >= 2 &&
        response[response.length - 2] === 0x90 &&
        response[response.length - 1] === 0x00
    );
}

/** Strips the trailing SW1/SW2 status word, leaving just the data bytes. */
function dataOf(response: number[]): number[] {
    return response.slice(0, -2);
}

/**
 * Card number = data bytes [1..8] as BCD, grouped into four 4-digit blocks.
 * e.g. `91 34 12 38 02 71 58 88` -> `9134 1238 0271 5888`.
 */
export function parseEasyCardNumber(data: number[]): string {
    const digits = data
        .slice(1, 9)
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');

    return digits.replace(/(.{4})(.{4})(.{4})(.{4})/, '$1 $2 $3 $4');
}

/** Balance = data bytes [39..40] as a little-endian uint16, unit NT$. */
export function parseEasyCardBalance(data: number[]): number {
    return data[39] + data[40] * 256;
}

/**
 * Decodes an EasyCard transit-date field: the two bytes at `record[offset]` and
 * `record[offset + 1]` in EasyCard's packed date encoding — byte0 = day plus the
 * high month bits, byte1 = year plus the low month bit. This is the SAME packing
 * the MIFARE Classic path decodes, NOT a little-endian Unix timestamp. Verified
 * against a real card's kiosk-printed 定期票購買日 (E1 56 -> 2023-07-01). Returns
 * null when the field is absent (either byte zero) or the record is too short.
 *
 * Keep the `new Date(\`${year}-${month}-${day}\`)` construction: with unpadded
 * single-digit month/day this is parsed in the device's LOCAL time, matching the
 * day printed on real cards on a Taiwan (UTC+8) device. Do NOT switch to
 * zero-padded/ISO/UTC — that would shift the date a day earlier.
 */
export function parseTransitDate(record: number[], offset: number): Date | null {
    if (record.length < offset + 2) {
        return null;
    }

    const d1 = record[offset];
    const d2 = record[offset + 1];
    if (d1 === 0 || d2 === 0) {
        return null;
    }

    const year = Math.floor(d2 / 2) + 1980;
    const month = Math.floor(d1 / 32) + (d2 % 2) * 8;
    const day = d1 % 32;

    return new Date(`${year}-${month}-${day}`);
}

/** TPASS 通勤月票效期為 30 日,末日 = 有效起始日 + (30 - 1) 天。 */
const TPASS_VALID_DAYS = 30;

/** 回傳 date 之後 days 天的新 Date;用 setDate 讓跨月/跨年進位自動正確。 */
function addDays(date: Date, days: number): Date {
    const result = new Date(date.getTime());
    result.setDate(result.getDate() + days);
    return result;
}

/**
 * 讀取 TPASS 定期票資訊,只讀 SFI5 record 1(`READ_TPASS_PURCHASE_RECORD_APDU`):
 *   - `[4..5]` = 購買日(transit-date 編碼)
 *   - `[6..7]` = 啟用日(transit-date 編碼;為 0 表示「購買即啟用」)
 *
 * 到期日「沒有直接存在卡上」,必須推算:效期 30 日,末日 = 有效起始日 + 29 天,
 * 有效起始日 = 啟用日(非零時)否則購買日。
 *
 * 為何不用 SFI3 rec2 [12..15]:實測那個欄位是「最後交易時間戳」(帶時分秒,每次刷卡
 * 都會變),並非到期日。舊版誤把它當 LE-unix 到期日解讀,導致到期日永遠顯示成讀卡當天。
 */
async function readTpass(transceive: Transceive): Promise<TpassInfo | undefined> {
    let response: number[];
    try {
        response = await transceive(READ_TPASS_PURCHASE_RECORD_APDU);
    } catch (error) {
        // A transient transceive failure (RF lost / collision) is retryable, so
        // surface it as FailedToReadCardError for the session retry loop. Do NOT
        // swallow it as "no TPASS" — that would silently misreport a card that
        // actually carries a 定期票 whenever the read is interrupted.
        throw new FailedToReadCardError();
    }

    // A definitive card response (non-9000 status) means this card genuinely has
    // no TPASS — report that rather than retrying.
    if (!isStatusOk(response)) {
        return undefined;
    }

    const data = dataOf(response);
    const purchaseDate = parseTransitDate(data, 4);
    if (!purchaseDate) {
        // SFI5 rec1 全零 / 購買日欄位為空 → 這張卡沒有月票。
        return undefined;
    }

    // 有效起始日:有獨立啟用日就用啟用日,否則「購買即啟用」用購買日。
    const startDate = parseTransitDate(data, 6) ?? purchaseDate;
    const expiryDate = addDays(startDate, TPASS_VALID_DAYS - 1);

    return { purchaseDate, expiryDate };
}

/**
 * Reads card number, balance and (optionally) TPASS expiry from an EasyCard chip
 * card via the applet. Throws {@link EasyCardAppletUnavailableError} when the card has no
 * EasyCard applet (so the caller can fall back to the MIFARE Classic path) and
 * {@link FailedToReadCardError} on transient/garbled reads (so it can be retried).
 */
export async function readEasyCardChip(
    transceive: Transceive,
): Promise<EasyCardChipData> {
    let selectResponse: number[];
    try {
        selectResponse = await transceive(SELECT_APPLET_APDU);
    } catch (error) {
        throw new FailedToReadCardError();
    }

    if (!isStatusOk(selectResponse)) {
        throw new EasyCardAppletUnavailableError();
    }

    let mainResponse: number[];
    try {
        mainResponse = await transceive(GET_CARD_DATA_APDU);
    } catch (error) {
        // A transient transceive failure (RF lost / collision) is retryable,
        // so surface it as FailedToReadCardError for the session retry loop.
        throw new FailedToReadCardError();
    }
    if (!isStatusOk(mainResponse)) {
        throw new FailedToReadCardError();
    }

    const data = dataOf(mainResponse);
    if (data.length < 41) {
        throw new FailedToReadCardError();
    }

    const tpass = await readTpass(transceive);

    return {
        number: parseEasyCardNumber(data),
        balance: parseEasyCardBalance(data),
        tpass,
    };
}
