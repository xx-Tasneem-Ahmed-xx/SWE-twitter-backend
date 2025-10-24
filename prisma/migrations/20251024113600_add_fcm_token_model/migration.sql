-- CreateEnum
CREATE TYPE "public"."OSType" AS ENUM ('ANDROID', 'IOS', 'WEB');

-- CreateTable
CREATE TABLE "public"."FcmToken" (
    "token" TEXT NOT NULL,
    "osType" "public"."OSType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    CONSTRAINT "FcmToken_pkey" PRIMARY KEY ("token")
);

-- AddForeignKey
ALTER TABLE "public"."FcmToken" ADD CONSTRAINT "FcmToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
