/*
  Warnings:

  - You are about to drop the column `provider` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `token` on the `users` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."users" DROP COLUMN IF EXISTS "provider",
DROP COLUMN IF EXISTS "token",
ADD COLUMN IF NOT EXISTS   "unseenChatCount" INTEGER NOT NULL DEFAULT 0;
