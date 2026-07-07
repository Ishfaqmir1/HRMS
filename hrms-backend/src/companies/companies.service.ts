import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

@Injectable()
export class CompaniesService {
  constructor(private prisma: PrismaService) {}

  async getMyCompany(companyId: string) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundException('Company not found.');
    return company;
  }

  async updateMyCompany(companyId: string, dto: UpdateCompanyDto) {
    await this.getMyCompany(companyId);
    return this.prisma.company.update({ where: { id: companyId }, data: dto });
  }

  /** Platform-level: list every tenant. Restricted to SUPER_ADMIN. */
  async findAll(query: PaginationQueryDto) {
    const where = {
      deletedAt: null,
      ...(query.search && {
        OR: [
          { name: { contains: query.search, mode: 'insensitive' as const } },
          { slug: { contains: query.search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.company.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { employees: true, users: true } } },
      }),
      this.prisma.company.count({ where }),
    ]);

    return {
      items,
      meta: { total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) },
    };
  }

  async setStatus(companyId: string, status: 'ACTIVE' | 'SUSPENDED' | 'CANCELLED') {
    await this.getMyCompany(companyId);
    return this.prisma.company.update({
      where: { id: companyId },
      data: { status, isActive: status === 'ACTIVE' },
    });
  }
}
