import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisCacheService } from '../redis/redis-cache.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

const DEPT_CACHE_TTL = 600; // 10 minutes

@Injectable()
export class DepartmentsService {
  constructor(
    private prisma: PrismaService,
    private cache: RedisCacheService,
  ) {}

  async create(companyId: string, dto: CreateDepartmentDto) {
    const result = await this.prisma.department.create({ data: { ...dto, companyId } });
    await this.cache.delPattern(`departments:${companyId}:*`);
    return result;
  }

  async findAll(companyId: string, query: PaginationQueryDto) {
    // Cache the first page without search (common case for dropdowns)
    if (!query.search && query.page === 1) {
      const cacheKey = RedisCacheService.key('departments', 'list', companyId);
      return this.cache.getOrSet(cacheKey, DEPT_CACHE_TTL, () => this._findAll(companyId, query));
    }
    return this._findAll(companyId, query);
  }

  private async _findAll(companyId: string, query: PaginationQueryDto) {
    const where = {
      companyId,
      deletedAt: null,
      ...(query.search && {
        OR: [
          { name: { contains: query.search, mode: 'insensitive' as const } },
          { code: { contains: query.search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.department.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
        include: { branch: { select: { id: true, name: true } }, parent: { select: { id: true, name: true } } },
      }),
      this.prisma.department.count({ where }),
    ]);

    return {
      items,
      meta: { total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) },
    };
  }

  async findOne(companyId: string, id: string) {
    const department = await this.prisma.department.findFirst({
      where: { id, companyId, deletedAt: null },
      include: { children: true, branch: true },
    });
    if (!department) throw new NotFoundException('Department not found.');
    return department;
  }

  async update(companyId: string, id: string, dto: UpdateDepartmentDto) {
    await this.findOne(companyId, id);
    const result = await this.prisma.department.update({ where: { id }, data: dto });
    await this.cache.delPattern(`departments:${companyId}:*`);
    return result;
  }

  async remove(companyId: string, id: string) {
    await this.findOne(companyId, id);
    const result = await this.prisma.department.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
    await this.cache.delPattern(`departments:${companyId}:*`);
    return result;
  }
}
