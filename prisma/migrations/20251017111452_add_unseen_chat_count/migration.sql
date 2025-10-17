/*
  Warnings:

  - You are about to drop the column `provider` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `token` on the `users` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."users" DROP COLUMN "provider",
DROP COLUMN "token",
ADD COLUMN     "unseenChatCount" INTEGER NOT NULL DEFAULT 0;
