/*
  Warnings:

  - A unique constraint covering the columns `[lastActivityAt,id]` on the table `tweets` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "public"."tweets_createdAt_id_key";

-- CreateIndex
CREATE UNIQUE INDEX "tweets_lastActivityAt_id_key" ON "tweets"("lastActivityAt", "id");
