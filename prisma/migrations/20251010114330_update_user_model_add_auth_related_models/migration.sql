-- AlterTable
ALTER TABLE "public"."users" ADD COLUMN     "isEmailVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "loginCodes" TEXT,
ADD COLUMN     "loginCodesSet" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "provider" TEXT,
ADD COLUMN     "tfaVerifed" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "public"."oldPasswords" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "password" TEXT NOT NULL,

    CONSTRAINT "oldPasswords_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."sessions" (
    "jti" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deviceInfoId" TEXT,
    "expire_at" TIMESTAMP(3),

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("jti")
);

-- CreateTable
CREATE TABLE "public"."device_record" (
    "id" TEXT NOT NULL,
    "city" TEXT,
    "region" TEXT,
    "country" TEXT,
    "locale" TEXT,
    "lat" DOUBLE PRECISION,
    "lon" DOUBLE PRECISION,
    "zipcode" TEXT,
    "lastLogin" TIMESTAMP(3),
    "browser" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "device_record_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."oldPasswords" ADD CONSTRAINT "oldPasswords_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."device_record" ADD CONSTRAINT "device_record_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
