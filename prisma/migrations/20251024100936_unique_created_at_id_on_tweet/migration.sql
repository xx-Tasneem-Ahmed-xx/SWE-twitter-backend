/*
  Warnings:

  - A unique constraint covering the columns `[createdAt,id]` on the table `tweets` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "tweets_createdAt_id_key" ON "public"."tweets"("createdAt", "id");
