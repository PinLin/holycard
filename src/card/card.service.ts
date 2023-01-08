import { Injectable } from '@nestjs/common';
import { Card } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertCardDto } from './dto/upsert-card.dto';

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
}
