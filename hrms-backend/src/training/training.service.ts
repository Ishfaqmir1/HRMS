import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTrainingDto, UpdateTrainingDto } from './dto/training.dto';

@Injectable()
export class TrainingService {
  constructor(private prisma: PrismaService) {}

  // ============ Admin CRUD ============

  async create(companyId: string, dto: CreateTrainingDto) {
    return this.prisma.training.create({
      data: {
        ...dto,
        companyId,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      },
    });
  }

  async findAll(companyId: string) {
    return this.prisma.training.findMany({
      where: { companyId },
      orderBy: { startDate: 'desc' },
      include: { _count: { select: { enrollments: true } } },
    });
  }

  async findOne(companyId: string, id: string) {
    const t = await this.prisma.training.findFirst({
      where: { id, companyId },
      include: {
        _count: { select: { enrollments: true } },
        enrollments: {
          include: { employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } } },
        },
      },
    });
    if (!t) throw new NotFoundException('Training program not found.');
    return t;
  }

  async update(companyId: string, id: string, dto: UpdateTrainingDto) {
    await this.findOne(companyId, id);
    return this.prisma.training.update({
      where: { id },
      data: {
        ...dto,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      },
    });
  }

  async updateStatus(companyId: string, id: string, status: string) {
    await this.findOne(companyId, id);
    return this.prisma.training.update({
      where: { id },
      data: { status: status as any },
    });
  }

  // ============ Employee self-service ============

  async findMyEnrollments(employeeId: string) {
    return this.prisma.trainingEnrollment.findMany({
      where: { employeeId },
      include: { training: true },
      orderBy: { enrolledAt: 'desc' },
    });
  }
}
