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
import { Card, CardSector } from '@prisma/client';
import { CardService } from './card.service';
import { UpsertCardSectorDto } from './dto/upsert-card-sector.dto';
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

    @Put(':uid/sector/:sectorIndex')
    async upsertCardSector(
        @Param('uid') uid: string,
        @Param('sectorIndex') sectorIndex: number,
        @Body() payload: UpsertCardSectorDto,
    ): Promise<CardSector> {
        try {
            const cardSector = await this.cardService.upsertCardSector(
                uid,
                sectorIndex,
                payload,
            );
            return cardSector;
        } catch (error) {
            if (error instanceof CardNotExistedException) {
                throw new NotFoundException('This card is not existed.');
            } else {
                throw error;
            }
        }
    }
}
