export interface Card {
    uid: string;
    type: CardType;
    number: string;
    nickname: string;
    is_kuokuang_card: boolean;
    sectors: CardSector[];
}

export enum CardType {
    UNKNOWN = 'UNKNOWN',
    HAPPY_CASH = 'HAPPY_CASH',
    EASY_CARD = 'EASY_CARD',
    I_PASS = 'I_PASS',
}

export interface CardSector {
    index: number;
    keyA: string | null;
    keyB: string | null;
}
