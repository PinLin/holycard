export class CardNotExistedException extends Error {
    constructor() {
        super('This card is not existed.');
    }
}
