-- AlterTable
ALTER TABLE "GuildConfig" ADD COLUMN     "leaveChannelId" TEXT,
ADD COLUMN     "leaveMessage" TEXT,
ADD COLUMN     "welcomeChannelId" TEXT,
ADD COLUMN     "welcomeMessage" TEXT;
