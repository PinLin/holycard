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
        const key = this.convertKey(sector2KeyA);

        // 如果讀取失敗就重試，至多十次
        for (let i = 0; i < 10; i++) {
            try {
                await nfcManager.mifareClassicHandlerAndroid.mifareClassicAuthenticateA(
                    2,
                    key,
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
        const key = this.convertKey(sector11KeyA);

        // 如果讀取失敗就重試，至多十次
        for (let i = 0; i < 10; i++) {
            try {
                await nfcManager.mifareClassicHandlerAndroid.mifareClassicAuthenticateA(
                    11,
                    key,
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
}
