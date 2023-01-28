import { Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_PIPE } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CardModule } from './card/card.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
    imports: [
        CardModule,
        PrismaModule,
        ThrottlerModule.forRoot({
            ttl: 20,
            limit: 10,
        }),
        ConfigModule.forRoot({
            isGlobal: true,
        }),
    ],
    controllers: [AppController],
    providers: [
        AppService,
        {
            provide: APP_PIPE,
            useValue: new ValidationPipe({ whitelist: true, transform: true }),
        },
    ],
})
export class AppModule {}
