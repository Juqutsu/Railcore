-- AlterTable
ALTER TABLE "GuildConfig" ADD COLUMN     "applicationsOpen" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "ticketPanelChannelId" TEXT,
ADD COLUMN     "ticketPanelMessageId" TEXT;
