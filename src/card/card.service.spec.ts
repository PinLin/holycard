import { Test, TestingModule } from '@nestjs/testing';
import { Card, CardType, PrismaClient } from '@prisma/client';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { PrismaService } from '../prisma/prisma.service';
import { CardService } from './card.service';
import { UpsertCardDto } from './dto/upsert-card.dto';
import { CardNotExistedException } from './exception/card-not-existed.exception';

describe('CardService', () => {
    let service: CardService;
    let prisma: DeepMockProxy<PrismaClient>;

    const sampleCard: Card = {
        uid: '12345678',
        type: CardType.EASY_CARD,
        name: '9122 0000 0000 0000',
        comment: 'testing',
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                CardService,
                { provide: PrismaService, useValue: mockDeep<PrismaClient>() },
            ],
        }).compile();

        service = module.get<CardService>(CardService);
        prisma = module.get(PrismaService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    it('should upsert a card', async () => {
        const payload: UpsertCardDto = {
            ...sampleCard,
        };
        prisma.card.upsert.mockResolvedValueOnce(sampleCard);

        const card = await service.upsertCard(payload);
        expect(card).toEqual(sampleCard);
    });

    it('should delete the card', async () => {
        const { uid } = sampleCard;
        prisma.card.findUnique.mockResolvedValueOnce(sampleCard);
        prisma.card.delete.mockResolvedValueOnce(sampleCard);

        await expect(service.deleteCard(uid)).resolves.not.toThrowError();
    });

    it('should fail to delete a card that non-existing', async () => {
        const { uid } = sampleCard;
        prisma.card.findUnique.mockResolvedValueOnce(null);

        await expect(service.deleteCard(uid)).rejects.toThrowError(
            CardNotExistedException,
        );
    });
});
