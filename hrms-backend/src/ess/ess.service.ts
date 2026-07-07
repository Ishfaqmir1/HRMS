import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AttendanceService } from '../attendance/attendance.service';
import { LeaveService } from '../leave/leave.service';
import { HolidaysService } from '../holidays/holidays.service';
import { UpdateMyProfileDto } from './dto/update-profile.dto';

@Injectable()
export class EssService {
  constructor(
    private prisma: PrismaService,
    private attendanceService: AttendanceService,
    private leaveService: LeaveService,
    private holidaysService: HolidaysService,
  ) {}

  async getProfile(employeeId: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        department: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
        designation: { select: { id: true, title: true } },
        shift: true,
        reportingManager: { select: { id: true, firstName: true, lastName: true, workEmail: true } },
      },
    });
    if (!employee) throw new NotFoundException('Employee profile not found.');
    return employee;
  }

  async updateProfile(employeeId: string, dto: UpdateMyProfileDto) {
    return this.prisma.employee.update({ where: { id: employeeId }, data: dto });
  }

  async getDashboard(companyId: string, employeeId: string) {
    const [profile, todayAttendance, leaveBalances, upcomingHolidays, pendingLeaveRequests] = await Promise.all([
      this.getProfile(employeeId),
      this.attendanceService.myToday(employeeId),
      this.leaveService.myBalances(employeeId),
      this.holidaysService.findAll(companyId, new Date().getFullYear()),
      this.prisma.leaveRequest.count({ where: { employeeId, status: 'PENDING' } }),
    ]);

    const nextHolidays = upcomingHolidays.filter((h) => h.date >= new Date()).slice(0, 5);

    return {
      profile: {
        id: profile.id,
        name: `${profile.firstName} ${profile.lastName}`,
        designation: profile.designation?.title ?? null,
        department: profile.department?.name ?? null,
        shift: profile.shift ? { name: profile.shift.name, startTime: profile.shift.startTime, endTime: profile.shift.endTime } : null,
      },
      attendanceToday: todayAttendance,
      leaveBalances,
      pendingLeaveRequests,
      upcomingHolidays: nextHolidays,
    };
  }
}
