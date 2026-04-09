-- CreateEnum
CREATE TYPE "Domain" AS ENUM ('UK', 'DE');

-- CreateEnum
CREATE TYPE "Site" AS ENUM ('TICKETMASTER');

-- CreateEnum
CREATE TYPE "QueryStatus" AS ENUM ('FINDING', 'FOUND', 'STOPPED', 'ERROR');

-- CreateTable
CREATE TABLE "Query" (
    "id" TEXT NOT NULL,
    "domain" "Domain" NOT NULL,
    "site" "Site" NOT NULL,
    "eventId" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "status" "QueryStatus" NOT NULL DEFAULT 'FINDING',
    "lastCheckedAt" TIMESTAMP(3),
    "isAvailable" BOOLEAN NOT NULL DEFAULT false,
    "lastErrorMessage" TEXT,
    "eventName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Query_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckResult" (
    "id" TEXT NOT NULL,
    "queryId" TEXT NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "QueryStatus" NOT NULL,
    "isAvailable" BOOLEAN NOT NULL,
    "eventName" TEXT,
    "httpStatus" INTEGER,
    "errorMessage" TEXT,
    "latencyMs" INTEGER,

    CONSTRAINT "CheckResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Query_site_domain_eventId_section_key" ON "Query"("site", "domain", "eventId", "section");

-- CreateIndex
CREATE INDEX "CheckResult_queryId_idx" ON "CheckResult"("queryId");

-- AddForeignKey
ALTER TABLE "CheckResult" ADD CONSTRAINT "CheckResult_queryId_fkey" FOREIGN KEY ("queryId") REFERENCES "Query"("id") ON DELETE CASCADE ON UPDATE CASCADE;
