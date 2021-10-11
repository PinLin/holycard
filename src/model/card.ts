export interface Card {
    uid: string,
    name: string,
    type: 'ipass' | 'easycard' | unknown,
    keys: Key[],
}

export interface Key {
    key: string,
    type: string,
}
