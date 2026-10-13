import * as Keychain from 'react-native-keychain';
import { Card } from '../types';
import { CardUnavailableError } from '../error/cardUnavailableError';
import { KeyServerNotSetError } from '../error/keyServerNotSetError';
import { loadKeyServerUrl } from './settingsStorage';

// 快取依伺服器分開，換伺服器時不會讀到別台的舊金鑰。
function getCacheService(serverUrl: string, uid: string) {
    return `card:${serverUrl}:${uid}`;
}

async function fetchCard(serverUrl: string, uid: string): Promise<Card> {
    const response = await fetch(`${serverUrl}/${uid}`);
    if (!response.ok) {
        throw new CardUnavailableError();
    }

    return response.json();
}

async function storeCard(serverUrl: string, card: Card) {
    const service = getCacheService(serverUrl, card.uid);
    return Keychain.setGenericPassword(service, JSON.stringify(card), {
        service,
        accessible: Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK,
    });
}

export async function getCard(uid: string): Promise<Card> {
    const serverUrl = await loadKeyServerUrl();
    if (!serverUrl) {
        throw new KeyServerNotSetError();
    }
    const credential = await Keychain.getGenericPassword({
        service: getCacheService(serverUrl, uid),
    });

    if (credential) {
        fetchCard(serverUrl, uid)
            .then((card) => storeCard(serverUrl, card))
            .catch(() => {});

        return JSON.parse(credential.password) as Card;
    }

    const card = await fetchCard(serverUrl, uid);
    await storeCard(serverUrl, card);

    return card;
}
