import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    NotFoundException,
    Param,
    Put,
    UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Card, CardSector } from '@prisma/client';
import { CardService } from './card.service';
import { UpsertCardSectorDto } from './dto/upsert-card-sector.dto';
import { UpsertCardDto } from './dto/upsert-card.dto';
import { CardNotExistedException } from './exception/card-not-existed.exception';
import { ManagerGuard } from './guard/manager.guard';

@Controller('card')
export class CardController {
    constructor(private readonly cardService: CardService) {}

    @Put()
    @UseGuards(ManagerGuard)
    async upsertCard(@Body() payload: UpsertCardDto): Promise<Card> {
        payload.uid = payload.uid.toUpperCase();

        const card = await this.cardService.upsertCard(payload);
        return card;
    }

    @Get()
    @UseGuards(ManagerGuard)
    async findAllCards(): Promise<{ result: Card[] }> {
        const cards = await this.cardService.findAllCards();
        return { result: cards };
    }

    @Get(':uid')
    @UseGuards(ThrottlerGuard)
    async findCard(@Param('uid') uid: string) {
        try {
            uid = uid.toUpperCase();

            const card = await this.cardService.findCard(uid);
            return card;
        } catch (error) {
            if (error instanceof CardNotExistedException) {
                throw new NotFoundException('This card is not existed.');
            } else {
                throw error;
            }
        }
    }

    @Delete(':uid')
    @UseGuards(ManagerGuard)
    @HttpCode(HttpStatus.NO_CONTENT)
    async deleteCard(@Param('uid') uid: string): Promise<void> {
        try {
            uid = uid.toUpperCase();

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
    @UseGuards(ManagerGuard)
    async upsertCardSector(
        @Param('uid') uid: string,
        @Param('sectorIndex') sectorIndex: number,
        @Body() payload: UpsertCardSectorDto,
    ): Promise<CardSector> {
        try {
            uid = uid.toUpperCase();
            payload.keyA = payload.keyA?.toUpperCase();
            payload.keyB = payload.keyB?.toUpperCase();

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
