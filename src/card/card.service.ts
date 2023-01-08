import { Injectable } from '@nestjs/common';
import { Card } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
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

        await this.prisma.card.delete({ where: { uid } });
    }
}
