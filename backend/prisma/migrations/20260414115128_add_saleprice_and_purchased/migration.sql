-- AlterEnum
ALTER TYPE "QueryStatus" ADD VALUE 'PURCHASED';

-- AlterTable
ALTER TABLE "Query" ADD COLUMN     "salePrice" INTEGER;
