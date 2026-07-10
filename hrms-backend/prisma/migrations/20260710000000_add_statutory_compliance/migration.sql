-- CreateTable: ComplianceConfig
CREATE TABLE "compliance_configs" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "enablePf" BOOLEAN NOT NULL DEFAULT true,
    "pfWageCeiling" INTEGER NOT NULL DEFAULT 15000,
    "pfEmployeePct" DOUBLE PRECISION NOT NULL DEFAULT 12,
    "pfEmployerPct" DOUBLE PRECISION NOT NULL DEFAULT 12,
    "enableEsi" BOOLEAN NOT NULL DEFAULT true,
    "esiWageCeiling" INTEGER NOT NULL DEFAULT 21000,
    "esiEmployeePct" DOUBLE PRECISION NOT NULL DEFAULT 0.75,
    "esiEmployerPct" DOUBLE PRECISION NOT NULL DEFAULT 3.25,
    "enablePt" BOOLEAN NOT NULL DEFAULT true,
    "ptState" TEXT NOT NULL DEFAULT 'KARNATAKA',
    "enableTds" BOOLEAN NOT NULL DEFAULT true,
    "tdsRegime" TEXT NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compliance_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ProfessionalTaxSlab
CREATE TABLE "professional_tax_slabs" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "minSalary" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "maxSalary" DOUBLE PRECISION,
    "taxAmount" DOUBLE PRECISION NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "professional_tax_slabs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "compliance_configs_companyId_key" ON "compliance_configs"("companyId");

-- CreateIndex
CREATE INDEX "professional_tax_slabs_companyId_state_idx" ON "professional_tax_slabs"("companyId", "state");

-- AddForeignKey
ALTER TABLE "compliance_configs" ADD CONSTRAINT "compliance_configs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "professional_tax_slabs" ADD CONSTRAINT "professional_tax_slabs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
