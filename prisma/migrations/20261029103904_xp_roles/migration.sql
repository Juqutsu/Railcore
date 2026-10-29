-- AlterTable
ALTER TABLE "GuildConfig" ADD COLUMN     "rankUpChannelId" TEXT,
ADD COLUMN     "xpRolesSyncedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "XpRole" (
    "guildId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "minXp" INTEGER NOT NULL,

    CONSTRAINT "XpRole_pkey" PRIMARY KEY ("guildId","roleId")
);

-- CreateTable
CREATE TABLE "LinkedMember" (
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "robloxId" TEXT NOT NULL,
    "xp" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LinkedMember_pkey" PRIMARY KEY ("guildId","userId")
);
