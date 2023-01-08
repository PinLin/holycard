import { CardType } from '@prisma/client';
import {
    IsEnum,
    IsNotEmpty,
    IsString,
    Length,
    MaxLength,
} from 'class-validator';

export class UpsertCardDto {
    @IsString()
    @IsNotEmpty()
    @Length(8)
    uid: string;

    @IsEnum(CardType)
    type: CardType;

    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    name: string;

    @IsString()
    @MaxLength(100)
    comment: string;
}
