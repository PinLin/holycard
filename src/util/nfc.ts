import nfcManager, { NfcTech } from 'react-native-nfc-manager';

export const nfcUtil = {
    init() {
        return nfcManager.start();
    },
    async startRequestMifareClassic() {
        const tech = await nfcManager.requestTechnology(NfcTech.MifareClassic);
        if (tech !== NfcTech.MifareClassic) {
            throw "不支援此卡片";
        };
    },
    stopRequestMifareClassic() {
        return nfcManager.cancelTechnologyRequest();
    },
    async getCardUid() {
        const tag = await nfcManager.getTag();
        const uid = tag?.id as unknown as string;
        console.log(`UID: ${uid}`);
        return uid;
    },
}
