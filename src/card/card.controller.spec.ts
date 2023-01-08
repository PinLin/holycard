import { Test, TestingModule } from '@nestjs/testing';
import { CardType } from '@prisma/client';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { CardController } from './card.controller';
import { CardService } from './card.service';
import { UpsertCardDto } from './dto/upsert-card.dto';

describe('CardController', () => {
    let controller: CardController;
    let cardService: DeepMockProxy<CardService>;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [CardController],
            providers: [
                { provide: CardService, useValue: mockDeep<CardService>() },
            ],
        }).compile();

        controller = module.get<CardController>(CardController);
        cardService = module.get(CardService);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    it('should upsert a card', async () => {
        const payload: UpsertCardDto = {
            uid: '12345678',
            type: CardType.EASY_CARD,
            name: '9122 0000 0000 0000',
            comment: 'testing',
        };
        cardService.upsertCard.mockResolvedValueOnce(payload);

        const card = await controller.upsertCard(payload);
        expect(card).toEqual(payload);
    });
});
