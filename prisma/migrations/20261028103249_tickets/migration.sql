-- CreateEnum
CREATE TYPE "TicketType" AS ENUM ('SUPPORT', 'BUG_REPORT', 'APPLICATION');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DENIED');

-- AlterTable
ALTER TABLE "GuildConfig" ADD COLUMN     "ticketCounter" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Ticket" (
    "id" SERIAL NOT NULL,
    "guildId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "type" "TicketType" NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "openerId" TEXT NOT NULL,
    "channelId" TEXT,
    "answers" JSONB NOT NULL,
    "openKey" TEXT,
    "claimedById" TEXT,
    "closedById" TEXT,
    "closeReason" TEXT,
    "appStatus" "ApplicationStatus",
    "reviewedById" TEXT,
    "reviewReason" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_channelId_key" ON "Ticket"("channelId");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_openKey_key" ON "Ticket"("openKey");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_guildId_number_key" ON "Ticket"("guildId", "number");
