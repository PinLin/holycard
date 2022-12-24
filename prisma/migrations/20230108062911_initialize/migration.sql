-- CreateEnum
CREATE TYPE "CardType" AS ENUM ('UNKNOWN', 'HAPPY_CASH', 'EASY_CARD', 'I_PASS');

-- CreateTable
CREATE TABLE "Card" (
    "uid" TEXT NOT NULL,
    "type" "CardType" NOT NULL DEFAULT 'UNKNOWN',
    "name" TEXT NOT NULL,
    "comment" TEXT NOT NULL,

    CONSTRAINT "Card_pkey" PRIMARY KEY ("uid")
);
