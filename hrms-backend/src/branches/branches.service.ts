import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { SetBranchGeoDto } from './dto/set-branch-geo.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

@Injectable()
export class BranchesService {
  constructor(private prisma: PrismaService) {}

  async create(companyId: string, dto: CreateBranchDto) {
    return this.prisma.branch.create({ data: { ...dto, companyId } });
  }

  async findAll(companyId: string, query: PaginationQueryDto) {
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
    return this.prisma.branch.update({ where: { id }, data: dto });
  }

  async remove(companyId: string, id: string) {
    await this.findOne(companyId, id);
    return this.prisma.branch.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
  }

  async setGeoLocation(companyId: string, id: string, dto: SetBranchGeoDto) {
    await this.findOne(companyId, id);
    return this.prisma.branch.update({
      where: { id },
      data: {
        latitude: dto.latitude,
        longitude: dto.longitude,
        geoFenceRadiusMeters: dto.geoFenceRadiusMeters ?? 500,
      },
    });
  }
}
