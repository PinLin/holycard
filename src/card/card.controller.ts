import { Body, Controller, Put } from '@nestjs/common';
import { Card } from '@prisma/client';
import { CardService } from './card.service';
import { UpsertCardDto } from './dto/upsert-card.dto';

@Controller('card')
export class CardController {
    constructor(private readonly cardService: CardService) {}

    @Put()
    async upsertCard(@Body() payload: UpsertCardDto): Promise<Card> {
        const card = await this.cardService.upsertCard(payload);
        return card;
    }
}
