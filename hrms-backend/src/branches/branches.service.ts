import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisCacheService } from '../redis/redis-cache.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { SetBranchGeoDto } from './dto/set-branch-geo.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

const BRANCH_CACHE_TTL = 600; // 10 minutes

@Injectable()
export class BranchesService {
  constructor(
    private prisma: PrismaService,
    private cache: RedisCacheService,
  ) {}

  async create(companyId: string, dto: CreateBranchDto) {
    const result = await this.prisma.branch.create({ data: { ...dto, companyId } });
    await this.cache.delPattern(`branches:${companyId}:*`);
    return result;
  }

  async findAll(companyId: string, query: PaginationQueryDto) {
    // Cache the first page without search (common case for dropdowns)
    if (!query.search && query.page === 1) {
      const cacheKey = RedisCacheService.key('branches', 'list', companyId);
      return this.cache.getOrSet(cacheKey, BRANCH_CACHE_TTL, () => this._findAll(companyId, query));
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
      this.prisma.branch.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.branch.count({ where }),
    ]);

    return {
      items,
      meta: { total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) },
    };
  }

  async findOne(companyId: string, id: string) {
    const branch = await this.prisma.branch.findFirst({ where: { id, companyId, deletedAt: null } });
    if (!branch) throw new NotFoundException('Branch not found.');
    return branch;
  }

  async update(companyId: string, id: string, dto: UpdateBranchDto) {
    await this.findOne(companyId, id);
    const result = await this.prisma.branch.update({ where: { id }, data: dto });
    await this.cache.delPattern(`branches:${companyId}:*`);
    return result;
  }

  async remove(companyId: string, id: string) {
    await this.findOne(companyId, id);
    const result = await this.prisma.branch.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
    await this.cache.delPattern(`branches:${companyId}:*`);
    return result;
  }

  async setGeoLocation(companyId: string, id: string, dto: SetBranchGeoDto) {
    await this.findOne(companyId, id);
    const result = await this.prisma.branch.update({
      where: { id },
      data: {
        latitude: dto.latitude,
        longitude: dto.longitude,
        geoFenceRadiusMeters: dto.geoFenceRadiusMeters ?? 500,
      },
    });
    await this.cache.delPattern(`branches:${companyId}:*`);
    return result;
  }
}
