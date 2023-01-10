import { Test, TestingModule } from '@nestjs/testing';
import { Card, CardSector, CardType, PrismaClient } from '@prisma/client';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { PrismaService } from '../prisma/prisma.service';
import { CardService } from './card.service';
import { UpsertCardSectorDto } from './dto/upsert-card-sector.dto';
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
        tags: ['KuoKuangCard'],
        createdTime: new Date(),
    };
    const sampleCardSector: CardSector = {
        cardUid: sampleCard.uid,
        index: 0,
        keyA: '123456789012',
        keyB: null,
        createdTime: new Date(),
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

    it('should upsert the card sector', async () => {
        const { uid } = sampleCard;
        const { index: sectorIndex } = sampleCardSector;
        const payload: UpsertCardSectorDto = {
            keyA: sampleCardSector.keyA!,
        };
        prisma.card.findUnique.mockResolvedValueOnce(sampleCard);
        prisma.cardSector.upsert.mockResolvedValueOnce(sampleCardSector);

        const cardSector = await service.upsertCardSector(
            uid,
            sectorIndex,
            payload,
        );
        expect(cardSector).toEqual(sampleCardSector);
    });

    it('should fail to upsert a card sector because the card is not existing', async () => {
        const { uid } = sampleCard;
        const { index: sectorIndex } = sampleCardSector;
        const payload: UpsertCardSectorDto = {
            keyA: sampleCardSector.keyA!,
        };
        prisma.card.findUnique.mockResolvedValueOnce(null);

        await expect(
            service.upsertCardSector(uid, sectorIndex, payload),
        ).rejects.toThrowError(CardNotExistedException);
    });
});
