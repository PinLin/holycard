import * as Keychain from 'react-native-keychain';
import { Card } from '../types';
import { CardUnavailableError } from '../error/cardUnavailableError';

async function fetchCard(uid: string): Promise<Card> {
    const response = await fetch(`https://card.pinlin.me/card/${uid}`);
    if (!response.ok) {
            throw new CardUnavailableError();
    }

    return response.json();
}

async function storeCard(card: Card) {
    return Keychain.setGenericPassword(`card:${card.uid}`, JSON.stringify(card), {
        service: `card:${card.uid}`,
        accessible: Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK,
    });
}

export async function getCard(uid: string): Promise<Card> {
    const credential = await Keychain.getGenericPassword({
        service: `card:${uid}`,
    });

    if (credential) {
        fetchCard(uid)
            .then((card) => storeCard(card))
            .catch(() => {});

        return JSON.parse(credential.password) as Card;
    }

    const card = await fetchCard(uid);
    await storeCard(card);

    return card;
}
