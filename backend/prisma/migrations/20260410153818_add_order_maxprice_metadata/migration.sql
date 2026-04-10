-- AlterTable
ALTER TABLE "CheckResult" ADD COLUMN     "foundPrice" INTEGER,
ADD COLUMN     "priceExceeded" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Query" ADD COLUMN     "eventDate" TEXT,
ADD COLUMN     "eventLocation" TEXT,
ADD COLUMN     "foundPrice" INTEGER,
ADD COLUMN     "maxPrice" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "orderNo" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "priceExceeded" BOOLEAN NOT NULL DEFAULT false;
