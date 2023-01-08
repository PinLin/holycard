import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Card, CardType } from '@prisma/client';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { CardController } from './card.controller';
import { CardService } from './card.service';
import { UpsertCardDto } from './dto/upsert-card.dto';
import { CardNotExistedException } from './exception/card-not-existed.exception';

describe('CardController', () => {
    let controller: CardController;
    let cardService: DeepMockProxy<CardService>;

    const sampleCard: Card = {
        uid: '12345678',
        type: CardType.EASY_CARD,
        name: '9122 0000 0000 0000',
        comment: 'testing',
        createdTime: new Date(),
    };

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
            ...sampleCard,
        };
        cardService.upsertCard.mockResolvedValueOnce(sampleCard);

        const card = await controller.upsertCard(payload);
        expect(card).toEqual(sampleCard);
    });

    it('should delete the card', async () => {
        const { uid } = sampleCard;
        cardService.deleteCard.mockResolvedValueOnce();

        await expect(controller.deleteCard(uid)).resolves.not.toThrowError();
    });

    it('should throw a exception because deleting a card that non-existing', async () => {
        const { uid } = sampleCard;
        cardService.deleteCard.mockImplementation(() => {
            throw new CardNotExistedException();
        });

        await expect(controller.deleteCard(uid)).rejects.toThrowError(
            NotFoundException,
        );
    });
});
