import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaxDeclarationDto, UpdateTaxDeclarationDto } from './dto/tax-declarations.dto';

@Injectable()
export class TaxDeclarationsService {
  constructor(private prisma: PrismaService) {}

  async create(companyId: string, employeeId: string, dto: CreateTaxDeclarationDto) {
    return this.prisma.taxDeclaration.upsert({
      where: { companyId_employeeId_financialYear: { companyId, employeeId, financialYear: dto.financialYear } },
      update: {
        panNumber: dto.panNumber,
        declarations: dto.declarations,
        totalIncome: dto.totalIncome,
        totalDeductions: dto.totalDeductions,
        totalTaxPaid: dto.totalTaxPaid,
      },
      create: {
        companyId,
        employeeId,
        financialYear: dto.financialYear,
        panNumber: dto.panNumber,
        declarations: dto.declarations,
        totalIncome: dto.totalIncome,
        totalDeductions: dto.totalDeductions,
        totalTaxPaid: dto.totalTaxPaid,
      },
    });
  }

  async findAll(employeeId: string) {
    return this.prisma.taxDeclaration.findMany({
      where: { employeeId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(employeeId: string, id: string) {
    const td = await this.prisma.taxDeclaration.findFirst({ where: { id, employeeId } });
    if (!td) throw new NotFoundException('Tax declaration not found.');
    return td;
  }

  async update(employeeId: string, id: string, dto: UpdateTaxDeclarationDto) {
    await this.findOne(employeeId, id);
    return this.prisma.taxDeclaration.update({ where: { id }, data: dto });
  }

  async submit(companyId: string, employeeId: string, financialYear: string) {
    const td = await this.prisma.taxDeclaration.findUnique({
      where: { companyId_employeeId_financialYear: { companyId, employeeId, financialYear } },
    });
    if (!td) throw new NotFoundException('Tax declaration not found.');
    return this.prisma.taxDeclaration.update({
      where: { id: td.id },
      data: { status: 'SUBMITTED', submittedAt: new Date() },
    });
  }
}
