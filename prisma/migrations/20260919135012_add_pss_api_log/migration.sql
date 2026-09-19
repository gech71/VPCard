-- CreateTable
CREATE TABLE "pss_api_logs" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "serviceName" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "environment" TEXT,
    "statusCode" INTEGER,
    "success" BOOLEAN NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "correlationId" TEXT,
    "requestHeaders" JSONB,
    "requestBody" JSONB,
    "responseHeaders" JSONB,
    "responseBody" JSONB,
    "errorMessage" TEXT,

    CONSTRAINT "pss_api_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pss_api_logs_createdAt_idx" ON "pss_api_logs"("createdAt");

-- CreateIndex
CREATE INDEX "pss_api_logs_serviceName_idx" ON "pss_api_logs"("serviceName");

-- CreateIndex
CREATE INDEX "pss_api_logs_success_idx" ON "pss_api_logs"("success");

-- CreateIndex
CREATE INDEX "pss_api_logs_correlationId_idx" ON "pss_api_logs"("correlationId");
