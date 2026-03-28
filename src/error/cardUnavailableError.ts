export class CardUnavailableError extends Error {
    constructor() {
        super('卡片資料不存在');
    }
}
