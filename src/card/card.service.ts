import { Injectable } from '@nestjs/common';
import { Card, CardSector } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertCardSectorDto } from './dto/upsert-card-sector.dto';
import { UpsertCardDto } from './dto/upsert-card.dto';
import { CardNotExistedException } from './exception/card-not-existed.exception';

@Injectable()
export class CardService {
    constructor(private readonly prisma: PrismaService) {}

    async upsertCard(payload: UpsertCardDto): Promise<Card> {
        return await this.prisma.card.upsert({
            where: { uid: payload.uid },
            update: payload,
            create: payload,
        });
    }

    async deleteCard(uid: string): Promise<void> {
        const card = await this.prisma.card.findUnique({ where: { uid } });
        if (!card) throw new CardNotExistedException();

        await this.prisma.$transaction([
            this.prisma.cardSector.deleteMany({ where: { cardUid: uid } }),
            this.prisma.card.delete({ where: { uid } }),
        ]);
    }

    async upsertCardSector(
        uid: string,
        sectorIndex: number,
        payload: UpsertCardSectorDto,
    ): Promise<CardSector> {
        const card = await this.prisma.card.findUnique({ where: { uid } });
        if (!card) throw new CardNotExistedException();

        return await this.prisma.cardSector.upsert({
            where: { cardUid_index: { cardUid: uid, index: sectorIndex } },
            create: { ...payload, cardUid: uid, index: sectorIndex },
            update: payload,
        });
    }
}
