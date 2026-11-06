-- AlterTable
ALTER TABLE "GuildConfig" ADD COLUMN     "giveawayBlockWarned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "giveawayBlockedRoleIds" TEXT[],
ADD COLUMN     "giveawayChannelId" TEXT,
ADD COLUMN     "giveawayHostRoleIds" TEXT[],
ADD COLUMN     "giveawayPingRoleId" TEXT,
ADD COLUMN     "giveawayWarnDays" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "giveawayWinnerCooldownDays" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Giveaway" (
    "id" SERIAL NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "messageId" TEXT,
    "hostId" TEXT NOT NULL,
    "prize" TEXT NOT NULL,
    "winnerCount" INTEGER NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "announcedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Giveaway_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GiveawayWinner" (
    "giveawayId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "wonAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GiveawayWinner_pkey" PRIMARY KEY ("giveawayId","userId")
);

-- CreateTable
CREATE TABLE "GiveawayEntry" (
    "giveawayId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GiveawayEntry_pkey" PRIMARY KEY ("giveawayId","userId")
);

-- CreateTable
CREATE TABLE "GiveawayBlock" (
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "addedById" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GiveawayBlock_pkey" PRIMARY KEY ("guildId","userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Giveaway_messageId_key" ON "Giveaway"("messageId");

-- CreateIndex
CREATE INDEX "Giveaway_endedAt_endsAt_idx" ON "Giveaway"("endedAt", "endsAt");

-- CreateIndex
CREATE INDEX "Giveaway_guildId_endedAt_idx" ON "Giveaway"("guildId", "endedAt");

-- CreateIndex
CREATE INDEX "GiveawayWinner_userId_wonAt_idx" ON "GiveawayWinner"("userId", "wonAt");

-- AddForeignKey
ALTER TABLE "GiveawayWinner" ADD CONSTRAINT "GiveawayWinner_giveawayId_fkey" FOREIGN KEY ("giveawayId") REFERENCES "Giveaway"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiveawayEntry" ADD CONSTRAINT "GiveawayEntry_giveawayId_fkey" FOREIGN KEY ("giveawayId") REFERENCES "Giveaway"("id") ON DELETE CASCADE ON UPDATE CASCADE;
