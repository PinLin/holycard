import nfcManager, { NfcTech } from 'react-native-nfc-manager';
import { FailedToReadCardException } from '../exception/failed-to-read-card.exception';
import { Card } from '../model/card.model';
import { MissingNecessaryKeysException } from '../exception/missing-necessary-keys.exception';
import { InvalidKeysException } from '../exception/invalid-keys.exception';

export class NfcService {
    constructor() {
        nfcManager.start();
    }

    async requestMifareClassic(handler: (uid: string) => any): Promise<void> {
        // 避免重複請求，先嘗試取消還沒被滿足的請求
        try {
            await nfcManager.cancelTechnologyRequest();
        } catch (err) {}

        try {
            await nfcManager.requestTechnology(NfcTech.MifareClassic);

            const tag = await nfcManager.getTag();
            const uid = tag!.id!;

            // 如果讀取失敗就重試，至多十次
            let i = 0;
            while (i < 10) {
                try {
                    return await handler(uid);
                } catch (err) {
                    if (err instanceof FailedToReadCardException && i < 10) {
                        i++;
                    } else {
                        throw err;
                    }
                }
            }
        } finally {
            await nfcManager.cancelTechnologyRequest();
        }
    }

    private convertKey(keyHexString: string): number[] {
        const result = [] as number[];
        for (let i = 0; i < keyHexString.length; i += 2) {
            result.push(parseInt(keyHexString.slice(i, i + 2), 16));
        }
        return result;
    }

    private async authenticateWithKeyA(sector: number, keyA: string) {
        try {
            return await nfcManager.mifareClassicHandlerAndroid.mifareClassicAuthenticateA(
                sector,
                this.convertKey(keyA),
            );
        } catch (err) {
            if (
                (err as Error).message ===
                'mifareClassicAuthenticate fail: AUTH_FAIL'
            ) {
                throw new InvalidKeysException();
            }
        }
    }

    private async readBlock(block: number): Promise<number[]> {
        const data =
            (await nfcManager.mifareClassicHandlerAndroid.mifareClassicReadBlock(
                block as any,
            )) as number[];

        if (data.length !== 16) {
            throw new FailedToReadCardException();
        }

        return data;
    }

    async readBalance(card: Card): Promise<number> {
        const sector2KeyA = card.sectors.find((s) => s.index === 2)?.keyA;
        if (!sector2KeyA) {
            throw new MissingNecessaryKeysException();
        }

        await this.authenticateWithKeyA(2, sector2KeyA);
        const block8 = await this.readBlock(8);

        let balance = 0;
        for (let j = 0; j < 4; j++) {
            balance *= 256;
            balance += block8[3 - j];
        }
        if (balance >= 2147483648) {
            balance -= 2147483648 * 2;
        }
        return balance;
    }

    async readKuoKuangPoints(card: Card): Promise<number> {
        const sector11KeyA = card.sectors.find((s) => s.index === 11)?.keyA;
        if (!sector11KeyA) {
            throw new MissingNecessaryKeysException();
        }

        await this.authenticateWithKeyA(11, sector11KeyA);
        const block44 = await this.readBlock(44);
        const block46 = await this.readBlock(46);

        return block44[4] - block46[0];
    }

    async readTpassInfo(
        card: Card,
    ): Promise<{ purchaseDate: Date | null; expiryDate: Date | null }> {
        const sector3KeyA = card.sectors.find((s) => s.index === 3)?.keyA;
        const sector8KeyA = card.sectors.find((s) => s.index === 8)?.keyA;
        if (!sector3KeyA || !sector8KeyA) {
            throw new MissingNecessaryKeysException();
        }

        let purchaseDate: Date | null = null;
        let expiryDate: Date | null = null;

        const parseDate = (data1: number, data2: number) => {
            const year = Math.floor(data2 / 2) + 1980;
            const month = Math.floor(data1 / 32) + (data2 % 2) * 8;
            const day = data1 % 32;
            return new Date(`${year}-${month}-${day}`);
        };

        await this.authenticateWithKeyA(8, sector8KeyA);
        const block32 = await this.readBlock(32);

        if (block32[1] > 0 && block32[2] > 0) {
            purchaseDate = parseDate(block32[1], block32[2]);

            await this.authenticateWithKeyA(3, sector3KeyA);
            const block12 = await this.readBlock(12);

            if (block12[14] > 0 && block12[15] > 0) {
                expiryDate = parseDate(block12[14], block12[15]);
            }
        }

        return { purchaseDate, expiryDate };
    }
}
