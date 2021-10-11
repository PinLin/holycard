export interface Card {
    uid: string,
    name: string,
    type: CardType,
    keys: CardKey[],
}

export enum CardType {
    IPass = 'ipass',
    EasyCard = 'easycard',
    Unknown = 'unknown',
}

export interface CardKey {
    key: string,
    type: string,
}
