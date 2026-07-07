import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TrainingService {
  constructor(private prisma: PrismaService) {}

  async findMyEnrollments(employeeId: string) {
    return this.prisma.trainingEnrollment.findMany({
      where: { employeeId },
      include: { training: true },
      orderBy: { enrolledAt: 'desc' },
    });
  }
}
