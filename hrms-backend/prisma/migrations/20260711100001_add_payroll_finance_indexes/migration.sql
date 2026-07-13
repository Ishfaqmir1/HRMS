-- AddPayrollFinanceIndexes
-- Performance optimization: compound indexes for payroll, financial, and loan query patterns

-- employee_salaries: companyId + isActive (used for active salary counts in dashboard)
CREATE INDEX IF NOT EXISTS "employee_salaries_companyId_isActive_idx" ON "employee_salaries"("companyId", "isActive");

-- employee_salaries: employeeId + isActive + effectiveFrom (used for employee's current salary lookup with date range)
CREATE INDEX IF NOT EXISTS "employee_salaries_employeeId_isActive_effectiveFrom_idx" ON "employee_salaries"("employeeId", "isActive", "effectiveFrom");

-- loan_repayments: loanId + status (used in batch payroll processing for repayment grouping)
CREATE INDEX IF NOT EXISTS "loan_repayments_loanId_status_idx" ON "loan_repayments"("loanId", "status");

-- loans: companyId + status (used for dashboard counts by status and batch loan fetch in payroll)
CREATE INDEX IF NOT EXISTS "loans_companyId_status_idx" ON "loans"("companyId", "status");

-- loans: employeeId + status (used for employee's loan listing with status filter)
CREATE INDEX IF NOT EXISTS "loans_employeeId_status_idx" ON "loans"("employeeId", "status");

-- payroll_runs: companyId + status + year + month (used for dashboard yearly runs with status filter and latest-run lookup)
CREATE INDEX IF NOT EXISTS "payroll_runs_companyId_status_year_month_idx" ON "payroll_runs"("companyId", "status", "year", "month");

-- payslips: employeeId + createdAt (used for "my payslips" queries sorted by date)
CREATE INDEX IF NOT EXISTS "payslips_employeeId_createdAt_idx" ON "payslips"("employeeId", "createdAt");

-- payslips: companyId + employeeId (used for admin payslip listing filtered by company and employee)
CREATE INDEX IF NOT EXISTS "payslips_companyId_employeeId_idx" ON "payslips"("companyId", "employeeId");

-- reimbursements: companyId + status (used for dashboard pending reimbursement counts)
CREATE INDEX IF NOT EXISTS "reimbursements_companyId_status_idx" ON "reimbursements"("companyId", "status");

-- reimbursements: employeeId + createdAt (used for "my expenses" queries sorted by date)
CREATE INDEX IF NOT EXISTS "reimbursements_employeeId_createdAt_idx" ON "reimbursements"("employeeId", "createdAt");
