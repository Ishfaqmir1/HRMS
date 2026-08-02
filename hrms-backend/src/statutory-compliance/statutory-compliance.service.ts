import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  UpdateComplianceConfigDto,
  CalculateStatutoryDeductionsDto,
  CalculateStatutoryDeductionsResult,
} from './dto/statutory-compliance.dto';

@Injectable()
export class StatutoryComplianceService {
  constructor(private prisma: PrismaService) {}

  // ====================================================================
  // PF (Provident Fund) Calculator
  // ====================================================================
  /**
   * Employee PF: 12% of basic+DA (capped at ₹15,000/month statutory ceiling).
   * Employer PF: 13% total, broken as 3.67% EPF + 8.33% EPS + 0.5% EDLI + 0.5% EDLI Admin.
   * EPS (8.33%) is capped at ₹15,000/month regardless of actual wages.
   */
  /**
   * Employee PF: 12% of PF wages (capped at ₹15,000/month ceiling).
   * Employer PF: 13% total, broken as 3.67% EPF + 8.33% EPS + 0.5% EDLI + 0.5% EDLI Admin.
   * EPS (8.33%) is capped at ₹15,000/month regardless of actual wages.
   * The employerPct parameter is stored for config flexibility (actual statutory split is hardcoded).
   */
  calculatePf(grossPay: number, ceiling: number = 15000, empPct: number = 12, employerPct: number = 13) {
    // PF applies only on basic wages up to the statutory ceiling
    const pfWages = Math.min(grossPay, ceiling);

    // Employee share: empPct% of PF wages
    const employeeShare = Math.round((pfWages * empPct) / 100);

    // Employer share breakdown (statutory rates):
    //   3.67% EPF (on actual PF wages, up to ceiling)
    //   8.33% EPS (capped at ₹15,000/month)
    //   0.50% EDLI (on PF wages)
    //   0.50% EDLI Admin charges (on PF wages)
    //   Total: 13% employer contribution
    const epsCapped = Math.min(pfWages, 15000);
    const epsShare = Math.round((epsCapped * 8.33) / 100);
    const epfShare = Math.round((pfWages * 3.67) / 100);
    const edliShare = Math.round((pfWages * 0.5) / 100);
    const edliAdminShare = Math.round((pfWages * 0.5) / 100);
    const employerShare = epfShare + epsShare + edliShare + edliAdminShare;

    return {
      employeeShare,
      employerShare,
      epfShare,
      epsShare,
      edliShare,
      edliAdminShare,
      pfWages,
      totalPct: { employee: empPct, employer: employerPct },
    };
  }

  // ====================================================================
  // ESI (Employee State Insurance) Calculator
  // ====================================================================
  /**
   * Employee ESI: 0.75% of gross wages (up to ₹21,000/month)
   * Employer ESI: 3.25% of gross wages (up to ₹21,000/month)
   */
  calculateEsi(grossPay: number, ceiling: number = 21000, empPct: number = 0.75, employerPct: number = 3.25) {
    if (grossPay > ceiling) {
      return { employeeShare: 0, employerShare: 0, esiWages: grossPay, applicable: false };
    }
    const employeeShare = Math.round((grossPay * empPct) / 100);
    const employerShare = Math.round((grossPay * employerPct) / 100);
    return { employeeShare, employerShare, esiWages: grossPay, applicable: true };
  }

  // ====================================================================
  // Professional Tax (PT) Calculator — state-wise slabs
  // ====================================================================
  /**
   * Returns monthly professional tax based on state and gross salary.
   * Capped at ₹2,500/annum constitutionally.
   */
  calculatePt(grossPay: number, state: string = 'KARNATAKA'): number {
    const slabs: Record<string, Array<{ min: number; max: number; tax: number }>> = {
      KARNATAKA: [
        { min: 0, max: 15000, tax: 0 },
        { min: 15001, max: 25000, tax: 100 },
        { min: 25001, max: Infinity, tax: 200 },
      ],
      MAHARASHTRA: [
        { min: 0, max: 10000, tax: 0 },
        { min: 10001, max: 75000, tax: 175 },
        { min: 75001, max: Infinity, tax: 200 },
        // Note: Maharashtra also has a special ₹300 for the last month (February)
      ],
      TAMIL_NADU: [
        { min: 0, max: 21000, tax: 0 },
        { min: 21001, max: 30000, tax: 100 },
        { min: 30001, max: 45000, tax: 200 },
        { min: 45001, max: 60000, tax: 400 },
        { min: 60001, max: 75000, tax: 625 },
        { min: 75001, max: Infinity, tax: 833 }, // ₹1,250/quarter → ~₹833/month
      ],
      ANDHRA_PRADESH: [
        { min: 0, max: 15000, tax: 0 },
        { min: 15001, max: 20000, tax: 150 },
        { min: 20001, max: Infinity, tax: 200 },
      ],
      TELANGANA: [
        { min: 0, max: 15000, tax: 0 },
        { min: 15001, max: 20000, tax: 150 },
        { min: 20001, max: Infinity, tax: 200 },
      ],
      GUJARAT: [
        { min: 0, max: 12000, tax: 0 },
        { min: 12001, max: Infinity, tax: 200 },
      ],
      WEST_BENGAL: [
        { min: 0, max: 10000, tax: 0 },
        { min: 10001, max: 15000, tax: 110 },
        { min: 15001, max: 25000, tax: 130 },
        { min: 25001, max: 40000, tax: 150 },
        { min: 40001, max: Infinity, tax: 200 },
      ],
      // Default for states without PT
      DEFAULT: [
        { min: 0, max: Infinity, tax: 0 },
      ],
    };

    const stateSlabs = slabs[state] || slabs['DEFAULT'];
    for (const slab of stateSlabs) {
      if (grossPay >= slab.min && grossPay <= slab.max) {
        return slab.tax;
      }
    }
    return 0;
  }

  // ====================================================================
  // TDS (Income Tax) Calculator — monthly estimate
  // ====================================================================
  /**
   * Calculates estimated monthly TDS based on annual projection.
   * Supports both New and Old tax regimes.
   */
  calculateTds(grossPay: number, newRegime: boolean = true): number {
    const annualSalary = grossPay * 12;
    const standardDeduction = newRegime ? 75000 : 50000;

    let taxableIncome = Math.max(0, annualSalary - standardDeduction);

    // Section 87A rebate
    const rebate87a = newRegime ? 60000 : 12500;

    let tax: number;

    if (newRegime) {
      // New Tax Regime FY 2025-26
      if (taxableIncome <= 400000) {
        tax = 0;
      } else if (taxableIncome <= 800000) {
        tax = (taxableIncome - 400000) * 0.05;
      } else if (taxableIncome <= 1200000) {
        tax = 20000 + (taxableIncome - 800000) * 0.10;
      } else if (taxableIncome <= 1600000) {
        tax = 60000 + (taxableIncome - 1200000) * 0.15;
      } else if (taxableIncome <= 2000000) {
        tax = 120000 + (taxableIncome - 1600000) * 0.20;
      } else {
        tax = 200000 + (taxableIncome - 2000000) * 0.30;
      }

      // Apply rebate: up to ₹12L taxable income = no tax
      if (taxableIncome <= 1200000) {
        tax = Math.max(0, tax - rebate87a);
      }
    } else {
      // Old Tax Regime FY 2025-26
      if (taxableIncome <= 250000) {
        tax = 0;
      } else if (taxableIncome <= 500000) {
        tax = (taxableIncome - 250000) * 0.05;
      } else if (taxableIncome <= 1000000) {
        tax = 12500 + (taxableIncome - 500000) * 0.20;
      } else {
        tax = 112500 + (taxableIncome - 1000000) * 0.30;
      }

      // Apply rebate (up to ₹5L old regime)
      if (taxableIncome <= 500000) {
        tax = Math.max(0, tax - rebate87a);
      }
    }

    // Add 4% Health & Education Cess
    tax = Math.round(tax * 1.04);

    // Monthly TDS estimate
    const monthlyTds = Math.round(tax / 12);

    return monthlyTds;
  }

  // ====================================================================
  // Comprehensive Statutory Deduction Calculator
  // ====================================================================
  /**
   * Calculates all statutory deductions for a given gross pay.
   * Respects company-level compliance configuration.
   */
  async calculateAllDeductions(
    companyId: string,
    grossPay: number,
  ): Promise<CalculateStatutoryDeductionsResult> {
    const config = await this.prisma.complianceConfig.findUnique({
      where: { companyId },
    });

    const enabled = config || {
      enablePf: true,
      pfWageCeiling: 15000,
      pfEmployeePct: 12,
      pfEmployerPct: 12,
      enableEsi: true,
      esiWageCeiling: 21000,
      esiEmployeePct: 0.75,
      esiEmployerPct: 3.25,
      enablePt: true,
      ptState: 'KARNATAKA',
      enableTds: true,
      tdsRegime: 'NEW',
    };

    let pfEmployeeShare = 0;
    let pfEmployerShare = 0;
    let esiEmployeeShare = 0;
    let esiEmployerShare = 0;
    let professionalTax = 0;
    let tdsEstimatedMonthly = 0;

    if (enabled.enablePf) {
      const pf = this.calculatePf(grossPay, enabled.pfWageCeiling, enabled.pfEmployeePct, enabled.pfEmployerPct);
      pfEmployeeShare = pf.employeeShare;
      pfEmployerShare = pf.employerShare;
    }

    if (enabled.enableEsi) {
      const esi = this.calculateEsi(grossPay, enabled.esiWageCeiling, enabled.esiEmployeePct, enabled.esiEmployerPct);
      esiEmployeeShare = esi.employeeShare;
      esiEmployerShare = esi.employerShare;
    }

    if (enabled.enablePt) {
      professionalTax = this.calculatePt(grossPay, enabled.ptState);
    }

    if (enabled.enableTds) {
      tdsEstimatedMonthly = this.calculateTds(grossPay, enabled.tdsRegime === 'NEW');
    }

    const totalEmployeeDeductions = pfEmployeeShare + esiEmployeeShare + professionalTax + tdsEstimatedMonthly;
    const totalEmployerContributions = pfEmployerShare + esiEmployerShare;

    return {
      pfEmployeeShare,
      pfEmployerShare,
      esiEmployeeShare,
      esiEmployerShare,
      professionalTax,
      tdsEstimatedMonthly,
      totalEmployeeDeductions,
      totalEmployerContributions,
    };
  }

  // ====================================================================
  // Compliance Configuration CRUD
  // ====================================================================

  async getConfig(companyId: string) {
    let config = await this.prisma.complianceConfig.findUnique({
      where: { companyId },
    });
    if (!config) {
      // Return defaults if not configured
      config = await this.prisma.complianceConfig.create({
        data: { companyId },
      });
    }
    return config;
  }

  async updateConfig(companyId: string, dto: UpdateComplianceConfigDto) {
    const existing = await this.prisma.complianceConfig.findUnique({
      where: { companyId },
    });
    if (!existing) {
      return this.prisma.complianceConfig.create({
        data: { companyId, ...dto },
      });
    }
    return this.prisma.complianceConfig.update({
      where: { companyId },
      data: dto,
    });
  }

  // ====================================================================
  // Professional Tax Slabs Management
  // ====================================================================

  async getPtSlabs(companyId: string, state?: string) {
    const where: any = { companyId };
    if (state) where.state = state;
    return this.prisma.professionalTaxSlab.findMany({
      where,
      orderBy: [{ state: 'asc' }, { minSalary: 'asc' }],
    });
  }
}
