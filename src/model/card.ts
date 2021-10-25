export interface Card {
    uid: string,
    name: string,
    type: CardType,
    keys: CardKey[],
}

export enum CardType {
    IPass = 'ipass',
    EasyCard = 'easycard',
    HappyCash = 'happycash',
    Unknown = 'unknown',
}

export interface CardKey {
    key: string,
    type: string,
}
