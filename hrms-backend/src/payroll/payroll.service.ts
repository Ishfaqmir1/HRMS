import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateSalaryStructureDto,
  UpdateSalaryStructureDto,
  CreateEmployeeSalaryDto,
  UpdateEmployeeSalaryDto,
  CreatePayrollRunDto,
  UpdatePayslipStatusDto,
  CreateLoanDto,
  ApproveLoanDto,
  RejectLoanDto,
  CreateReimbursementCategoryDto,
  UpdateReimbursementCategoryDto,
  CreateReimbursementDto,
  ApproveReimbursementDto,
} from './dto/payroll.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

@Injectable()
export class PayrollService {
  constructor(private prisma: PrismaService) {}

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

    // Deactivate any currently active salary
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
      this.prisma.payrollRun.findMany({ where, skip: query.skip, take: query.limit, orderBy: { year: 'desc', month: 'desc' } }),
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
   * Uses each employee's current salary assignment.
   */
  async processRun(companyId: string, id: string, userId: string) {
    const run = await this.findOneRun(companyId, id);
    if (run.status !== 'DRAFT') throw new BadRequestException('Only draft runs can be processed.');

    const activeEmployees = await this.prisma.employee.findMany({
      where: { companyId, status: 'ACTIVE', deletedAt: null },
      include: {
        employeeSalaries: { where: { isActive: true }, take: 1, include: { structure: true } },
      },
    });

    if (activeEmployees.length === 0) {
      throw new BadRequestException('No active employees to process payroll for.');
    }

    let totalGross = 0;
    let totalDeductions = 0;
    let totalNet = 0;
    const payslips: any[] = [];

    for (const emp of activeEmployees) {
      const sal = emp.employeeSalaries[0];
      if (!sal) continue; // No salary assigned, skip

      const basic = sal.basic;
      const housing = sal.housingAllowance;
      const transport = sal.transportAllowance;
      const medical = sal.medicalAllowance;
      const other = sal.otherAllowances;
      const gross = basic + housing + transport + medical + other;

      const tax = gross * (sal.taxPercent / 100);
      const pension = gross * (sal.pensionPercent / 100);
      const insurance = sal.insuranceDeduction;

      // Check for active loan deductions
      const activeLoans = await this.prisma.loan.findMany({
        where: { employeeId: emp.id, status: 'ACTIVE' },
      });
      let loanDeduction = 0;
      for (const loan of activeLoans) {
        const repaid = await this.prisma.loanRepayment.aggregate({
          where: { loanId: loan.id, status: 'PAID' },
          _sum: { amount: true },
        });
        const monthsPaid = Math.floor((repaid._sum.amount ?? 0) / loan.monthlyInstallment);
        if (monthsPaid < loan.repaymentMonths) {
          // Mark next installment as due
          const nextDue = await this.prisma.loanRepayment.findFirst({
            where: { loanId: loan.id, status: 'PENDING' },
            orderBy: { dueDate: 'asc' },
          });
          if (nextDue) {
            loanDeduction += loan.monthlyInstallment;
            await this.prisma.loanRepayment.update({
              where: { id: nextDue.id },
              data: { status: 'PAID', paidAt: new Date() },
            });
          }
        }
        // Check if loan is fully repaid
        const totalRepaid = await this.prisma.loanRepayment.aggregate({
          where: { loanId: loan.id, status: 'PAID' },
          _sum: { amount: true },
        });
        if ((totalRepaid._sum.amount ?? 0) >= loan.totalAmount) {
          await this.prisma.loan.update({ where: { id: loan.id }, data: { status: 'COMPLETED' } });
        }
      }

      const deductions = tax + pension + insurance + loanDeduction + 0; // otherDeductions
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
          totalDeductions: deductions,
          netPay: Math.max(net, 0),
        },
      });

      totalGross += gross;
      totalDeductions += deductions;
      totalNet += Math.max(net, 0);
      payslips.push(payslip);
    }

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

    return { payslips, totals: { totalGross, totalDeductions, totalNet, employeeCount: payslips.length } };
  }

  async completeRun(companyId: string, id: string) {
    await this.findOneRun(companyId, id);
    return this.prisma.payrollRun.update({ where: { id }, data: { status: 'COMPLETED' } });
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

    // Generate repayment schedule
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
  // Dashboard / Summary
  // ========================================================================
  async getDashboard(companyId: string) {
    const activeStructures = await this.prisma.salaryStructure.count({ where: { companyId, isActive: true } });
    const activeSalaries = await this.prisma.employeeSalary.count({ where: { companyId, isActive: true } });

    const latestRun = await this.prisma.payrollRun.findFirst({
      where: { companyId },
      orderBy: { year: 'desc', month: 'desc' },
    });

    const pendingLoans = await this.prisma.loan.count({ where: { companyId, status: 'PENDING' } });
    const activeLoans = await this.prisma.loan.count({ where: { companyId, status: 'ACTIVE' } });
    const pendingReimbursements = await this.prisma.reimbursement.count({ where: { companyId, status: 'PENDING' } });

    // Monthly totals for the year
    const currentYear = new Date().getFullYear();
    const yearlyRuns = await this.prisma.payrollRun.findMany({
      where: { companyId, year: currentYear, status: 'COMPLETED' },
      orderBy: { month: 'asc' },
      select: { month: true, totalGross: true, totalNet: true, totalDeductions: true, employeeCount: true },
    });

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
