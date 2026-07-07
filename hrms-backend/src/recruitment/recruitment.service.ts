import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateJobPostingDto, UpdateJobPostingDto, UpdateJobStatusDto,
  CreateApplicationDto, UpdateApplicationStatusDto, UpdateApplicationRatingDto,
  CreateInterviewDto, UpdateInterviewDto,
} from './dto/recruitment.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

@Injectable()
export class RecruitmentService {
  constructor(private prisma: PrismaService) {}

  // ========================================================================
  // Dashboard
  // ========================================================================
  async getDashboard(companyId: string) {
    const [activeJobs, totalApplications, pendingInterviews, recentApplications] = await Promise.all([
      this.prisma.jobPosting.count({ where: { companyId, status: 'PUBLISHED' } }),
      this.prisma.jobApplication.count({ where: { companyId } }),
      this.prisma.interview.count({
        where: { companyId, status: { in: ['SCHEDULED', 'CONFIRMED'] }, scheduledAt: { gte: new Date() } },
      }),
      this.prisma.jobApplication.findMany({
        where: { companyId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { jobPosting: { select: { title: true } } },
      }),
    ]);

    const stageCounts = await this.prisma.jobApplication.groupBy({
      by: ['status'],
      where: { companyId },
      _count: true,
    });

    return { activeJobs, totalApplications, pendingInterviews, recentApplications, stageCounts };
  }

  // ========================================================================
  // Job Postings
  // ========================================================================
  async createJobPosting(companyId: string, dto: CreateJobPostingDto) {
    return this.prisma.jobPosting.create({
      data: {
        ...dto,
        companyId,
        publishedAt: dto.status === 'PUBLISHED' ? new Date() : undefined,
      },
      include: { department: { select: { id: true, name: true } }, _count: { select: { applications: true } } },
    });
  }

  async findAllJobPostings(companyId: string, query: PaginationQueryDto & { status?: string; departmentId?: string }) {
    const where: any = { companyId, ...(query.status && { status: query.status }), ...(query.departmentId && { departmentId: query.departmentId }) };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.jobPosting.findMany({
        where, skip: query.skip, take: query.limit, orderBy: { createdAt: 'desc' },
        include: { department: { select: { id: true, name: true } }, _count: { select: { applications: true } } },
      }),
      this.prisma.jobPosting.count({ where }),
    ]);
    return { items, meta: { total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) } };
  }

  async findOneJobPosting(companyId: string, id: string) {
    const j = await this.prisma.jobPosting.findFirst({
      where: { id, companyId },
      include: { department: true, _count: { select: { applications: true } } },
    });
    if (!j) throw new NotFoundException('Job posting not found.');
    return j;
  }

  async updateJobPosting(companyId: string, id: string, dto: UpdateJobPostingDto) {
    await this.findOneJobPosting(companyId, id);
    return this.prisma.jobPosting.update({
      where: { id },
      data: { ...dto, publishedAt: dto.status === 'PUBLISHED' ? new Date() : undefined },
    });
  }

  async updateJobStatus(companyId: string, id: string, dto: UpdateJobStatusDto) {
    await this.findOneJobPosting(companyId, id);
    return this.prisma.jobPosting.update({
      where: { id },
      data: {
        status: dto.status,
        publishedAt: dto.status === 'PUBLISHED' ? new Date() : undefined,
        closedAt: dto.status === 'CLOSED' ? new Date() : undefined,
      },
    });
  }

  async removeJobPosting(companyId: string, id: string) {
    await this.findOneJobPosting(companyId, id);
    return this.prisma.jobPosting.update({ where: { id }, data: { status: 'CLOSED' } });
  }

  // ========================================================================
  // Applications
  // ========================================================================
  async createApplication(companyId: string, dto: CreateApplicationDto) {
    const job = await this.prisma.jobPosting.findFirst({ where: { id: dto.jobPostingId, companyId } });
    if (!job) throw new NotFoundException('Job posting not found.');
    return this.prisma.jobApplication.create({ data: { ...dto, companyId } });
  }

  async findAllApplications(companyId: string, query: PaginationQueryDto & { jobPostingId?: string; status?: string }) {
    const where: any = { companyId, ...(query.jobPostingId && { jobPostingId: query.jobPostingId }), ...(query.status && { status: query.status }) };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.jobApplication.findMany({
        where, skip: query.skip, take: query.limit, orderBy: { createdAt: 'desc' },
        include: {
          jobPosting: { select: { id: true, title: true } },
          interviews: { select: { id: true, title: true, scheduledAt: true, status: true } },
        },
      }),
      this.prisma.jobApplication.count({ where }),
    ]);
    return { items, meta: { total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) } };
  }

  async findOneApplication(companyId: string, id: string) {
    const a = await this.prisma.jobApplication.findFirst({
      where: { id, companyId },
      include: {
        jobPosting: { select: { id: true, title: true } },
        interviews: { include: { company: { select: { employees: { select: { id: true, firstName: true, lastName: true } } } } } },
      },
    });
    if (!a) throw new NotFoundException('Application not found.');
    return a;
  }

  async updateApplicationStatus(companyId: string, id: string, dto: UpdateApplicationStatusDto) {
    const app = await this.findOneApplication(companyId, id);
    return this.prisma.jobApplication.update({
      where: { id },
      data: { status: dto.status, notes: dto.notes ?? app.notes },
    });
  }

  async updateApplicationRating(companyId: string, id: string, dto: UpdateApplicationRatingDto) {
    await this.findOneApplication(companyId, id);
    return this.prisma.jobApplication.update({ where: { id }, data: { rating: dto.rating } });
  }

  // ========================================================================
  // Interviews
  // ========================================================================
  async createInterview(companyId: string, dto: CreateInterviewDto) {
    const app = await this.prisma.jobApplication.findFirst({ where: { id: dto.applicationId, companyId } });
    if (!app) throw new NotFoundException('Application not found.');
    return this.prisma.interview.create({
      data: { ...dto, companyId, scheduledAt: new Date(dto.scheduledAt), interviewerIds: dto.interviewerIds || [] },
    });
  }

  async findInterviewsByApplication(companyId: string, applicationId: string) {
    return this.prisma.interview.findMany({ where: { companyId, applicationId }, orderBy: { scheduledAt: 'asc' } });
  }

  async findAllInterviews(companyId: string, query: PaginationQueryDto) {
    const where = { companyId };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.interview.findMany({
        where, skip: query.skip, take: query.limit, orderBy: { scheduledAt: 'desc' },
        include: { application: { select: { id: true, candidateName: true, candidateEmail: true, jobPosting: { select: { title: true } } } } },
      }),
      this.prisma.interview.count({ where }),
    ]);
    return { items, meta: { total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) } };
  }

  async findUpcomingInterviews(companyId: string) {
    return this.prisma.interview.findMany({
      where: { companyId, scheduledAt: { gte: new Date() }, status: { in: ['SCHEDULED', 'CONFIRMED'] } },
      orderBy: { scheduledAt: 'asc' },
      take: 20,
      include: { application: { select: { id: true, candidateName: true, candidateEmail: true, jobPosting: { select: { title: true } } } } },
    });
  }

  async updateInterview(companyId: string, id: string, dto: UpdateInterviewDto) {
    const i = await this.prisma.interview.findFirst({ where: { id, companyId } });
    if (!i) throw new NotFoundException('Interview not found.');
    return this.prisma.interview.update({
      where: { id },
      data: {
        ...dto,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
      },
    });
  }
}
