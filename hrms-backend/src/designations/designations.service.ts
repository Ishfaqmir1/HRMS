import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDesignationDto, UpdateDesignationDto } from './dto/create-designation.dto';

@Injectable()
export class DesignationsService {
  constructor(private prisma: PrismaService) {}

  async create(companyId: string, dto: CreateDesignationDto) {
    const existing = await this.prisma.designation.findFirst({
      where: { companyId, title: dto.title },
    });
    if (existing) {
      throw new ConflictException('A designation with this title already exists.');
    }
    return this.prisma.designation.create({ data: { ...dto, companyId } });
  }

  async findAll(companyId: string) {
    return this.prisma.designation.findMany({
      where: { companyId, isActive: true },
      orderBy: { level: 'asc' },
      include: { _count: { select: { employees: true } } },
    });
  }

  async findOne(companyId: string, id: string) {
    const d = await this.prisma.designation.findFirst({
      where: { id, companyId },
      include: { _count: { select: { employees: true } } },
    });
    if (!d) throw new NotFoundException('Designation not found.');
    return d;
  }

  async update(companyId: string, id: string, dto: UpdateDesignationDto) {
    await this.findOne(companyId, id);
    return this.prisma.designation.update({ where: { id }, data: dto });
  }

  async remove(companyId: string, id: string) {
    await this.findOne(companyId, id);
    return this.prisma.designation.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
