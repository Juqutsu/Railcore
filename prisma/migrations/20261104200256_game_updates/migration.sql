-- AlterTable
ALTER TABLE "GuildConfig" ADD COLUMN     "gameUpdateAnnouncedAt" TIMESTAMP(3),
ADD COLUMN     "gameUpdateChannelId" TEXT,
ADD COLUMN     "gameUpdateMessage" TEXT,
ADD COLUMN     "gameUpdatePingRoleId" TEXT,
ADD COLUMN     "gameUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "gameUpdatesOn" BOOLEAN NOT NULL DEFAULT false;
