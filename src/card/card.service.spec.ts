import { Test, TestingModule } from '@nestjs/testing';
import { CardType, PrismaClient } from '@prisma/client';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { PrismaService } from '../prisma/prisma.service';
import { CardService } from './card.service';
import { UpsertCardDto } from './dto/upsert-card.dto';

describe('CardService', () => {
    let service: CardService;
    let prisma: DeepMockProxy<PrismaClient>;

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
            uid: '12345678',
            type: CardType.EASY_CARD,
            name: '9122 0000 0000 0000',
            comment: 'testing',
        };
        prisma.card.upsert.mockResolvedValueOnce(payload);

        const card = await service.upsertCard(payload);
        expect(card).toEqual(payload);
    });
});
