export class KeyServerNotSetError extends Error {
    constructor() {
        super('尚未設定金鑰來源');
    }
}
