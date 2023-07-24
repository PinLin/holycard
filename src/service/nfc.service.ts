import nfcManager, { NfcTech } from 'react-native-nfc-manager';
import { FailedToReadCardException } from '../exception/failed-to-read-card.exception';

export class NfcService {
    async init() {
        await nfcManager.start();
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
            console.log(`UID: ${uid}`);

            // 如果讀取失敗就重試，至多十次
            for (let i = 0; i < 10; i++) {
                try {
                    return await handler(uid);
                } catch {
                    continue;
                }
            }
            throw new FailedToReadCardException();
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
        return nfcManager.mifareClassicHandlerAndroid.mifareClassicAuthenticateA(
            sector,
            this.convertKey(keyA),
        );
    }

    private async readBlock(block: number): Promise<number[]> {
        const data = await nfcManager.mifareClassicHandlerAndroid.mifareClassicReadBlock(
            block as any,
        ) as number[];

        if (data.length != 16) throw new Error('Failed to read block');

        return data;
    }

    async readCardBalance(sector2KeyA: string): Promise<number> {
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

        console.log(`Balance: ${balance}`);
        return balance;
    }

    async readCardKuoKuangPoints(sector11KeyA: string): Promise<number> {
        await this.authenticateWithKeyA(11, sector11KeyA);
        const block44 = await this.readBlock(44);
        const block46 = await this.readBlock(46);

        const points = block44[4] - block46[0];

        console.log(`KuoKuangPoints: ${points}`);
        return points;
    }

    async readTPassInfo(
        sector8KeyA: string,
    ): Promise<{ purchaseDateString: string | null; expiryDateString: string | null }> {
        await this.authenticateWithKeyA(8, sector8KeyA);
        const block32 = await this.readBlock(32);
        const block33 = await this.readBlock(33);
        const block34 = await this.readBlock(34);

        let purchaseDateString = null;
        let expiryDateString = null;

        const parseDate = (data1: number, data2: number) => {
            const year = Math.floor(data2 / 2) + 1980;
            const month = Math.floor(data1 / 32) + (data2 % 2) * 8;
            const day = data1 % 32;
            return new Date(`${year}/${month}/${day}`);
        };

        if (block32[1] > 0 && block32[2] > 0) {
            const purchaseDate = parseDate(block32[1], block32[2]);

            const year = purchaseDate.getFullYear();
            const month = (purchaseDate.getMonth() + 1).toString().padStart(2, '0');
            const day = purchaseDate.getDate().toString().padStart(2, '0');
            purchaseDateString = `${year}/${month}/${day}`;

            let data1 = block33[1];
            let data2 = block33[2];
            if (block34[1] >= data1 && block34[2] >= data2) {
                data1 = block34[1];
                data2 = block34[2];
            }
            if (data1 >= block32[1] && data2 >= block32[2]) {
                const expiryDate = parseDate(data1, data2);
                expiryDate.setDate(expiryDate.getDate() + 29);

                const year = expiryDate.getFullYear();
                const month = (expiryDate.getMonth() + 1).toString().padStart(2, '0');
                const day = expiryDate.getDate().toString().padStart(2, '0');
                expiryDateString = `${year}/${month}/${day}`;
            } else if (data1 > 0 && data2 > 0) {
                const expiryDate = parseDate(data1, data2);
                expiryDate.setDate(expiryDate.getDate() + 59);

                const year = expiryDate.getFullYear();
                const month = (expiryDate.getMonth() + 1).toString().padStart(2, '0');
                const day = expiryDate.getDate().toString().padStart(2, '0');
                expiryDateString = `${year}/${month}/${day}`;
            }
        }

        console.log(`TPassPurchaseDate: ${purchaseDateString}`);
        console.log(`TPassExpiryDate: ${expiryDateString}`);
        return { purchaseDateString, expiryDateString };
    }
}
