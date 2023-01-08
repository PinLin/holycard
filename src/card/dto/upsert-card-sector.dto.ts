import { IsOptional, IsString, Length } from 'class-validator';

export class UpsertCardSectorDto {
    @IsString()
    @IsOptional()
    @Length(12)
    keyA?: string;

    @IsString()
    @IsOptional()
    @Length(12)
    keyB?: string;
}
