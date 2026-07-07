import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLeaveTypeDto, UpdateLeaveTypeDto } from './dto/leave-type.dto';

@Injectable()
export class LeaveTypesService {
  constructor(private prisma: PrismaService) {}

  async create(companyId: string, dto: CreateLeaveTypeDto) {
    const existing = await this.prisma.leaveType.findUnique({
      where: { companyId_code: { companyId, code: dto.code } },
    });
    if (existing) throw new ConflictException('A leave type with this code already exists.');
    return this.prisma.leaveType.create({ data: { ...dto, companyId } });
  }

  findAll(companyId: string) {
    return this.prisma.leaveType.findMany({ where: { companyId }, orderBy: { name: 'asc' } });
  }

  async findOne(companyId: string, id: string) {
    const leaveType = await this.prisma.leaveType.findFirst({ where: { id, companyId } });
    if (!leaveType) throw new NotFoundException('Leave type not found.');
    return leaveType;
  }

  async update(companyId: string, id: string, dto: UpdateLeaveTypeDto) {
    await this.findOne(companyId, id);
    return this.prisma.leaveType.update({ where: { id }, data: dto });
  }

  async remove(companyId: string, id: string) {
    await this.findOne(companyId, id);
    return this.prisma.leaveType.update({ where: { id }, data: { isActive: false } });
  }
}
