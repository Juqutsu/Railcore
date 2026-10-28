-- CreateEnum
CREATE TYPE "CaseAction" AS ENUM ('WARN', 'TIMEOUT', 'UNTIMEOUT', 'KICK', 'BAN', 'UNBAN', 'PURGE');

-- AlterTable
ALTER TABLE "GuildConfig" ADD COLUMN     "caseCounter" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "ModCase" (
    "id" SERIAL NOT NULL,
    "guildId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "action" "CaseAction" NOT NULL,
    "targetId" TEXT,
    "moderatorId" TEXT NOT NULL,
    "reason" TEXT,
    "durationSec" INTEGER,
    "channelId" TEXT,
    "messageCount" INTEGER,
    "clearedById" TEXT,
    "clearedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModCase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ModCase_guildId_targetId_idx" ON "ModCase"("guildId", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "ModCase_guildId_number_key" ON "ModCase"("guildId", "number");
