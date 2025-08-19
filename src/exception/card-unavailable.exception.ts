export class CardUnavailableException extends Error {
    constructor() {
        super('查無卡片資料');
    }
}
