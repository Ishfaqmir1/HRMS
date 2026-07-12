import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StatutoryComplianceService } from '../statutory-compliance/statutory-compliance.service';
import {
  CreateSalaryStructureDto,
  UpdateSalaryStructureDto,
  CreateEmployeeSalaryDto,
  UpdateEmployeeSalaryDto,
  CreatePayrollRunDto,
  UpdatePayslipStatusDto,
  RecalculatePayrollRunDto,
  CreateLoanDto,
  ApproveLoanDto,
  RejectLoanDto,
  CreateReimbursementCategoryDto,
  UpdateReimbursementCategoryDto,
  CreateReimbursementDto,
  ApproveReimbursementDto,
} from './dto/payroll.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { AuditService } from '../common/services/audit.service';

@Injectable()
export class PayrollService {
  constructor(
    private prisma: PrismaService,
    private complianceService: StatutoryComplianceService,
    private auditService: AuditService,
  ) {}

  // ========================================================================
  // Salary Structures
  // ========================================================================
  async createStructure(companyId: string, dto: CreateSalaryStructureDto) {
    return this.prisma.salaryStructure.create({ data: { ...dto, companyId } });
  }

  async findAllStructures(companyId: string, query: PaginationQueryDto) {
    const where = { companyId, isActive: true };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.salaryStructure.findMany({ where, skip: query.skip, take: query.limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.salaryStructure.count({ where }),
    ]);
    return { items, meta: { total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) } };
  }

  async findOneStructure(companyId: string, id: string) {
    const s = await this.prisma.salaryStructure.findFirst({ where: { id, companyId } });
    if (!s) throw new NotFoundException('Salary structure not found.');
    return s;
  }

  async updateStructure(companyId: string, id: string, dto: UpdateSalaryStructureDto) {
    await this.findOneStructure(companyId, id);
    return this.prisma.salaryStructure.update({ where: { id }, data: dto });
  }

  async removeStructure(companyId: string, id: string) {
    await this.findOneStructure(companyId, id);
    return this.prisma.salaryStructure.update({ where: { id }, data: { isActive: false } });
  }

  // ========================================================================
  // Employee Salaries
  // ========================================================================
  async createEmployeeSalary(companyId: string, dto: CreateEmployeeSalaryDto) {
    const employee = await this.prisma.employee.findFirst({ where: { id: dto.employeeId, companyId } });
    if (!employee) throw new NotFoundException('Employee not found.');

    await this.prisma.employeeSalary.updateMany({
      where: { employeeId: dto.employeeId, isActive: true },
      data: { isActive: false, effectiveTo: new Date(dto.effectiveFrom) },
    });

    return this.prisma.employeeSalary.create({
      data: { ...dto, companyId, effectiveFrom: new Date(dto.effectiveFrom), effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : null },
      include: { employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } }, structure: true },
    });
  }

  async findAllEmployeeSalaries(companyId: string, query: PaginationQueryDto) {
    const where = { companyId };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.employeeSalary.findMany({
        where, skip: query.skip, take: query.limit, orderBy: { createdAt: 'desc' },
        include: { employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true, designation: { select: { title: true } } } }, structure: true },
      }),
      this.prisma.employeeSalary.count({ where }),
    ]);
    return { items, meta: { total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) } };
  }

  async findOneEmployeeSalary(companyId: string, id: string) {
    const s = await this.prisma.employeeSalary.findFirst({
      where: { id, companyId },
      include: { employee: true, structure: true },
    });
    if (!s) throw new NotFoundException('Employee salary not found.');
    return s;
  }

  async updateEmployeeSalary(companyId: string, id: string, dto: UpdateEmployeeSalaryDto) {
    await this.findOneEmployeeSalary(companyId, id);
    return this.prisma.employeeSalary.update({
      where: { id },
      data: { ...dto, effectiveFrom: dto.effectiveFrom ? new Date(dto.effectiveFrom) : undefined, effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : undefined },
    });
  }

  // ========================================================================
  // Payroll Runs
  // ========================================================================
  async createRun(companyId: string, dto: CreatePayrollRunDto) {
    const existing = await this.prisma.payrollRun.findFirst({
      where: { companyId, month: dto.month, year: dto.year },
    });
    if (existing) throw new ConflictException(`Payroll run for ${dto.month}/${dto.year} already exists.`);
    return this.prisma.payrollRun.create({ data: { ...dto, companyId } });
  }

  async findAllRuns(companyId: string, query: PaginationQueryDto) {
    const where = { companyId };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.payrollRun.findMany({ where, skip: query.skip, take: query.limit, orderBy: [{ year: 'desc' }, { month: 'desc' }] }),
      this.prisma.payrollRun.count({ where }),
    ]);
    return { items, meta: { total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) } };
  }

  async findOneRun(companyId: string, id: string) {
    const r = await this.prisma.payrollRun.findFirst({
      where: { id, companyId },
      include: { payslips: { include: { employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } } } } },
    });
    if (!r) throw new NotFoundException('Payroll run not found.');
    return r;
  }

  /**
   * Process a payroll run: generate payslips for all active employees.
   * Uses batch-fetching to eliminate N+1 queries for loan deductions.
   */
  async processRun(companyId: string, id: string, userId: string) {
    const run = await this.findOneRun(companyId, id);
    const processable = ['DRAFT', 'APPROVED'];
    if (!processable.includes(run.status)) {
      throw new BadRequestException(
        `Only draft or approved runs can be processed. Current status: ${run.status}.`,
      );
    }

    const activeEmployees = await this.prisma.employee.findMany({
      where: { companyId, status: 'ACTIVE', deletedAt: null },
      include: {
        employeeSalaries: { where: { isActive: true }, take: 1, include: { structure: true } },
      },
    });

    if (activeEmployees.length === 0) {
      throw new BadRequestException('No active employees to recalculate payroll for.');
    }

    // Batch-fetch all active loans for all employees in one query (fix N+1)
    const employeeIds = activeEmployees.map((e) => e.id);
    const allActiveLoans = await this.prisma.loan.findMany({
      where: { employeeId: { in: employeeIds }, status: 'ACTIVE' },
    });

    // Group loans by employee
    const loansByEmployee = new Map<string, typeof allActiveLoans>();
    for (const loan of allActiveLoans) {
      const arr = loansByEmployee.get(loan.employeeId);
      if (arr) arr.push(loan);
      else loansByEmployee.set(loan.employeeId, [loan]);
    }

    // Batch-fetch repayment aggregates and next-due repayments for all loans
    const loanIds = allActiveLoans.map((l) => l.id);
    const [repaymentAggregates, allPendingRepayments] = await Promise.all([
      this.prisma.loanRepayment.groupBy({
        by: ['loanId'],
        where: { loanId: { in: loanIds }, status: 'PAID' },
        _sum: { amount: true },
      }),
      this.prisma.loanRepayment.findMany({
        where: { loanId: { in: loanIds }, status: 'PENDING' },
        orderBy: { dueDate: 'asc' },
      }),
    ]);

    // Build lookup maps from batch results
    const paidByLoan = new Map(repaymentAggregates.map((r) => [r.loanId, r._sum.amount ?? 0]));
    // Get first PENDING repayment per loan (already ordered by dueDate asc)
    const nextDueByLoan = new Map<string, typeof allPendingRepayments[0]>();
    for (const repayment of allPendingRepayments) {
      if (!nextDueByLoan.has(repayment.loanId)) {
        nextDueByLoan.set(repayment.loanId, repayment);
      }
    }

    // Fetch compliance config once for the entire run
    const complianceConfig = await this.prisma.complianceConfig.findUnique({
      where: { companyId },
    });

    let totalGross = 0;
    let totalDeductions = 0;
    let totalNet = 0;
    let totalEmployerContributions = 0;
    let totalPfEmployer = 0;
    let totalEsiEmployer = 0;
    const payslips: any[] = [];

    for (const emp of activeEmployees) {
      const sal = emp.employeeSalaries[0];
      if (!sal) continue;

      const basic = sal.basic;
      const housing = sal.housingAllowance;
      const transport = sal.transportAllowance;
      const medical = sal.medicalAllowance;
      const other = sal.otherAllowances;
      const gross = basic + housing + transport + medical + other;

      // If compliance config exists, use statutory calculations
      // Otherwise fall back to the simple percentage-based approach from SalaryStructure
      let tax = 0;
      let pension = 0;
      let insurance = 0;
      let otherDeductions = 0;
      let pfEmployerShare = 0;
      let esiEmployerShare = 0;

      if (complianceConfig) {
        // Use Indian statutory compliance engine for deductions
        if (complianceConfig.enablePf) {
          const pf = this.complianceService.calculatePf(
            gross,
            complianceConfig.pfWageCeiling,
            complianceConfig.pfEmployeePct,
            complianceConfig.pfEmployerPct,
          );
          pension = pf.employeeShare;
          pfEmployerShare = pf.employerShare;
        } else {
          pension = Math.round(gross * (sal.pensionPercent / 100));
        }

        if (complianceConfig.enableEsi) {
          const esi = this.complianceService.calculateEsi(
            gross,
            complianceConfig.esiWageCeiling,
            complianceConfig.esiEmployeePct,
            complianceConfig.esiEmployerPct,
          );
          insurance = esi.employeeShare;
          esiEmployerShare = esi.employerShare;
        } else {
          insurance = sal.insuranceDeduction;
        }

        if (complianceConfig.enablePt) {
          otherDeductions = this.complianceService.calculatePt(gross, complianceConfig.ptState);
        }

        if (complianceConfig.enableTds) {
          tax = this.complianceService.calculateTds(gross, complianceConfig.tdsRegime === 'NEW');
        } else {
          tax = Math.round(gross * (sal.taxPercent / 100));
        }
      } else {
        // Fall back to simple percentage-based deductions
        tax = Math.round(gross * (sal.taxPercent / 100));
        pension = Math.round(gross * (sal.pensionPercent / 100));
        insurance = sal.insuranceDeduction;
        otherDeductions = 0;
      }

      // Calculate loan deductions from pre-fetched data (no per-employee queries)
      let loanDeduction = 0;
      const employeeLoans = loansByEmployee.get(emp.id) ?? [];

      for (const loan of employeeLoans) {
        const paidAmount = paidByLoan.get(loan.id) ?? 0;
        const monthsPaid = Math.floor(paidAmount / loan.monthlyInstallment);
        const nextDue = nextDueByLoan.get(loan.id);

        if (monthsPaid < loan.repaymentMonths && nextDue) {
          await this.prisma.loanRepayment.update({
            where: { id: nextDue.id },
            data: { status: 'PAID', paidAt: new Date() },
          });

          const updatedPaidAmount = paidAmount + loan.monthlyInstallment;
          if (updatedPaidAmount >= loan.totalAmount) {
            await this.prisma.loan.update({ where: { id: loan.id }, data: { status: 'COMPLETED' } });
          }

          loanDeduction += loan.monthlyInstallment;
        }
      }

      const deductions = tax + pension + insurance + loanDeduction + otherDeductions;
      const net = gross - deductions;

      const payslip = await this.prisma.payslip.create({
        data: {
          companyId,
          employeeId: emp.id,
          runId: id,
          basic, housingAllowance: housing, transportAllowance: transport,
          medicalAllowance: medical, otherAllowances: other,
          grossPay: gross,
          taxDeduction: tax, pensionDeduction: pension,
          insuranceDeduction: insurance, loanDeduction,
          otherDeductions,
          totalDeductions: deductions,
          netPay: Math.max(net, 0),
        },
      });

      totalGross += gross;
      totalDeductions += deductions;
      totalNet += Math.max(net, 0);
      totalPfEmployer += pfEmployerShare;
      totalEsiEmployer += esiEmployerShare;
      payslips.push(payslip);
    }

    totalEmployerContributions = totalPfEmployer + totalEsiEmployer;

    // Update the run totals
    await this.prisma.payrollRun.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        processedById: userId,
        processedAt: new Date(),
        totalGross,
        totalDeductions,
        totalNet,
        employeeCount: payslips.length,
      },
    });

    return {
      payslips,
      totals: {
        totalGross,
        totalDeductions,
        totalNet,
        employeeCount: payslips.length,
        totalEmployerContributions,
      },
    };
  }

  async completeRun(companyId: string, id: string) {
    await this.findOneRun(companyId, id);
    return this.prisma.payrollRun.update({ where: { id }, data: { status: 'COMPLETED' } });
  }

  // ========================================================================
  // Payroll Run Approval Workflow
  // ========================================================================

  /**
   * Submit a draft run for approval. Changes status from DRAFT → PENDING_APPROVAL.
   */
  async submitForApproval(companyId: string, id: string) {
    const run = await this.findOneRun(companyId, id);
    if (run.status !== 'DRAFT') {
      throw new BadRequestException(`Only draft runs can be submitted for approval. Current status: ${run.status}.`);
    }
    return this.prisma.payrollRun.update({
      where: { id },
      data: { status: 'PENDING_APPROVAL' },
    });
  }

  /**
   * Approve a payroll run. Changes status from PENDING_APPROVAL → APPROVED.
   * Records the approver ID and timestamp.
   */
  async approveRun(companyId: string, id: string, approverUserId: string, notes?: string) {
    const run = await this.findOneRun(companyId, id);
    if (run.status !== 'PENDING_APPROVAL') {
      throw new BadRequestException(`Only runs pending approval can be approved. Current status: ${run.status}.`);
    }
    return this.prisma.payrollRun.update({
      where: { id },
      data: {
        status: 'APPROVED',
        processedById: approverUserId,
        processedAt: new Date(),
        notes: notes ?? undefined,
      },
    });
  }

  /**
   * Reject a payroll run. Changes status from PENDING_APPROVAL back to DRAFT
   * so the creator can make corrections and re-submit.
   */
  async rejectRun(companyId: string, id: string, rejectionReason: string) {
    const run = await this.findOneRun(companyId, id);
    if (run.status !== 'PENDING_APPROVAL') {
      throw new BadRequestException(`Only runs pending approval can be rejected. Current status: ${run.status}.`);
    }
    return this.prisma.payrollRun.update({
      where: { id },
      data: {
        status: 'DRAFT',
        notes: rejectionReason,
      },
    });
  }

  async cancelRun(companyId: string, id: string) {
    const run = await this.findOneRun(companyId, id);
    if (run.status === 'COMPLETED') throw new BadRequestException('Cannot cancel a completed payroll run.');
    await this.prisma.payslip.deleteMany({ where: { runId: id } });
    return this.prisma.payrollRun.update({ where: { id }, data: { status: 'CANCELLED' } });
  }

  // ========================================================================
  // Payslips
  // ========================================================================
  async findPayslipsByRun(companyId: string, runId: string) {
    return this.prisma.payslip.findMany({
      where: { runId, companyId },
      include: { employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true, designation: { select: { title: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findMyPayslips(employeeId: string, query: PaginationQueryDto) {
    const where = { employeeId };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.payslip.findMany({ where, skip: query.skip, take: query.limit, orderBy: { createdAt: 'desc' }, include: { run: { select: { month: true, year: true } } } }),
      this.prisma.payslip.count({ where }),
    ]);
    return { items, meta: { total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) } };
  }

  async updatePayslipStatus(companyId: string, id: string, dto: UpdatePayslipStatusDto) {
    const payslip = await this.prisma.payslip.findFirst({ where: { id, companyId } });
    if (!payslip) throw new NotFoundException('Payslip not found.');
    return this.prisma.payslip.update({
      where: { id },
      data: { status: dto.status, paidAt: dto.status === 'PAID' ? new Date() : undefined, notes: dto.notes },
    });
  }

  // ========================================================================
  // Loans
  // ========================================================================
  async createLoan(companyId: string, dto: CreateLoanDto) {
    const employee = await this.prisma.employee.findFirst({ where: { id: dto.employeeId, companyId } });
    if (!employee) throw new NotFoundException('Employee not found.');

    const totalAmount = dto.amount + (dto.amount * (dto.interestRate || 0) / 100);
    const monthlyInstallment = Math.ceil(totalAmount / dto.repaymentMonths);

    return this.prisma.loan.create({
      data: {
        ...dto,
        companyId,
        totalAmount,
        monthlyInstallment,
      },
    });
  }

  async findAllLoans(companyId: string, query: PaginationQueryDto) {
    const where = { companyId };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.loan.findMany({
        where, skip: query.skip, take: query.limit, orderBy: { createdAt: 'desc' },
        include: { employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } } },
      }),
      this.prisma.loan.count({ where }),
    ]);
    return { items, meta: { total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) } };
  }

  async findMyLoans(employeeId: string) {
    return this.prisma.loan.findMany({ where: { employeeId }, orderBy: { createdAt: 'desc' }, include: { repayments: { orderBy: { dueDate: 'asc' } } } });
  }

  async approveLoan(companyId: string, id: string, dto: ApproveLoanDto, userId: string) {
    const loan = await this.prisma.loan.findFirst({ where: { id, companyId } });
    if (!loan) throw new NotFoundException('Loan not found.');
    if (loan.status !== 'PENDING') throw new BadRequestException('Loan is not pending.');

    const repayments: { loanId: string; amount: number; dueDate: Date; status: string }[] = [];
    const startDate = new Date(dto.disbursedAt);
    for (let i = 1; i <= loan.repaymentMonths; i++) {
      const dueDate = new Date(startDate);
      dueDate.setMonth(dueDate.getMonth() + i);
      repayments.push({
        loanId: id,
        amount: loan.monthlyInstallment,
        dueDate,
        status: 'PENDING',
      });
    }

    await this.prisma.loanRepayment.createMany({ data: repayments });

    return this.prisma.loan.update({
      where: { id },
      data: { status: 'ACTIVE', approvedById: userId, approvedAt: new Date(), disbursedAt: new Date(dto.disbursedAt) },
    });
  }

  async rejectLoan(companyId: string, id: string, dto: RejectLoanDto) {
    const loan = await this.prisma.loan.findFirst({ where: { id, companyId } });
    if (!loan) throw new NotFoundException('Loan not found.');
    return this.prisma.loan.update({ where: { id }, data: { status: 'REJECTED', notes: dto.reason } });
  }

  // ========================================================================
  // Reimbursement Categories
  // ========================================================================
  async createCategory(companyId: string, dto: CreateReimbursementCategoryDto) {
    return this.prisma.reimbursementCategory.create({ data: { ...dto, companyId } });
  }

  async findAllCategories(companyId: string) {
    return this.prisma.reimbursementCategory.findMany({ where: { companyId, isActive: true }, orderBy: { name: 'asc' } });
  }

  async updateCategory(companyId: string, id: string, dto: UpdateReimbursementCategoryDto) {
    const c = await this.prisma.reimbursementCategory.findFirst({ where: { id, companyId } });
    if (!c) throw new NotFoundException('Category not found.');
    return this.prisma.reimbursementCategory.update({ where: { id }, data: dto });
  }

  // ========================================================================
  // Reimbursements
  // ========================================================================
  async createReimbursement(companyId: string, dto: CreateReimbursementDto) {
    const employee = await this.prisma.employee.findFirst({ where: { id: dto.employeeId, companyId } });
    if (!employee) throw new NotFoundException('Employee not found.');
    const category = await this.prisma.reimbursementCategory.findFirst({ where: { id: dto.categoryId, companyId } });
    if (!category) throw new NotFoundException('Category not found.');

    return this.prisma.reimbursement.create({ data: { ...dto, companyId } });
  }

  async findAllReimbursements(companyId: string, query: PaginationQueryDto) {
    const where = { companyId };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.reimbursement.findMany({
        where, skip: query.skip, take: query.limit, orderBy: { createdAt: 'desc' },
        include: { employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } }, category: true },
      }),
      this.prisma.reimbursement.count({ where }),
    ]);
    return { items, meta: { total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) } };
  }

  async findMyReimbursements(employeeId: string) {
    return this.prisma.reimbursement.findMany({
      where: { employeeId },
      orderBy: { createdAt: 'desc' },
      include: { category: true },
    });
  }

  async approveReimbursement(companyId: string, id: string, dto: ApproveReimbursementDto, userId: string) {
    const r = await this.prisma.reimbursement.findFirst({ where: { id, companyId } });
    if (!r) throw new NotFoundException('Reimbursement not found.');
    return this.prisma.reimbursement.update({
      where: { id },
      data: { status: 'APPROVED', approvedById: userId, approvedAt: new Date(), notes: dto.notes },
    });
  }

  async rejectReimbursement(companyId: string, id: string, reason: string) {
    const r = await this.prisma.reimbursement.findFirst({ where: { id, companyId } });
    if (!r) throw new NotFoundException('Reimbursement not found.');
    return this.prisma.reimbursement.update({ where: { id }, data: { status: 'REJECTED', notes: reason } });
  }

  async markReimbursementPaid(companyId: string, id: string) {
    const r = await this.prisma.reimbursement.findFirst({ where: { id, companyId } });
    if (!r) throw new NotFoundException('Reimbursement not found.');
    return this.prisma.reimbursement.update({ where: { id }, data: { status: 'PAID', paidAt: new Date() } });
  }

  // ========================================================================
  // Payroll Recalculation & Versioning
  // ========================================================================

  /**
   * Recalculate a completed payroll run — creates a new version WITHOUT
   * modifying the original. Every recalculation becomes version N+1 with
   * a full audit trail.
   */
  async recalculateRun(
    companyId: string,
    runId: string,
    dto: RecalculatePayrollRunDto,
    userId: string,
  ) {
    // 1. Find the original (source) run — must be COMPLETED
    const sourceRun = await this.prisma.payrollRun.findFirst({
      where: { id: runId, companyId },
      include: { payslips: true },
    });
    if (!sourceRun) throw new NotFoundException('Payroll run not found.');
    if (sourceRun.status !== 'COMPLETED') {
      throw new BadRequestException('Only completed runs can be recalculated.');
    }

    // 2. Find the latest version number for this period
    const latestRun = await this.prisma.payrollRun.findFirst({
      where: { companyId, month: sourceRun.month, year: sourceRun.year },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    const nextVersion = (latestRun?.version ?? sourceRun.version) + 1;

    // 3. Fetch active employees + their current salaries + attendance data
    const activeEmployees = await this.prisma.employee.findMany({
      where: { companyId, status: 'ACTIVE', deletedAt: null },
      include: {
        employeeSalaries: {
          where: { isActive: true },
          take: 1,
          include: { structure: true },
        },
      },
    });

    const employeeIds = activeEmployees.map((e) => e.id);

    // 4. Guard: must have active employees
    if (activeEmployees.length === 0) {
      throw new BadRequestException('No active employees to recalculate.');
    }

    // 5. Fetch attendance data for the run's month
    const startDate = new Date(sourceRun.year, sourceRun.month - 1, 1);
    const endDate = new Date(sourceRun.year, sourceRun.month, 0, 23, 59, 59);

    const allActiveLoans = await this.prisma.loan.findMany({
      where: { employeeId: { in: employeeIds }, status: 'ACTIVE' },
    });

    const [attendanceRecords, complianceConfig, repaymentAggregates] = await Promise.all([
      this.prisma.attendanceRecord.findMany({
        where: { employeeId: { in: employeeIds }, date: { gte: startDate, lte: endDate } },
      }),
      this.prisma.complianceConfig.findUnique({ where: { companyId } }),
      allActiveLoans.length > 0
        ? this.prisma.loanRepayment.groupBy({
            by: ['loanId'],
            where: { loanId: { in: allActiveLoans.map((l) => l.id) }, status: 'PAID' },
            _count: { id: true },
          })
        : Promise.resolve([]),
    ]);

    // Group attendance by employee to compute overtime
    const attendanceByEmployee = new Map<string, typeof attendanceRecords>();
    for (const rec of attendanceRecords) {
      const arr = attendanceByEmployee.get(rec.employeeId);
      if (arr) arr.push(rec);
      else attendanceByEmployee.set(rec.employeeId, [rec]);
    }

    // Build paid-repayment count lookup (batch-fetched, no N+1)
    const paidCountByLoan = new Map<string, number>();
    for (const r of repaymentAggregates) {
      paidCountByLoan.set(r.loanId, (r._count as any).id ?? 0);
    }

    // 6. Build a map of original payslips for reference
    const originalPayslipsByEmployee = new Map(
      sourceRun.payslips.map((p) => [p.employeeId, p]),
    );

    // 7. Create the new version run (DRAFT status — processedById stays null)
    const newRun = await this.prisma.payrollRun.create({
      data: {
        companyId,
        month: sourceRun.month,
        year: sourceRun.year,
        version: nextVersion,
        previousRunId: sourceRun.id,
        status: 'DRAFT',
        recalcReason: dto.reason,
        notes: `Recalculation v${nextVersion} from v${sourceRun.version}: ${dto.reason}`,
      },
    });

    // 8. Recalculate payslips
    let totalGross = 0;
    let totalDeductions = 0;
    let totalNet = 0;
    const payslips: any[] = [];

    for (const emp of activeEmployees) {
      const sal = emp.employeeSalaries[0];
      if (!sal) continue;

      // Base amounts from CURRENT salary (may have changed from original run)
      const basic = sal.basic;
      const housing = sal.housingAllowance;
      const transport = sal.transportAllowance;
      const medical = sal.medicalAllowance;
      const other = sal.otherAllowances;
      const gross = basic + housing + transport + medical + other;

      // Get the original payslip to track changes
      const originalPslip = originalPayslipsByEmployee.get(emp.id);

      // Calculate overtime from attendance data
      const empAttendance = attendanceByEmployee.get(emp.id) ?? [];
      const totalOvertimeMinutes = empAttendance.reduce(
        (sum, rec) => sum + (rec.overtimeMinutes ?? 0), 0,
      );

      // Apply any manual overtime adjustments from the DTO
      const overtimeAdjustment = dto.overtimeAdjustments?.[emp.id] ?? 0;
      const bonusAdjustment = dto.bonusAdjustments?.[emp.id] ?? 0;

      // Calculate overtime pay (hourly rate = gross / (22 days * 8 hours))
      const hourlyRate = gross / (22 * 8);
      const overtimePay = Math.round(
        ((totalOvertimeMinutes + overtimeAdjustment) / 60) * hourlyRate * 1.5,
      );

      // Deductions (same logic as processRun)
      let tax = 0;
      let pension = 0;
      let insurance = 0;
      let otherDeductions = 0;

      if (complianceConfig) {
        if (complianceConfig.enablePf) {
          const pf = this.complianceService.calculatePf(
            gross, complianceConfig.pfWageCeiling,
            complianceConfig.pfEmployeePct, complianceConfig.pfEmployerPct,
          );
          pension = pf.employeeShare;
        } else {
          pension = Math.round(gross * (sal.pensionPercent / 100));
        }
        if (complianceConfig.enableEsi) {
          const esi = this.complianceService.calculateEsi(
            gross, complianceConfig.esiWageCeiling,
            complianceConfig.esiEmployeePct, complianceConfig.esiEmployerPct,
          );
          insurance = esi.employeeShare;
        } else {
          insurance = sal.insuranceDeduction;
        }
        if (complianceConfig.enablePt) {
          otherDeductions = this.complianceService.calculatePt(gross, complianceConfig.ptState);
        }
        if (complianceConfig.enableTds) {
          tax = this.complianceService.calculateTds(gross, complianceConfig.tdsRegime === 'NEW');
        } else {
          tax = Math.round(gross * (sal.taxPercent / 100));
        }
      } else {
        tax = Math.round(gross * (sal.taxPercent / 100));
        pension = Math.round(gross * (sal.pensionPercent / 100));
        insurance = sal.insuranceDeduction;
      }

      // Loan deduction — use batch-fetched repayment counts (no N+1)
      let loanDeduction = 0;
      for (const loan of allActiveLoans.filter((l) => l.employeeId === emp.id)) {
        const paidCount = paidCountByLoan.get(loan.id) ?? 0;
        if (paidCount < loan.repaymentMonths) {
          loanDeduction += loan.monthlyInstallment;
        }
      }

      const deductions = tax + pension + insurance + loanDeduction + otherDeductions;
      const net = gross + overtimePay + bonusAdjustment - deductions;

      // Track adjustments relative to the original payslip
      const adjustments: Record<string, unknown> = {};
      if (originalPslip) {
        if (originalPslip.overtimePay !== overtimePay) {
          adjustments.overtimeChange = overtimePay - originalPslip.overtimePay;
        }
        if (originalPslip.netPay !== Math.max(net, 0)) {
          adjustments.netChange = Math.max(net, 0) - originalPslip.netPay;
        }
        if (originalPslip.grossPay !== gross) {
          adjustments.grossChange = gross - originalPslip.grossPay;
        }
        adjustments.reason = dto.reason;
      }

      const payslip = await this.prisma.payslip.create({
        data: {
          companyId,
          employeeId: emp.id,
          runId: newRun.id,
          previousPayslipId: originalPslip?.id ?? null,
          basic,
          housingAllowance: housing,
          transportAllowance: transport,
          medicalAllowance: medical,
          otherAllowances: other,
          overtimePay,
          bonus: bonusAdjustment,
          grossPay: gross + overtimePay + bonusAdjustment,
          taxDeduction: tax,
          pensionDeduction: pension,
          insuranceDeduction: insurance,
          loanDeduction,
          otherDeductions,
          totalDeductions: deductions,
          netPay: Math.max(net, 0),
          adjustments: Object.keys(adjustments).length > 0 ? adjustments as any : undefined,
          status: 'DRAFT',
        },
      });

      totalGross += gross + overtimePay + bonusAdjustment;
      totalDeductions += deductions;
      totalNet += Math.max(net, 0);
      payslips.push(payslip);
    }

    // Update run totals
    await this.prisma.payrollRun.update({
      where: { id: newRun.id },
      data: {
        totalGross,
        totalDeductions,
        totalNet,
        employeeCount: payslips.length,
      },
    });

    // Audit
    await this.auditService.logCustom(
      { userId, companyId } as any,
      'PAYROLL_RECALCULATED',
      'PayrollRun',
      newRun.id,
      {
        previousRunId: sourceRun.id,
        previousVersion: sourceRun.version,
        newVersion: nextVersion,
        reason: dto.reason,
        employeeCount: payslips.length,
        totalNet,
      },
    );

    return {
      run: newRun,
      payslips,
      version: nextVersion,
      previousVersion: sourceRun.version,
      totals: { totalGross, totalDeductions, totalNet, employeeCount: payslips.length },
    };
  }

  /**
   * Get all versions of a payroll run for a given month/year.
   */
  async findRunVersions(companyId: string, runId: string) {
    const run = await this.prisma.payrollRun.findFirst({
      where: { id: runId, companyId },
      select: { month: true, year: true },
    });
    if (!run) throw new NotFoundException('Payroll run not found.');

    const versions = await this.prisma.payrollRun.findMany({
      where: { companyId, month: run.month, year: run.year },
      orderBy: { version: 'desc' },
      select: {
        id: true,
        version: true,
        status: true,
        totalGross: true,
        totalNet: true,
        employeeCount: true,
        processedAt: true,
        recalcReason: true,
        createdAt: true,
        previousRunId: true,
      },
    });

    return versions;
  }

  /**
   * Compare a revised payslip against its original.
   */
  async comparePayslip(companyId: string, payslipId: string) {
    const payslip = await this.prisma.payslip.findFirst({
      where: { id: payslipId, companyId },
      include: {
        previousPayslip: true,
        employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
        run: { select: { version: true, month: true, year: true } },
      },
    });
    if (!payslip) throw new NotFoundException('Payslip not found.');

    return {
      current: payslip,
      previous: payslip.previousPayslip,
      differences: payslip.previousPayslip
        ? this._computeDiff(payslip, payslip.previousPayslip)
        : null,
    };
  }

  private _computeDiff(current: any, previous: any) {
    const fields = [
      'basic', 'housingAllowance', 'transportAllowance', 'medicalAllowance',
      'otherAllowances', 'overtimePay', 'bonus', 'grossPay',
      'taxDeduction', 'pensionDeduction', 'insuranceDeduction',
      'loanDeduction', 'otherDeductions', 'totalDeductions', 'netPay',
    ] as const;

    const diffs: Record<string, { from: number; to: number; diff: number }> = {};
    for (const field of fields) {
      const from = Number(previous[field]) || 0;
      const to = Number(current[field]) || 0;
      if (from !== to) {
        diffs[field] = { from, to, diff: to - from };
      }
    }
    return diffs;
  }

  // ========================================================================
  // Dashboard / Summary
  // ========================================================================
  async getDashboard(companyId: string) {
    // Guard: if no companyId (e.g. platform super admin), return empty dashboard
    if (!companyId) {
      return {
        activeStructures: 0,
        activeSalaries: 0,
        latestRun: null,
        pendingLoans: 0,
        activeLoans: 0,
        pendingReimbursements: 0,
        yearlyRuns: [],
        currentYear: new Date().getFullYear(),
      };
    }

    const [activeStructures, activeSalaries, latestRun, pendingLoans, activeLoans, pendingReimbursements, yearlyRuns, currentYear] = await Promise.all([
      this.prisma.salaryStructure.count({ where: { companyId, isActive: true } }),
      this.prisma.employeeSalary.count({ where: { companyId, isActive: true } }),
      this.prisma.payrollRun.findFirst({
        where: { companyId },
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
      }),
      this.prisma.loan.count({ where: { companyId, status: 'PENDING' } }),
      this.prisma.loan.count({ where: { companyId, status: 'ACTIVE' } }),
      this.prisma.reimbursement.count({ where: { companyId, status: 'PENDING' } }),
      this.prisma.payrollRun.findMany({
        where: { companyId, year: new Date().getFullYear(), status: 'COMPLETED' },
        orderBy: { month: 'asc' },
        select: { month: true, totalGross: true, totalNet: true, totalDeductions: true, employeeCount: true },
      }),
      Promise.resolve(new Date().getFullYear()),
    ]);

    return {
      activeStructures,
      activeSalaries,
      latestRun,
      pendingLoans,
      activeLoans,
      pendingReimbursements,
      yearlyRuns,
      currentYear,
    };
  }
}
