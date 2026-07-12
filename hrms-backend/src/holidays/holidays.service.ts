import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisCacheService } from '../redis/redis-cache.service';
import { CreateHolidayDto, UpdateHolidayDto } from './dto/holiday.dto';

@Injectable()
export class HolidaysService {
  constructor(
    private prisma: PrismaService,
    private cache: RedisCacheService,
  ) {}

  create(companyId: string, dto: CreateHolidayDto) {
    // Invalidate holidays cache for this company
    this.cache.delPattern(`holidays:${companyId}:*`);
    return this.prisma.holiday.create({
      data: { ...dto, companyId, date: new Date(dto.date) },
    });
  }

  findAll(companyId: string, year?: number) {
    const cacheKey = RedisCacheService.key('holidays', companyId, year?.toString() ?? 'all');
    return this.cache.getOrSet(cacheKey, 600, async () => {
      const where = {
        companyId,
        ...(year && {
          date: {
            gte: new Date(Date.UTC(year, 0, 1)),
            lt: new Date(Date.UTC(year + 1, 0, 1)),
          },
        }),
      };
      return this.prisma.holiday.findMany({ where, orderBy: { date: 'asc' } });
    });
  }

  async findOne(companyId: string, id: string) {
    const holiday = await this.prisma.holiday.findFirst({ where: { id, companyId } });
    if (!holiday) throw new NotFoundException('Holiday not found.');
    return holiday;
  }

  async update(companyId: string, id: string, dto: UpdateHolidayDto) {
    await this.findOne(companyId, id);
    // Invalidate holidays cache
    this.cache.delPattern(`holidays:${companyId}:*`);
    return this.prisma.holiday.update({
      where: { id },
      data: { ...dto, date: dto.date ? new Date(dto.date) : undefined },
    });
  }

  async remove(companyId: string, id: string) {
    await this.findOne(companyId, id);
    // Invalidate holidays cache
    this.cache.delPattern(`holidays:${companyId}:*`);
    await this.prisma.holiday.delete({ where: { id } });
    return { message: 'Holiday removed.' };
  }
}
