-- AlterTable
ALTER TABLE "GuildConfig" ALTER COLUMN "giveawayBlockedRoleIds" SET DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "giveawayHostRoleIds" SET DEFAULT ARRAY[]::TEXT[];

-- Rows that existed before the columns got a default hold NULL.
UPDATE "GuildConfig" SET "giveawayHostRoleIds" = ARRAY[]::TEXT[] WHERE "giveawayHostRoleIds" IS NULL;
UPDATE "GuildConfig" SET "giveawayBlockedRoleIds" = ARRAY[]::TEXT[] WHERE "giveawayBlockedRoleIds" IS NULL;
