-- CreateEnum
CREATE TYPE "DobVisibility" AS ENUM ('PUBLIC', 'YOUR_FOLLOWERS', 'PEOPLE_YOU_FOLLOW', 'YOU_FOLLOW_EACH_OTHER', 'ONLY_YOU');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "dobMonthDayVisibility" "DobVisibility" NOT NULL DEFAULT 'ONLY_YOU',
ADD COLUMN     "dobYearVisibility" "DobVisibility" NOT NULL DEFAULT 'ONLY_YOU',
ALTER COLUMN "dateOfBirth" DROP NOT NULL;
