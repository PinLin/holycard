export class MissingNecessaryKeysError extends Error {
    constructor() {
        super('缺少必要的金鑰');
    }
}
