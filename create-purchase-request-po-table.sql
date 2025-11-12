-- Create PurchaseRequestPO table if not exists
CREATE TABLE IF NOT EXISTS "PurchaseRequestPO" (
    "id" SERIAL PRIMARY KEY,
    "prDocEntry" INTEGER NOT NULL,
    "prNo" INTEGER NOT NULL,
    "prDate" TIMESTAMP(3) NOT NULL,
    "prDueDate" TIMESTAMP(3) NOT NULL,
    "seriesName" TEXT,
    "prRequester" TEXT,
    "prDepartment" TEXT,
    "prJobName" TEXT,
    "prRemarks" TEXT,
    "prStatus" TEXT NOT NULL,
    "poNo" INTEGER,
    "poDescription" TEXT,
    "poQuantity" DECIMAL(19, 6),
    "poUnit" TEXT,
    "poLineNum" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "PurchaseRequestPO_prDocEntry_idx" ON "PurchaseRequestPO"("prDocEntry");
CREATE INDEX IF NOT EXISTS "PurchaseRequestPO_prNo_idx" ON "PurchaseRequestPO"("prNo");
CREATE INDEX IF NOT EXISTS "PurchaseRequestPO_poNo_idx" ON "PurchaseRequestPO"("poNo");
CREATE INDEX IF NOT EXISTS "PurchaseRequestPO_prDate_idx" ON "PurchaseRequestPO"("prDate");
