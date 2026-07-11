export class EasyCardAppletUnavailableError extends Error {
    constructor() {
        super('卡片沒有悠遊卡 applet');
    }
}
