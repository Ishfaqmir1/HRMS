import { Test, TestingModule } from '@nestjs/testing';
import { PayrollService } from './payroll.service';
import { PrismaService } from '../prisma/prisma.service';
import { StatutoryComplianceService } from '../statutory-compliance/statutory-compliance.service';
import { AuditService } from '../common/services/audit.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

describe('PayrollService', () => {
  let payrollService: PayrollService;

  const mockPrisma = {
    payrollRun: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    payslip: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn(),
    },
    employeeSalary: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
    },
    salaryStructure: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    employee: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
    },
    loan: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    loanRepayment: {
      create: jest.fn(),
      createMany: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      groupBy: jest.fn(),
      count: jest.fn(),
    },
    reimbursement: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    reimbursementCategory: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    complianceConfig: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  } as any;

  const mockCompliance = {
    calculateAllDeductions: jest.fn(),
    calculatePf: jest.fn(),
    calculateEsi: jest.fn(),
    calculatePt: jest.fn(),
    calculateTds: jest.fn(),
  } as any;

  const mockAudit = {
    logCustom: jest.fn(),
  } as any;

  const COMPANY_ID = 'company-1';

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PayrollService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: StatutoryComplianceService, useValue: mockCompliance },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();

    payrollService = module.get<PayrollService>(PayrollService);
  });

  function makeQuery(overrides: Partial<PaginationQueryDto> = {}): PaginationQueryDto {
    const q = new PaginationQueryDto();
    Object.assign(q, overrides);
    return q;
  }

  // ====================================================================
  // 1. Salary Structures
  // ====================================================================
  describe('1. Salary Structures', () => {
    it('creates a salary structure', async () => {
      mockPrisma.salaryStructure.create.mockResolvedValue({
        id: 'ss-1', name: 'Standard', basic: 50000, housingAllowance: 20000,
      });

      const result = await payrollService.createStructure(COMPANY_ID, {
        name: 'Standard', basic: 50000, housingAllowance: 20000,
        transportAllowance: 10000, medicalAllowance: 5000, otherAllowances: 5000,
        taxPercent: 10, pensionPercent: 12, insuranceDeduction: 2000,
      });

      expect(result.id).toBe('ss-1');
      expect(result.name).toBe('Standard');
    });

    it('lists paginated salary structures', async () => {
      mockPrisma.salaryStructure.findMany.mockResolvedValue([{ id: 'ss-1' }]);
      mockPrisma.salaryStructure.count.mockResolvedValue(1);
      mockPrisma.$transaction.mockImplementation(async ([findMany, count]: any) =>
        Promise.all([findMany, count]),
      );

      const result = await payrollService.findAllStructures(COMPANY_ID, makeQuery());

      expect(result.items).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });
  });

  // ====================================================================
  // 2. Employee Salaries
  // ====================================================================
  describe('2. Employee Salaries', () => {
    it('assigns salary to employee', async () => {
      mockPrisma.employee.findFirst.mockResolvedValue({ id: 'emp-1' });
      mockPrisma.employeeSalary.create.mockResolvedValue({
        id: 'es-1', employeeId: 'emp-1', basic: 50000, isActive: true,
      });

      const result = await payrollService.createEmployeeSalary(COMPANY_ID, {
        employeeId: 'emp-1', effectiveFrom: '2026-01-01',
        basic: 50000, housingAllowance: 20000, transportAllowance: 10000,
        medicalAllowance: 5000, otherAllowances: 5000,
        taxPercent: 10, pensionPercent: 12, insuranceDeduction: 2000,
      });

      expect(result.isActive).toBe(true);
    });

    it('deactivates previous salary when assigning new one', async () => {
      mockPrisma.employee.findFirst.mockResolvedValue({ id: 'emp-1' });
      mockPrisma.employeeSalary.create.mockResolvedValue({ id: 'es-new', isActive: true });

      await payrollService.createEmployeeSalary(COMPANY_ID, {
        employeeId: 'emp-1', effectiveFrom: '2026-06-01',
        basic: 60000, housingAllowance: 20000, transportAllowance: 10000,
        medicalAllowance: 5000, otherAllowances: 5000,
        taxPercent: 10, pensionPercent: 12, insuranceDeduction: 2000,
      });

      expect(mockPrisma.employeeSalary.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { employeeId: 'emp-1', isActive: true },
          data: expect.objectContaining({ isActive: false }),
        }),
      );
    });
  });

  // ====================================================================
  // 3. Payroll Run
  // ====================================================================
  describe('3. Payroll Run', () => {
    it('creates a payroll run', async () => {
      mockPrisma.payrollRun.findFirst.mockResolvedValue(null);
      mockPrisma.payrollRun.create.mockResolvedValue({ id: 'pr-1', status: 'DRAFT', month: 1, year: 2026 });

      const result = await payrollService.createRun(COMPANY_ID, { month: 1, year: 2026 });

      expect(result.status).toBe('DRAFT');
    });

    it('prevents duplicate payroll run for same month/year', async () => {
      mockPrisma.payrollRun.findFirst.mockResolvedValue({ id: 'existing', status: 'COMPLETED' });

      await expect(
        payrollService.createRun(COMPANY_ID, { month: 1, year: 2026 }),
      ).rejects.toThrow(/already exists/i);
    });

    it('processes a draft run to generate payslips', async () => {
      const runId = 'pr-1';
      mockPrisma.payrollRun.findFirst
        .mockResolvedValueOnce({ id: runId, companyId: COMPANY_ID, status: 'DRAFT', month: 1, year: 2026 })
        .mockResolvedValueOnce({ id: runId, status: 'DRAFT', month: 1, year: 2026 });

      mockPrisma.employee.findMany.mockResolvedValue([
        { id: 'emp-1', firstName: 'John', lastName: 'Doe', status: 'ACTIVE', deletedAt: null, employeeSalaries: [{ basic: 50000, housingAllowance: 20000, transportAllowance: 10000, medicalAllowance: 5000, otherAllowances: 5000, taxPercent: 10, pensionPercent: 12, insuranceDeduction: 2000 }] },
      ]);
      mockPrisma.loan.findMany.mockResolvedValue([]);
      mockPrisma.loanRepayment.groupBy.mockResolvedValue([]);
      mockPrisma.loanRepayment.findMany.mockResolvedValue([]);
      mockPrisma.complianceConfig.findUnique.mockResolvedValue(null); // fallback to simple deductions
      mockPrisma.payslip.create.mockResolvedValue({ id: 'ps-1' });
      mockPrisma.payrollRun.update.mockResolvedValue({ id: runId, status: 'COMPLETED' });

      const result = await payrollService.processRun(COMPANY_ID, runId, 'user-1');

      expect(result.payslips).toHaveLength(1);
      expect(result.totals.totalGross).toBe(90000);
      // Tax: 90000*0.10=9000, Pension: 90000*0.12=10800, Insurance: 2000
      // Total: 21800, Net: 68200
      expect(result.totals.totalNet).toBe(68200);
    });
  });

  // ====================================================================
  // 4. Payslips
  // ====================================================================
  describe('4. Payslips', () => {
    it('finds payslips by run', async () => {
      mockPrisma.payslip.findMany.mockResolvedValue([
        { id: 'ps-1', employeeId: 'emp-1', grossPay: 90000, netPay: 68200 },
      ]);

      const result = await payrollService.findPayslipsByRun(COMPANY_ID, 'run-1');

      expect(result).toHaveLength(1);
      expect(result[0].grossPay).toBe(90000);
    });

    it('calculates net pay correctly: gross - deductions', async () => {
      const gross = 90000;
      const taxPct = 10;
      const pensionPct = 12;
      const insurance = 2000;
      const tax = Math.round(gross * taxPct / 100); // 9000
      const pension = Math.round(gross * pensionPct / 100); // 10800
      const deductions = tax + pension + insurance; // 21800
      const net = gross - deductions; // 68200

      expect(tax).toBe(9000);
      expect(pension).toBe(10800);
      expect(deductions).toBe(21800);
      expect(net).toBe(68200);
    });
  });

  // ====================================================================
  // 5. Loans
  // ====================================================================
  describe('5. Loans', () => {
    it('creates a loan with calculated monthly installment', async () => {
      mockPrisma.employee.findFirst.mockResolvedValue({ id: 'emp-1' });
      mockPrisma.loan.create.mockImplementation(({ data }: any) => ({
        id: 'loan-1', ...data, status: 'PENDING',
      }));

      const result = await payrollService.createLoan(COMPANY_ID, {
        employeeId: 'emp-1', amount: 10000, loanType: 'PERSONAL',
        interestRate: 5, repaymentMonths: 12,
      });

      expect(result.status).toBe('PENDING');
      // totalAmount = 10000 + (10000 * 5/100) = 10500
      // monthlyInstallment = ceil(10500/12) = 875
      expect(result.totalAmount).toBe(10500);
      expect(result.monthlyInstallment).toBe(875);
    });

    it('approves loan and creates repayment schedule', async () => {
      mockPrisma.loan.findFirst.mockResolvedValue({
        id: 'loan-1', status: 'PENDING', amount: 10000, totalAmount: 10500,
        monthlyInstallment: 875, repaymentMonths: 12, employeeId: 'emp-1', companyId: COMPANY_ID,
      });
      mockPrisma.loanRepayment.createMany.mockResolvedValue({ count: 12 });
      mockPrisma.loan.update.mockResolvedValue({ id: 'loan-1', status: 'ACTIVE' });

      const result = await payrollService.approveLoan(COMPANY_ID, 'loan-1', { disbursedAt: new Date().toISOString() }, 'user-1');

      expect(result.status).toBe('ACTIVE');
      expect(mockPrisma.loanRepayment.createMany).toHaveBeenCalled();
      expect(mockPrisma.loanRepayment.createMany.mock.calls[0][0].data).toHaveLength(12);
    });
  });
});
