-- AlterEnum
ALTER TYPE "TicketType" ADD VALUE 'PLAYER_REPORT';

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "reportedRobloxId" TEXT;

-- CreateIndex
CREATE INDEX "Ticket_guildId_reportedRobloxId_idx" ON "Ticket"("guildId", "reportedRobloxId");
