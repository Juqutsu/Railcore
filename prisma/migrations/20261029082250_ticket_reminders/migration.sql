-- AlterTable
ALTER TABLE "GuildConfig" ADD COLUMN     "ticketAutoCloseHours" INTEGER NOT NULL DEFAULT 24,
ADD COLUMN     "ticketReminderHours" INTEGER NOT NULL DEFAULT 24;

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "remindedAt" TIMESTAMP(3),
ADD COLUMN     "reminderMessageId" TEXT;
