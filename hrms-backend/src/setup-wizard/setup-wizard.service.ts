import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SetupWizardService {
  private readonly logger = new Logger(SetupWizardService.name);

  constructor(private prisma: PrismaService) {}

  /** Check if a company has completed setup. */
  async getStatus(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { setupCompleted: true, setupSkippedAt: true, isActive: true, status: true },
    });
    if (!company) throw new BadRequestException('Company not found.');
    return {
      setupCompleted: company.setupCompleted,
      setupSkipped: !!company.setupSkippedAt,
      skippedAt: company.setupSkippedAt,
      isActive: company.isActive,
      status: company.status,
      setupRequired: company.isActive && !company.setupCompleted && !company.setupSkippedAt,
    };
  }

  /** Run the full setup: create default entities. */
  async runSetup(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, name: true, timezone: true, setupCompleted: true, status: true, isActive: true },
    });
    if (!company) throw new BadRequestException('Company not found.');
    if (!company.isActive) throw new BadRequestException('Company must be active before running setup.');
    if (company.setupCompleted) throw new BadRequestException('Setup has already been completed.');

    // Use a transaction to create all default entities
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Default Branch (Head Office)
      const branch = await tx.branch.create({
        data: {
          companyId,
          name: 'Head Office',
          code: 'HQ',
          isHeadOffice: true,
          isActive: true,
          timezone: company.timezone,
        },
      });

      // 2. Default Department
      const department = await tx.department.create({
        data: {
          companyId,
          branchId: branch.id,
          name: 'General',
          code: 'GEN',
          isActive: true,
        },
      });

      // 3. Default Shift (General, Mon-Fri, 9-6)
      const shift = await tx.shift.create({
        data: {
          companyId,
          name: 'General Shift',
          startTime: '09:00',
          endTime: '18:00',
          breakMinutes: 60,
          gracePeriodMinutes: 15,
          workingDays: [1, 2, 3, 4, 5], // Mon-Fri
        },
      });

      // 4. Default Leave Types
      const annualLeave = await tx.leaveType.create({
        data: {
          companyId,
          name: 'Annual Leave',
          code: 'AL',
          daysPerYear: 20,
          isPaid: true,
          requiresApproval: true,
        },
      });

      await tx.leaveType.create({
        data: {
          companyId,
          name: 'Sick Leave',
          code: 'SL',
          daysPerYear: 12,
          isPaid: true,
          requiresApproval: false,
        },
      });

      await tx.leaveType.create({
        data: {
          companyId,
          name: 'Personal Leave',
          code: 'PL',
          daysPerYear: 5,
          isPaid: false,
          requiresApproval: true,
        },
      });

      // 5. Default Attendance Policy
      await tx.attendancePolicy.create({
        data: {
          companyId,
          name: 'Default Policy',
          timezone: company.timezone,
          workingDays: [1, 2, 3, 4, 5],
          defaultStartTime: '09:00',
          defaultEndTime: '18:00',
          dailyWorkingHours: 9,
          breakDurationMinutes: 60,
          gracePeriodMinutes: 15,
          lateThresholdMinutes: 30,
          veryLateThresholdMinutes: 60,
          halfDayThresholdMinutes: 240,
          minimumWorkingMinutes: 480,
          maximumWorkingMinutes: 720,
          enableOvertime: true,
          overtimeStartsAfterMinutes: 540,
          maxOvertimeMinutes: 240,
          enableAutoLateDetection: true,
          enableAutoHalfDay: true,
          enableAutoAbsent: true,
          enableAutoCheckout: true,
          crossMidnightShift: false,
        },
      });

      // 6. Default Attendance Security Config
      await tx.attendanceSecurityConfig.create({
        data: {
          companyId,
          requireTrustedDevice: false,
          requireWifiVerification: false,
          requireIpValidation: false,
          strictMode: false,
        },
      });

      // 7. Default Compliance Config (Indian statutory)
      await tx.complianceConfig.create({
        data: {
          companyId,
          enablePf: true,
          pfWageCeiling: 15000,
          pfEmployeePct: 12,
          pfEmployerPct: 13,
          enableEsi: true,
          esiWageCeiling: 21000,
          esiEmployeePct: 0.75,
          esiEmployerPct: 3.25,
          enablePt: true,
          ptState: 'KARNATAKA',
          enableTds: true,
          tdsRegime: 'NEW',
        },
      });

      // 8. Default Company Branding
      await tx.companyBranding.create({
        data: {
          companyId,
          primaryColor: '#0B6E63',
          secondaryColor: '#10192B',
          accentColor: '#4DB6A8',
          enabled: false,
        },
      });

      // 9. Default Salary Structure
      await tx.salaryStructure.create({
        data: {
          companyId,
          name: 'Standard Structure',
          description: 'Default salary structure created during setup',
          basic: 50000,
          housingAllowance: 15000,
          transportAllowance: 5000,
          medicalAllowance: 5000,
          otherAllowances: 2000,
          taxPercent: 20,
          pensionPercent: 5,
          insuranceDeduction: 2000,
        },
      });

      // 10. Mark company setup as completed
      await tx.company.update({
        where: { id: companyId },
        data: { setupCompleted: true },
      });

      // 11. Audit log
      await tx.auditLog.create({
        data: {
          companyId,
          action: 'SETUP_COMPLETED',
          entityType: 'Company',
          entityId: companyId,
          metadata: {
            branchId: branch.id,
            departmentId: department.id,
            shiftId: shift.id,
            leaveTypes: ['AL', 'SL', 'PL'],
          },
        },
      });

      return { branch, department, shift, annualLeave };
    });

    this.logger.log(`Setup wizard completed for company ${companyId}`);
    return {
      message: 'Setup completed successfully.',
      entities: {
        branch: result.branch.id,
        department: result.department.id,
        shift: result.shift.id,
        annualLeaveType: result.annualLeave.id,
      },
    };
  }

  /** Skip the setup wizard. */
  async skipSetup(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, setupCompleted: true },
    });
    if (!company) throw new BadRequestException('Company not found.');
    if (company.setupCompleted) throw new BadRequestException('Setup is already completed. Cannot skip.');

    await this.prisma.company.update({
      where: { id: companyId },
      data: { setupSkippedAt: new Date() },
    });

    await this.prisma.auditLog.create({
      data: {
        companyId,
        action: 'SETUP_SKIPPED',
        entityType: 'Company',
        entityId: companyId,
      },
    });

    return { message: 'Setup wizard skipped. You can run it later from settings.' };
  }
}
