/*
  Warnings:

  - The values [RequestToFollow,AcceptedFollow] on the enum `NotificationTitle` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "NotificationTitle_new" AS ENUM ('LIKE', 'RETWEET', 'REPLY', 'QUOTE', 'FOLLOW', 'REQUEST_TO_FOLLOW', 'ACCEPTED_FOLLOW', 'MENTION', 'LOGIN', 'PASSWORD_CHANGED');
ALTER TABLE "notifications" ALTER COLUMN "title" TYPE "NotificationTitle_new" USING ("title"::text::"NotificationTitle_new");
ALTER TYPE "NotificationTitle" RENAME TO "NotificationTitle_old";
ALTER TYPE "NotificationTitle_new" RENAME TO "NotificationTitle";
DROP TYPE "public"."NotificationTitle_old";
COMMIT;
