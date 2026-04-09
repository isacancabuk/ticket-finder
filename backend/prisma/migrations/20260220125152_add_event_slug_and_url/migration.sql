/*
  Warnings:

  - Added the required column `eventUrl` to the `Query` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Query" ADD COLUMN     "eventSlug" TEXT,
ADD COLUMN     "eventUrl" TEXT NOT NULL;
