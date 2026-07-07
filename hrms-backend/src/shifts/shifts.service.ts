import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateShiftDto, UpdateShiftDto, AssignShiftDto } from './dto/shift.dto';

@Injectable()
export class ShiftsService {
  constructor(private prisma: PrismaService) {}

  create(companyId: string, dto: CreateShiftDto) {
    return this.prisma.shift.create({ data: { ...dto, companyId } });
  }

  findAll(companyId: string) {
    return this.prisma.shift.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { employees: true } } },
    });
  }

  async findOne(companyId: string, id: string) {
    const shift = await this.prisma.shift.findFirst({ where: { id, companyId } });
    if (!shift) throw new NotFoundException('Shift not found.');
    return shift;
  }

  async update(companyId: string, id: string, dto: UpdateShiftDto) {
    await this.findOne(companyId, id);
    return this.prisma.shift.update({ where: { id }, data: dto });
  }

  async remove(companyId: string, id: string) {
    await this.findOne(companyId, id);
    // Detach employees rather than blocking delete on FK — SetNull handles this,
    // but we do it explicitly first so the response reflects intent clearly.
    await this.prisma.employee.updateMany({ where: { shiftId: id, companyId }, data: { shiftId: null } });
    return this.prisma.shift.update({ where: { id }, data: { isActive: false } });
  }

  async assign(companyId: string, id: string, dto: AssignShiftDto) {
    await this.findOne(companyId, id);
    const result = await this.prisma.employee.updateMany({
      where: { id: { in: dto.employeeIds }, companyId },
      data: { shiftId: id },
    });
    return { assignedCount: result.count };
  }
}
