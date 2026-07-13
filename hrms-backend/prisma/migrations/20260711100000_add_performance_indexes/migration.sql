-- AddPerformanceIndexes
-- Performance optimization: compound indexes for common query patterns
-- Generated from Prisma schema @@index additions

-- attendance_records: employeeId + date + status (used in clock-in/out lookup, daily attendance per employee)
CREATE INDEX IF NOT EXISTS "attendance_records_employeeId_date_status_idx" ON "attendance_records"("employeeId", "date", "status");

-- leave_requests: employeeId + status + createdAt (used in "My Requests" listing with status filter and date sort)
CREATE INDEX IF NOT EXISTS "leave_requests_employeeId_status_createdAt_idx" ON "leave_requests"("employeeId", "status", "createdAt");

-- employees: companyId + status + departmentId (used in employee listing with department filter, department strength analytics)
CREATE INDEX IF NOT EXISTS "employees_companyId_status_departmentId_idx" ON "employees"("companyId", "status", "departmentId");
