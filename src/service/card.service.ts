import { Card } from '../model/card.model';
import { CardUnavailableException } from '../exception/card-unavailable.exception';

export class CardService {
    async getCard(uid: string): Promise<Card> {
        const response = await fetch(`https://card.pinlin.me/card/${uid}`);
        if (!response.ok) {
            throw new CardUnavailableException();
        }
        return response.json();
    }
}
