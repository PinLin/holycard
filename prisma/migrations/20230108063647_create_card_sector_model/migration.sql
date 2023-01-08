-- CreateTable
CREATE TABLE "CardSector" (
    "cardUid" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "keyA" TEXT,
    "keyB" TEXT,

    CONSTRAINT "CardSector_pkey" PRIMARY KEY ("cardUid","index")
);

-- AddForeignKey
ALTER TABLE "CardSector" ADD CONSTRAINT "CardSector_cardUid_fkey" FOREIGN KEY ("cardUid") REFERENCES "Card"("uid") ON DELETE RESTRICT ON UPDATE CASCADE;
