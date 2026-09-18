export class IcashUnavailableError extends Error {
    constructor() {
        super('卡片沒有 icash 2.0 applet');
    }
}
