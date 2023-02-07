export class FailedToReadCardException extends Error {
    constructor() {
        super('讀取卡片失敗');
    }
}
