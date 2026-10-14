export class CardLostError extends Error {
    constructor() {
        super('卡片已離開');
    }
}
