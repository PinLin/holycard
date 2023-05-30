import nfcManager, { NfcTech } from 'react-native-nfc-manager';
import { FailedToReadCardException } from '../exception/failed-to-read-card.exception';

export class NfcService {
    async init() {
        await nfcManager.start();
    }

    async requestMifareClassic(handler: () => any): Promise<void> {
        // 避免重複請求，先嘗試取消還沒被滿足的請求
        try {
            await nfcManager.cancelTechnologyRequest();
        } catch (err) {}

        try {
            await nfcManager.requestTechnology(NfcTech.MifareClassic);
            await handler();
        } finally {
            await nfcManager.cancelTechnologyRequest();
        }
    }

    async readCardUid(): Promise<string> {
        const tag = await nfcManager.getTag();
        const uid = tag!.id!;
        console.log(`UID: ${uid}`);
        return uid;
    }

    convertKey(keyHexString: string): number[] {
        const result = [] as number[];
        for (let i = 0; i < keyHexString.length; i += 2) {
            result.push(parseInt(keyHexString.slice(i, i + 2), 16));
        }
        return result;
    }

    async readCardBalance(sector2KeyA: string): Promise<number> {
        // 如果讀取失敗就重試，至多十次
        for (let i = 0; i < 10; i++) {
            try {
                await nfcManager.mifareClassicHandlerAndroid.mifareClassicAuthenticateA(
                    2,
                    this.convertKey(sector2KeyA),
                );
            } catch {
                continue;
            }

            const block8 =
                await nfcManager.mifareClassicHandlerAndroid.mifareClassicReadBlock(
                    8 as any,
                );
            if (block8.length != 16) {
                continue;
            }

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

        throw new FailedToReadCardException();
    }

    async readCardKuoKuangPoints(sector11KeyA: string): Promise<number> {
        // 如果讀取失敗就重試，至多十次
        for (let i = 0; i < 10; i++) {
            try {
                await nfcManager.mifareClassicHandlerAndroid.mifareClassicAuthenticateA(
                    11,
                    this.convertKey(sector11KeyA),
                );
            } catch {
                continue;
            }

            const block44 =
                await nfcManager.mifareClassicHandlerAndroid.mifareClassicReadBlock(
                    44 as any,
                );
            if (block44.length != 16) {
                continue;
            }

            const block46 =
                await nfcManager.mifareClassicHandlerAndroid.mifareClassicReadBlock(
                    46 as any,
                );
            if (block46.length != 16) {
                continue;
            }

            const points = block44[4] - block46[0];
            console.log(`KuoKuangPoints: ${points}`);
            return points;
        }

        throw new FailedToReadCardException();
    }

    async readAllPassInfo(
        sector7KeyA: string,
        sector8KeyA: string,
    ): Promise<{ purchaseDateString: string | null; expiryDateString: string | null }> {
        // 如果讀取失敗就重試，至多十次
        for (let i = 0; i < 10; i++) {
            try {
                await nfcManager.mifareClassicHandlerAndroid.mifareClassicAuthenticateA(
                    7,
                    this.convertKey(sector7KeyA),
                );
            } catch {
                continue;
            }

            const block28 =
                await nfcManager.mifareClassicHandlerAndroid.mifareClassicReadBlock(
                    28 as any,
                );
            if (block28.length != 16) {
                continue;
            }

            const block29 =
                await nfcManager.mifareClassicHandlerAndroid.mifareClassicReadBlock(
                    29 as any,
                );
            if (block29.length != 16) {
                continue;
            }

            const block30 =
                await nfcManager.mifareClassicHandlerAndroid.mifareClassicReadBlock(
                    30 as any,
                );
            if (block30.length != 16) {
                continue;
            }

            try {
                await nfcManager.mifareClassicHandlerAndroid.mifareClassicAuthenticateA(
                    8,
                    this.convertKey(sector8KeyA),
                );
            } catch {
                continue;
            }

            const block33 =
                await nfcManager.mifareClassicHandlerAndroid.mifareClassicReadBlock(
                    33 as any,
                );
            if (block33.length != 16) {
                continue;
            }

            const block34 =
                await nfcManager.mifareClassicHandlerAndroid.mifareClassicReadBlock(
                    34 as any,
                );
            if (block34.length != 16) {
                continue;
            }

            let purchaseDateString = null;
            let expiryDateString = null;

            const parseDate = (data1: number, data2: number) => {
                const year = Math.floor(data2 / 2) + 1980;
                const month = Math.floor(data1 / 32) + (data2 % 2) * 8;
                const day = data1 % 32;
                return new Date(`${year}/${month}/${day}`);
            };

            if (block28[1] > 0 && block28[2] > 0) {
                const purchaseDate = parseDate(block28[1], block28[2]);

                const year = purchaseDate.getFullYear();
                const month = (purchaseDate.getMonth() + 1).toString().padStart(2, '0');
                const day = purchaseDate.getDate().toString().padStart(2, '0');
                purchaseDateString = `${year}/${month}/${day}`;

                let data1 = block29[1];
                let data2 = block29[2];
                if (block30[1] >= data1 && block30[2] >= data2) {
                    data1 = block30[1];
                    data2 = block30[2];
                }
                if (block33[1] >= data1 && block33[2] >= data2) {
                    data1 = block33[1];
                    data2 = block33[2];
                }
                if (block34[1] >= data1 && block34[2] >= data2) {
                    data1 = block34[1];
                    data2 = block34[2];
                }
                if (data1 >= block28[1] && data2 >= block28[2]) {
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

            console.log(`AllPassPurchaseDate: ${purchaseDateString}`);
            console.log(`AllPassExpiryDate: ${expiryDateString}`);
            return { purchaseDateString, expiryDateString };
        }

        throw new FailedToReadCardException();
    }
}
