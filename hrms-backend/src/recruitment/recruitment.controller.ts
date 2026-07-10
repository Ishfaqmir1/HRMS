import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RecruitmentService } from './recruitment.service';
import {
  CreateJobPostingDto, UpdateJobPostingDto, UpdateJobStatusDto,
  CreateApplicationDto, UpdateApplicationStatusDto, UpdateApplicationRatingDto,
  CreateInterviewDto, UpdateInterviewDto,
} from './dto/recruitment.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { TenantId } from '../common/decorators/tenant.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';

@ApiTags('Recruitment')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller('recruitment')
export class RecruitmentController {
  constructor(private readonly recruitmentService: RecruitmentService) {}

  // ======================================================================
  // Dashboard
  // ======================================================================
  @Get('dashboard')
  @Permissions('recruitment.read')
  getDashboard(@CurrentUser() user: AuthenticatedUser) {
    // Use user.companyId instead of @TenantId() so super admin
    // (who has companyId: null) can still access dashboard.
    return this.recruitmentService.getDashboard(user.companyId ?? '');
  }

  // ======================================================================
  // Job Postings
  // ======================================================================
  @Post('jobs')
  @Permissions('recruitment.create')
  createJobPosting(@TenantId() companyId: string, @Body() dto: CreateJobPostingDto) {
    return this.recruitmentService.createJobPosting(companyId, dto);
  }

  @Get('jobs')
  @Permissions('recruitment.read')
  findAllJobPostings(@TenantId() companyId: string, @Query() query: PaginationQueryDto & { status?: string; departmentId?: string }) {
    return this.recruitmentService.findAllJobPostings(companyId, query);
  }

  @Get('jobs/:id')
  @Permissions('recruitment.read')
  findOneJobPosting(@TenantId() companyId: string, @Param('id') id: string) {
    return this.recruitmentService.findOneJobPosting(companyId, id);
  }

  @Patch('jobs/:id')
  @Permissions('recruitment.update')
  updateJobPosting(@TenantId() companyId: string, @Param('id') id: string, @Body() dto: UpdateJobPostingDto) {
    return this.recruitmentService.updateJobPosting(companyId, id, dto);
  }

  @Patch('jobs/:id/status')
  @Permissions('recruitment.update')
  updateJobStatus(@TenantId() companyId: string, @Param('id') id: string, @Body() dto: UpdateJobStatusDto) {
    return this.recruitmentService.updateJobStatus(companyId, id, dto);
  }

  @Delete('jobs/:id')
  @Permissions('recruitment.delete')
  removeJobPosting(@TenantId() companyId: string, @Param('id') id: string) {
    return this.recruitmentService.removeJobPosting(companyId, id);
  }

  // ======================================================================
  // Applications
  // ======================================================================
  @Post('applications')
  @Permissions('recruitment.create')
  createApplication(@TenantId() companyId: string, @Body() dto: CreateApplicationDto) {
    return this.recruitmentService.createApplication(companyId, dto);
  }

  @Get('applications')
  @Permissions('recruitment.read')
  findAllApplications(@TenantId() companyId: string, @Query() query: PaginationQueryDto & { jobPostingId?: string; status?: string }) {
    return this.recruitmentService.findAllApplications(companyId, query);
  }

  @Get('applications/:id')
  @Permissions('recruitment.read')
  findOneApplication(@TenantId() companyId: string, @Param('id') id: string) {
    return this.recruitmentService.findOneApplication(companyId, id);
  }

  @Patch('applications/:id/status')
  @Permissions('recruitment.update')
  updateApplicationStatus(@TenantId() companyId: string, @Param('id') id: string, @Body() dto: UpdateApplicationStatusDto) {
    return this.recruitmentService.updateApplicationStatus(companyId, id, dto);
  }

  @Patch('applications/:id/rating')
  @Permissions('recruitment.update')
  updateApplicationRating(@TenantId() companyId: string, @Param('id') id: string, @Body() dto: UpdateApplicationRatingDto) {
    return this.recruitmentService.updateApplicationRating(companyId, id, dto);
  }

  // ======================================================================
  // Interviews
  // ======================================================================
  @Post('interviews')
  @Permissions('recruitment.create')
  createInterview(@TenantId() companyId: string, @Body() dto: CreateInterviewDto) {
    return this.recruitmentService.createInterview(companyId, dto);
  }

  @Get('interviews')
  @Permissions('recruitment.read')
  findAllInterviews(@TenantId() companyId: string, @Query() query: PaginationQueryDto) {
    return this.recruitmentService.findAllInterviews(companyId, query);
  }

  @Get('interviews/upcoming')
  @Permissions('recruitment.read')
  findUpcomingInterviews(@TenantId() companyId: string) {
    return this.recruitmentService.findUpcomingInterviews(companyId);
  }

  @Get('interviews/by-application/:applicationId')
  @Permissions('recruitment.read')
  findInterviewsByApplication(@TenantId() companyId: string, @Param('applicationId') applicationId: string) {
    return this.recruitmentService.findInterviewsByApplication(companyId, applicationId);
  }

  @Patch('interviews/:id')
  @Permissions('recruitment.update')
  updateInterview(@TenantId() companyId: string, @Param('id') id: string, @Body() dto: UpdateInterviewDto) {
    return this.recruitmentService.updateInterview(companyId, id, dto);
  }
}
