import { FailedToReadCardError } from '../error/failedToReadCardError';
import { IcashUnavailableError } from '../error/icashUnavailableError';

/**
 * Reads icash 2.0 cards through their MIFARE DESFire EV1 (ISO14443-4 / IsoDep)
 * command set, using the same IsoDep `transceive` injection point as the
 * EasyCard applet path (`easyCardApplet.ts`).
 *
 * icash 2.0 is a DESFire EV1 card, so status words are `91 00` (success) /
 * `91 AF` (additional frame) — NOT the ISO7816 `90 00` used by the EasyCard
 * applet. Card number and balance both fit in a single frame, so `91 AF`
 * never needs to be handled here. This module stays free of any native
 * (`react-native-nfc-manager`) imports so it can be unit tested without
 * hardware — the caller injects a `Transceive`.
 */

/** icash 2.0 DESFire application identifier (3 bytes, sent as-is, not reversed). */
export const ICASH_AID = [0x11, 0x87, 0x16];

/** SELECT the icash 2.0 DESFire application by AID. */
export const SELECT_ICASH_AID_APDU = [
    0x90, 0x5a, 0x00, 0x00, 0x03, ...ICASH_AID, 0x00,
];

/** ReadData on file 03 — returns the 8-byte BCD card number. */
export const READ_ICASH_CARDNO_APDU = [
    0x90, 0xbd, 0x00, 0x00, 0x07, 0x03, 0x00, 0x00, 0x00, 0x08, 0x00, 0x00,
    0x00,
];

/** GetValue on file 06 — returns the 4-byte little-endian signed balance. */
export const GET_ICASH_BALANCE_APDU = [0x90, 0x6c, 0x00, 0x00, 0x01, 0x06, 0x00];

export type Transceive = (apdu: number[]) => Promise<number[]>;

function isStatusOk(response: number[]): boolean {
    return (
        response.length >= 2 &&
        response[response.length - 2] === 0x91 &&
        response[response.length - 1] === 0x00
    );
}

/** Strips the trailing SW1/SW2 status word, leaving just the data bytes. */
function dataOf(response: number[]): number[] {
    return response.slice(0, -2);
}

/**
 * Card number = 8 data bytes as BCD, grouped into four 4-digit blocks.
 * e.g. `75 11 17 01 73 01 06 54` -> `7511 1701 7301 0654`.
 */
export function parseIcashNumber(data: number[]): string {
    const digits = data
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');

    return digits.replace(/(.{4})(.{4})(.{4})(.{4})/, '$1 $2 $3 $4');
}

/**
 * Balance = 4 data bytes as a little-endian signed int32, unit NT$.
 * e.g. `EF FF FF FF` -> `-17`. Confirmed against a real card: the app shows
 * -17 for it, matching 0xFFFFFFEF read as a SIGNED int32 (an unsigned reading
 * would be ~4.29e9), so signed / 元 is correct — icash balances can go negative.
 */
export function parseIcashBalance(data: number[]): number {
    return (data[3] << 24) | (data[2] << 16) | (data[1] << 8) | data[0];
}

/**
 * Reads card number and balance from an icash 2.0 card via its DESFire
 * application. Throws {@link IcashUnavailableError} when the card has no
 * icash 2.0 application (so the caller can fall back to other read paths)
 * and {@link FailedToReadCardError} on transient/garbled reads.
 */
export async function readIcashCard(
    transceive: Transceive,
): Promise<{ number: string; balance: number }> {
    let selectResponse: number[];
    try {
        selectResponse = await transceive(SELECT_ICASH_AID_APDU);
    } catch (error) {
        throw new FailedToReadCardError();
    }

    if (!isStatusOk(selectResponse)) {
        throw new IcashUnavailableError();
    }

    let cardNoResponse: number[];
    try {
        cardNoResponse = await transceive(READ_ICASH_CARDNO_APDU);
    } catch (error) {
        throw new FailedToReadCardError();
    }
    if (!isStatusOk(cardNoResponse)) {
        throw new FailedToReadCardError();
    }
    const cardNoData = dataOf(cardNoResponse);
    if (cardNoData.length < 8) {
        throw new FailedToReadCardError();
    }

    let balanceResponse: number[];
    try {
        balanceResponse = await transceive(GET_ICASH_BALANCE_APDU);
    } catch (error) {
        throw new FailedToReadCardError();
    }
    if (!isStatusOk(balanceResponse)) {
        throw new FailedToReadCardError();
    }
    const balanceData = dataOf(balanceResponse);
    if (balanceData.length < 4) {
        throw new FailedToReadCardError();
    }

    return {
        number: parseIcashNumber(cardNoData),
        balance: parseIcashBalance(balanceData),
    };
}
