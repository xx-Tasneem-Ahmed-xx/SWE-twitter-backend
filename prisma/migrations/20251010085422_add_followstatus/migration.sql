-- CreateEnum
CREATE TYPE "public"."FollowStatus" AS ENUM ('PENDING', 'ACCEPTED');

-- AlterTable
ALTER TABLE "public"."Follow" ADD COLUMN     "status" "public"."FollowStatus" NOT NULL DEFAULT 'ACCEPTED';
