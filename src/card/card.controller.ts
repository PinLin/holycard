import {
    Body,
    Controller,
    Delete,
    HttpCode,
    HttpStatus,
    NotFoundException,
    Param,
    Put,
} from '@nestjs/common';
import { Card } from '@prisma/client';
import { CardService } from './card.service';
import { UpsertCardDto } from './dto/upsert-card.dto';
import { CardNotExistedException } from './exception/card-not-existed.exception';

@Controller('card')
export class CardController {
    constructor(private readonly cardService: CardService) {}

    @Put()
    async upsertCard(@Body() payload: UpsertCardDto): Promise<Card> {
        const card = await this.cardService.upsertCard(payload);
        return card;
    }

    @Delete(':uid')
    @HttpCode(HttpStatus.NO_CONTENT)
    async deleteCard(@Param('uid') uid: string): Promise<void> {
        try {
            await this.cardService.deleteCard(uid);
        } catch (error) {
            if (error instanceof CardNotExistedException) {
                throw new NotFoundException('This card is not existed.');
            } else {
                throw error;
            }
        }
    }
}
