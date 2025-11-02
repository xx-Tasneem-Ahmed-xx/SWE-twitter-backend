/*
  Warnings:

  - A unique constraint covering the columns `[keyName]` on the table `medias` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "medias_keyName_key" ON "public"."medias"("keyName");
