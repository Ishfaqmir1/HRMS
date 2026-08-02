import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateAttendancePolicyDto } from './dto/attendance-policy.dto';

@Injectable()
export class AttendancePolicyService {
  constructor(private prisma: PrismaService) {}

  async getPolicy(companyId: string) {
    return this.getOrCreatePolicy(companyId);
  }

  async updatePolicy(companyId: string, dto: UpdateAttendancePolicyDto) {
    const policy = await this.getOrCreatePolicy(companyId);
    return this.prisma.attendancePolicy.update({
      where: { id: policy.id },
      data: dto as any,
    });
  }

  async getOrCreatePolicy(companyId: string) {
    let policy = await this.prisma.attendancePolicy.findUnique({
      where: { companyId },
    });
    if (!policy) {
      policy = await this.prisma.attendancePolicy.create({
        data: { companyId },
      });
    }
    return policy;
  }
}
