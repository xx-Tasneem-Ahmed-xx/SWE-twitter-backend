/*
  Warnings:

  - You are about to drop the column `content` on the `notifications` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `notifications` table. All the data in the column will be lost.
  - Added the required column `body` to the `notifications` table without a default value. This is not possible if the table is not empty.
  - Added the required column `title` to the `notifications` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."NotificationTitle" AS ENUM ('LIKE', 'RETWEET', 'REPLY', 'QUOTE', 'FOLLOW', 'RequestToFollow', 'AcceptedFollow', 'MENTION');

-- AlterTable
ALTER TABLE "public"."notifications" DROP COLUMN "content",
DROP COLUMN "type",
ADD COLUMN     "body" TEXT NOT NULL,
ADD COLUMN     "title" "public"."NotificationTitle" NOT NULL;

-- DropEnum
DROP TYPE "public"."NotificationType";
