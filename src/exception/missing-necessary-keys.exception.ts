export class MissingNecessaryKeysException extends Error {
    constructor() {
        super('缺少必要的金鑰');
    }
}
