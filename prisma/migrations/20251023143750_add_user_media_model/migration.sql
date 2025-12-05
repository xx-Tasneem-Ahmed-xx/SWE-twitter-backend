/*
  Warnings:

  - You are about to drop the column `url` on the `medias` table. All the data in the column will be lost.
  - You are about to drop the column `profilePhoto` on the `users` table. All the data in the column will be lost.
  - Added the required column `keyName` to the `medias` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."UserMediaType" AS ENUM ('PROFILE', 'COVER');

-- AlterTable
ALTER TABLE "public"."medias" DROP COLUMN "url",
ADD COLUMN     "keyName" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "public"."users" DROP COLUMN "profilePhoto",
ADD COLUMN     "coverMediaId" TEXT,
ADD COLUMN     "profileMediaId" TEXT;

-- CreateTable
CREATE TABLE "public"."usermedias" (
    "userId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "type" "public"."UserMediaType" NOT NULL,

    CONSTRAINT "usermedias_pkey" PRIMARY KEY ("userId","mediaId")
);

-- AddForeignKey
ALTER TABLE "public"."users" ADD CONSTRAINT "users_profileMediaId_fkey" FOREIGN KEY ("profileMediaId") REFERENCES "public"."medias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."users" ADD CONSTRAINT "users_coverMediaId_fkey" FOREIGN KEY ("coverMediaId") REFERENCES "public"."medias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."usermedias" ADD CONSTRAINT "usermedias_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "public"."medias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."usermedias" ADD CONSTRAINT "usermedias_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
