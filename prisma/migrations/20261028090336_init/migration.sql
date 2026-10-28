-- CreateTable
CREATE TABLE "GuildConfig" (
    "guildId" TEXT NOT NULL,
    "verificationChannelId" TEXT,
    "verifiedRoleId" TEXT,
    "minAccountAgeDays" INTEGER NOT NULL DEFAULT 7,
    "ticketCategoryId" TEXT,
    "ticketLogChannelId" TEXT,
    "staffRoleIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "applicationRoleId" TEXT,
    "modLogChannelId" TEXT,
    "serverLogChannelId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuildConfig_pkey" PRIMARY KEY ("guildId")
);
