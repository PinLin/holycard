import nfcManager, { NfcTech } from 'react-native-nfc-manager';

export const nfcUtil = {
    init() {
        return nfcManager.start();
    },
    async requestMifareClassic(handler: () => void | Promise<void>) {
        try {
            await nfcManager.cancelTechnologyRequest();
        }
        catch (e) {
            console.log(e);
        }

        try {
            const tech = await nfcManager.requestTechnology(NfcTech.MifareClassic);
            if (tech != null) {
                if (tech != NfcTech.MifareClassic) {
                    throw "不支援此卡片";
                };
                await handler();
            } else {
                await this.requestMifareClassic(handler);
            }
        } catch (e) {
            console.log(e);
            throw e;
        } finally {
            await nfcManager.cancelTechnologyRequest();
        }
    },
    async getCardUid() {
        const tag = await nfcManager.getTag();
        const uid = tag?.id as unknown as string;
        console.log(`UID: ${uid}`);
        return uid;
    },
    convertKey(keyHexString: string) {
        const result = [] as number[];
        for (let i = 0; i < keyHexString.length; i += 2) {
            result.push(parseInt(keyHexString.slice(i, i + 2), 16));
        }
        return result;
    },
    async getCardBalance(key2A: number[]) {
        for (let i = 0; i < 10; i++) {
            try {
                await nfcManager.mifareClassicHandlerAndroid.mifareClassicAuthenticateA(2, key2A);
            } catch {
                continue;
            }

            const block8 = await nfcManager.mifareClassicHandlerAndroid.mifareClassicReadBlock(8 as any);
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
        throw "讀取卡片失敗";
    },
}
