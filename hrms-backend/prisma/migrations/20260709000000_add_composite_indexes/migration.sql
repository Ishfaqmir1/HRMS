-- AddCompositeIndexes
-- Performance optimization: composite indexes for common query patterns

-- employees: companyId + status (used in analytics counts, payroll processing)
CREATE INDEX IF NOT EXISTS "employees_companyId_status_idx" ON "employees"("companyId", "status");

-- employees: companyId + gender (used in analytics gender ratio)
CREATE INDEX IF NOT EXISTS "employees_companyId_gender_idx" ON "employees"("companyId", "gender");

-- employees: companyId + dateOfJoining (used in new joiners analytics)
CREATE INDEX IF NOT EXISTS "employees_companyId_dateOfJoining_idx" ON "employees"("companyId", "dateOfJoining");

-- attendance_records: companyId + date + status (used in daily attendance counts)
CREATE INDEX IF NOT EXISTS "attendance_records_companyId_date_status_idx" ON "attendance_records"("companyId", "date", "status");

-- leave_requests: employeeId + startDate + endDate (used in overlap checks)
CREATE INDEX IF NOT EXISTS "leave_requests_employeeId_startDate_endDate_idx" ON "leave_requests"("employeeId", "startDate", "endDate");

-- holidays: companyId + date (used in holiday lookups)
CREATE INDEX IF NOT EXISTS "holidays_companyId_date_idx" ON "holidays"("companyId", "date");

-- payroll_runs: companyId + month + year (used in payroll run lookups)
CREATE INDEX IF NOT EXISTS "payroll_runs_companyId_month_year_idx" ON "payroll_runs"("companyId", "month", "year");
