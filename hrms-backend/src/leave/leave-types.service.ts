import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisCacheService } from '../redis/redis-cache.service';
import { CreateLeaveTypeDto, UpdateLeaveTypeDto } from './dto/leave-type.dto';

const LEAVE_TYPE_CACHE_TTL = 600; // 10 minutes

@Injectable()
export class LeaveTypesService {
  constructor(
    private prisma: PrismaService,
    private cache: RedisCacheService,
  ) {}

  async create(companyId: string, dto: CreateLeaveTypeDto) {
    const existing = await this.prisma.leaveType.findUnique({
      where: { companyId_code: { companyId, code: dto.code } },
    });
    if (existing) throw new ConflictException('A leave type with this code already exists.');
    const result = await this.prisma.leaveType.create({ data: { ...dto, companyId } });
    await this.cache.delPattern(`leaveTypes:${companyId}:*`);
    return result;
  }

  async findAll(companyId: string) {
    const cacheKey = RedisCacheService.key('leaveTypes', 'list', companyId);
    return this.cache.getOrSet(cacheKey, LEAVE_TYPE_CACHE_TTL, () =>
      this.prisma.leaveType.findMany({ where: { companyId }, orderBy: { name: 'asc' } }),
    );
  }

  async findOne(companyId: string, id: string) {
    const leaveType = await this.prisma.leaveType.findFirst({ where: { id, companyId } });
    if (!leaveType) throw new NotFoundException('Leave type not found.');
    return leaveType;
  }

  async update(companyId: string, id: string, dto: UpdateLeaveTypeDto) {
    await this.findOne(companyId, id);
    const result = await this.prisma.leaveType.update({ where: { id }, data: dto });
    await this.cache.delPattern(`leaveTypes:${companyId}:*`);
    return result;
  }

  async remove(companyId: string, id: string) {
    await this.findOne(companyId, id);
    const result = await this.prisma.leaveType.update({ where: { id }, data: { isActive: false } });
    await this.cache.delPattern(`leaveTypes:${companyId}:*`);
    return result;
  }
}
