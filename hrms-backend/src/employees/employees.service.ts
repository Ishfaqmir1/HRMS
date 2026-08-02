import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { ChangeEmployeeStatusDto } from './dto/change-status.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

@Injectable()
export class EmployeesService {
  constructor(private prisma: PrismaService) {}

  async create(companyId: string, dto: CreateEmployeeDto) {
    const existingCode = await this.prisma.employee.findFirst({
      where: { companyId, employeeCode: dto.employeeCode },
    });
    if (existingCode) {
      throw new ConflictException('An employee with this employee code already exists.');
    }

    const { createLoginAccount, roleSlug, ...employeeData } = dto;

    return this.prisma.$transaction(async (tx) => {
      let userId: string | undefined;
      let temporaryPassword: string | undefined;

      if (createLoginAccount) {
        if (!dto.workEmail) {
          throw new ConflictException('workEmail is required to create a login account.');
        }
        const existingUser = await tx.user.findFirst({
          where: { companyId, email: dto.workEmail.toLowerCase() },
        });
        if (existingUser) {
          throw new ConflictException('A user with this work email already exists in this company.');
        }

        const role = await tx.role.findFirst({
          where: { companyId: null, slug: roleSlug || 'employee', isSystem: true },
        });
        if (!role) {
          throw new ConflictException(`Role "${roleSlug || 'employee'}" was not found.`);
        }

        temporaryPassword = crypto.randomBytes(9).toString('base64url'); // e.g. 12-char temp pw
        const passwordHash = await bcrypt.hash(temporaryPassword, 10);

        const user = await tx.user.create({
          data: {
            companyId,
            email: dto.workEmail.toLowerCase(),
            passwordHash,
            status: 'INVITED',
            mustChangePassword: true,
          },
        });
        await tx.userRole.create({ data: { userId: user.id, roleId: role.id } });
        userId = user.id;
      }

      const employee = await tx.employee.create({
        data: {
          ...employeeData,
          dateOfJoining: new Date(dto.dateOfJoining),
          dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
          companyId,
          userId,
        },
      });

      return { employee, temporaryPassword };
    });
  }

  async findAll(
    companyId: string,
    query: PaginationQueryDto,
    filters: { departmentId?: string; branchId?: string; status?: string } = {},
  ) {
    const where = {
      companyId,
      deletedAt: null,
      ...(filters.departmentId && { departmentId: filters.departmentId }),
      ...(filters.branchId && { branchId: filters.branchId }),
      ...(filters.status && { status: filters.status as any }),
      ...(query.search && {
        OR: [
          { firstName: { contains: query.search, mode: 'insensitive' as const } },
          { lastName: { contains: query.search, mode: 'insensitive' as const } },
          { employeeCode: { contains: query.search, mode: 'insensitive' as const } },
          { workEmail: { contains: query.search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.employee.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          department: { select: { id: true, name: true } },
          branch: { select: { id: true, name: true } },
          designation: { select: { id: true, title: true } },
          reportingManager: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      this.prisma.employee.count({ where }),
    ]);

    return {
      items,
      meta: { total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) },
    };
  }

  async findOne(companyId: string, id: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id, companyId, deletedAt: null },
      select: {
        id: true,
        employeeCode: true,
        firstName: true,
        lastName: true,
        workEmail: true,
        personalEmail: true,
        phone: true,
        gender: true,
        dateOfBirth: true,
        dateOfJoining: true,
        employmentType: true,
        status: true,
        branchId: true,
        departmentId: true,
        designationId: true,
        shiftId: true,
        reportingManagerId: true,
        dateOfExit: true,
        createdAt: true,
        updatedAt: true,
        department: { select: { id: true, name: true, code: true } },
        branch: { select: { id: true, name: true, code: true, city: true } },
        designation: { select: { id: true, title: true, level: true } },
        team: { select: { id: true, name: true } },
        reportingManager: { select: { id: true, firstName: true, lastName: true } },
        directReports: { select: { id: true, firstName: true, lastName: true } },
        user: { select: { id: true, email: true, status: true, lastLoginAt: true } },
      },
    });
    if (!employee) throw new NotFoundException('Employee not found.');
    return employee;
  }

  async update(companyId: string, id: string, dto: UpdateEmployeeDto) {
    await this.findOne(companyId, id);
    return this.prisma.employee.update({
      where: { id },
      data: {
        ...dto,
        dateOfJoining: dto.dateOfJoining ? new Date(dto.dateOfJoining) : undefined,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
      },
    });
  }

  async changeStatus(companyId: string, id: string, dto: ChangeEmployeeStatusDto) {
    await this.findOne(companyId, id);
    return this.prisma.employee.update({
      where: { id },
      data: {
        status: dto.status as any,
        dateOfExit: dto.dateOfExit ? new Date(dto.dateOfExit) : undefined,
      },
    });
  }

  async remove(companyId: string, id: string) {
    await this.findOne(companyId, id);
    return this.prisma.employee.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'TERMINATED' },
    });
  }

  /**
   * Bulk-import employees from an array of pre-validated DTOs.
   * Validates each row individually and collects errors so that a
   * partial success is returned — no transaction rollback on a single
   * bad row.
   */
  async importEmployees(companyId: string, employees: CreateEmployeeDto[]) {
    const results: { row: number; employeeCode: string; status: string; error?: string }[] = [];
    let createdCount = 0;

    for (let i = 0; i < employees.length; i++) {
      const dto = employees[i];
      try {
        // Check for duplicate employee code within the import batch or existing DB
        const existingCode = await this.prisma.employee.findFirst({
          where: { companyId, employeeCode: dto.employeeCode },
        });
        if (existingCode) {
          results.push({
            row: i + 1,
            employeeCode: dto.employeeCode,
            status: 'SKIPPED',
            error: 'Employee code already exists',
          });
          continue;
        }

        const { createLoginAccount, roleSlug, ...employeeData } = dto;

        await this.prisma.$transaction(async (tx) => {
          await tx.employee.create({
            data: {
              ...employeeData,
              dateOfJoining: new Date(dto.dateOfJoining),
              dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
              companyId,
            },
          });
        });

        createdCount++;
        results.push({
          row: i + 1,
          employeeCode: dto.employeeCode,
          status: 'CREATED',
        });
      } catch (err: any) {
        results.push({
          row: i + 1,
          employeeCode: dto.employeeCode,
          status: 'FAILED',
          error: err?.message || 'Unknown error',
        });
      }
    }

    return {
      total: employees.length,
      created: createdCount,
      failed: employees.length - createdCount,
      results,
    };
  }
}
