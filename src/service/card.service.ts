import * as Keychain from 'react-native-keychain';
import { Card } from '../model/card.model';
import { CardUnavailableException } from '../exception/card-unavailable.exception';

export class CardService {
    async fetchCard(uid: string): Promise<Card> {
        const response = await fetch(`https://card.pinlin.me/card/${uid}`);
        if (!response.ok) {
            throw new CardUnavailableException();
        }
        return response.json();
    }

    async storeCard(card: Card) {
        return Keychain.setGenericPassword(
            `card:${card.uid}`,
            JSON.stringify(card),
            {
                service: `card:${card.uid}`,
                accessible: Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK,
            },
        );
    }

    async getCard(uid: string): Promise<Card> {
        let credential = await Keychain.getGenericPassword({
            service: `card:${uid}`,
        });
        if (credential) {
            this.fetchCard(uid)
                .then((card) => this.storeCard(card))
                .catch(() => {});
            return JSON.parse(credential.password) as Card;
        } else {
            const card = await this.fetchCard(uid);
            await this.storeCard(card);
            return card;
        }
    }
}
