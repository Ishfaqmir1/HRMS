import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisCacheService } from '../redis/redis-cache.service';
import { AttendanceService } from '../attendance/attendance.service';
import { LeaveService } from '../leave/leave.service';
import { HolidaysService } from '../holidays/holidays.service';
import { AttendanceRegularizationService } from '../attendance-regularization/attendance-regularization.service';
import { DocumentTemplatesService } from '../document-templates/document-templates.service';
import { UpdateMyProfileDto } from './dto/update-profile.dto';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { CreateRegularizationDto } from '../attendance-regularization/dto/attendance-regularization.dto';
import { PaginationQueryDto, PaginatedResult } from '../common/dto/pagination-query.dto';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';

@Injectable()
export class EssService {
  constructor(
    private prisma: PrismaService,
    private cache: RedisCacheService,
    private attendanceService: AttendanceService,
    private leaveService: LeaveService,
    private holidaysService: HolidaysService,
    private regularizationService: AttendanceRegularizationService,
    private documentTemplatesService: DocumentTemplatesService,
  ) {}

  // ---- Profile (with caching) ----

  async getProfile(user: AuthenticatedUser) {
    if (!user.employeeId) {
      if (user.roles.includes('super-admin')) {
        return {
          id: user.userId,
          firstName: 'Super',
          lastName: 'Admin',
          workEmail: user.email,
          department: null,
          branch: null,
          designation: null,
          shift: null,
          reportingManager: null,
          team: null,
        };
      }

      throw new ForbiddenException('This account is not linked to an employee profile.');
    }

    const employeeId = user.employeeId;
    const cacheKey = RedisCacheService.key('profile', user.companyId ?? 'system', employeeId);

    return this.cache.getOrSet(cacheKey, 300, async () => {
      // Use `select` instead of `include` to only fetch needed columns — reduces DB payload
      const employee = await this.prisma.employee.findUnique({
        where: { id: employeeId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          workEmail: true,
          employeeCode: true,
          department: { select: { id: true, name: true } },
          branch: { select: { id: true, name: true, city: true } },
          designation: { select: { id: true, title: true } },
          shift: { select: { id: true, name: true, startTime: true, endTime: true } },
          reportingManager: { select: { id: true, firstName: true, lastName: true, workEmail: true } },
          team: { select: { id: true, name: true } },
        },
      });
      if (!employee) throw new NotFoundException('Employee profile not found.');
      return employee;
    });
  }

  async updateProfile(employeeId: string, dto: UpdateMyProfileDto) {
    // Invalidate cached profile and dashboard for this employee.
    // Cache keys are built as "profile:{companyId}:{employeeId}" and "dashboard:{companyId}:{employeeId}".
    this.cache.delPattern(`profile:*:${employeeId}`).catch(() => {});
    this.cache.delPattern(`dashboard:*:${employeeId}`).catch(() => {});
    return this.prisma.employee.update({ where: { id: employeeId }, data: dto });
  }

  // ---- Dashboard (with caching) ----

  async getDashboard(companyId: string, user: AuthenticatedUser) {
    if (!user.employeeId) {
      if (user.roles.includes('super-admin')) {
        return {
          profile: {
            id: user.userId,
            name: 'Super Admin',
            designation: 'Platform Administrator',
            department: null,
            shift: null,
          },
          attendanceToday: null,
          leaveBalances: [],
          pendingLeaveRequests: 0,
          upcomingHolidays: [],
        };
      }

      throw new ForbiddenException('This account is not linked to an employee profile.');
    }

    const employeeId = user.employeeId;
    const cacheKey = RedisCacheService.key('dashboard', companyId, employeeId);

    return this.cache.getOrSet(cacheKey, 120, async () => {
      const [profile, todayAttendance, leaveBalances, upcomingHolidays, pendingLeaveRequests] = await Promise.all([
        this.getProfile(user),
        this.attendanceService.myToday(employeeId),
        this.leaveService.myBalances(employeeId),
        this.holidaysService.findAll(companyId, new Date().getFullYear()),
        this.prisma.leaveRequest.count({ where: { employeeId, status: 'PENDING' } }),
      ]);

    // Filter holidays at DB level instead of in-memory
    const now = new Date();
    const upcomingFiltered = upcomingHolidays.filter((h) => h.date >= now).slice(0, 5);

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
      upcomingHolidays: upcomingFiltered,
    };
    });
  }

  // ---- Payslips ----

  async myPayslips(employeeId: string, query: PaginationQueryDto) {
    const where = { employeeId };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.payslip.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
        include: { run: { select: { month: true, year: true } } },
      }),
      this.prisma.payslip.count({ where }),
    ]);
    return {
      items,
      meta: { total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) },
    };
  }

  async getPayslip(employeeId: string, id: string) {
    const payslip = await this.prisma.payslip.findFirst({
      where: { id, employeeId },
      include: {
        run: { select: { month: true, year: true } },
        employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true, designation: { select: { title: true } } } },
      },
    });
    if (!payslip) throw new NotFoundException('Payslip not found.');
    return payslip;
  }

  // ---- Leave ----

  async myLeaveHistory(employeeId: string, query: PaginationQueryDto) {
    const where = { employeeId };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.leaveRequest.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
        include: { leaveType: true },
      }),
      this.prisma.leaveRequest.count({ where }),
    ]);
    return {
      items,
      meta: { total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) },
    };
  }

  async myLeaveBalances(employeeId: string) {
    return this.leaveService.myBalances(employeeId);
  }

  // ---- Attendance Calendar ----

  async myAttendanceCalendar(employeeId: string, year?: number, month?: number) {
    const y = year || new Date().getFullYear();
    const m = month || new Date().getMonth() + 1;

    const startDate = new Date(y, m - 1, 1);
    const endDate = new Date(y, m, 0, 23, 59, 59);

    const records = await this.prisma.attendanceRecord.findMany({
      where: {
        employeeId,
        date: { gte: startDate, lte: endDate },
      },
      orderBy: { date: 'asc' },
      include: {
        photos: {
          select: {
            id: true,
            photoType: true,
            imageUrl: true,
            faceMatchScore: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        breaks: {
          select: {
            id: true,
            type: true,
            startTime: true,
            endTime: true,
            durationMinutes: true,
          },
          orderBy: { startTime: 'asc' },
        },
      },
    });

    // Also get holidays for this month
    const holidays = await this.prisma.holiday.findMany({
      where: {
        date: { gte: startDate, lte: endDate },
      },
      select: { date: true, name: true },
    });

    const holidayDates = new Set(holidays.map((h) => h.date.toISOString().split('T')[0]));

    return {
      year: y,
      month: m,
      records: records.map((r) => ({
        ...r,
        isHoliday: holidayDates.has(r.date.toISOString().split('T')[0]),
      })),
      holidays,
    };
  }

  // ---- Expenses (Reimbursements) ----

  async myExpenses(employeeId: string, query: PaginationQueryDto) {
    const where = { employeeId };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.reimbursement.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
        include: { category: true },
      }),
      this.prisma.reimbursement.count({ where }),
    ]);
    return {
      items,
      meta: { total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) },
    };
  }

  async createExpense(companyId: string, employeeId: string, dto: CreateExpenseDto) {
    const category = await this.prisma.reimbursementCategory.findFirst({
      where: { id: dto.categoryId, companyId },
    });
    if (!category) throw new NotFoundException('Category not found.');

    return this.prisma.reimbursement.create({
      data: {
        companyId,
        employeeId,
        categoryId: dto.categoryId,
        amount: dto.amount,
        description: dto.description,
      },
    });
  }

  // ---- Loans ----

  async myLoans(employeeId: string, query: PaginationQueryDto) {
    const where = { employeeId };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.loan.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
        include: { repayments: { orderBy: { dueDate: 'asc' } } },
      }),
      this.prisma.loan.count({ where }),
    ]);
    return {
      items,
      meta: { total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) },
    };
  }

  // ---- Payslip PDF Download ----

  /**
   * Generate a PDF of a payslip for the given employee.
   *
   * Checks for a company-specific payslip template (DocumentTemplate with
   * category PAYSLIP) first. If one exists, it renders the payslip data
   * through that Handlebars template. Otherwise, falls back to the built-in
   * default template.
   */
  async downloadPayslipPdf(companyId: string, employeeId: string, payslipId: string): Promise<{ buffer: Buffer; filename: string; contentType: string }> {
    const payslip = await this.prisma.payslip.findFirst({
      where: { id: payslipId, employeeId },
      include: {
        run: { select: { month: true, year: true } },
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
            workEmail: true,
            dateOfJoining: true,
            designation: { select: { title: true } },
            department: { select: { name: true } },
            branch: { select: { name: true } },
          },
        },
      },
    });
    if (!payslip) throw new NotFoundException('Payslip not found.');

    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const period = payslip.run
      ? `${monthNames[payslip.run.month - 1]} ${payslip.run.year}`
      : '—';
    const emp = payslip.employee;

    // Fetch company + branding data for templates
    const [company, branding] = await Promise.all([
      this.prisma.company.findUnique({
        where: { id: companyId },
        select: { name: true },
      }),
      this.prisma.companyBranding.findUnique({
        where: { companyId },
      }),
    ]);

    // Resolve branding values (use custom branding if enabled, otherwise defaults)
    const brandingEnabled = branding?.enabled ?? false;
    const primaryColor = brandingEnabled && branding?.primaryColor ? branding.primaryColor : '#2563eb';
    const secondaryColor = brandingEnabled && branding?.secondaryColor ? branding.secondaryColor : '#1e40af';
    const accentColor = brandingEnabled && branding?.accentColor ? branding.accentColor : '#1d4ed8';
    const companyLogoUrl = brandingEnabled ? branding?.logoUrl ?? null : null;
    const brandedName = brandingEnabled && branding?.companyName ? branding.companyName : null;
    const signatureImageUrl = branding?.signatureEnabled ? branding?.signatureImageUrl ?? null : null;
    const signatureTitle = branding?.signatureEnabled && branding?.signatureTitle ? branding.signatureTitle : null;
    const companyAddress = branding?.companyAddress || company?.name || '';

    // Build the variable context for Handlebars rendering
    const variables: Record<string, any> = {
      // Company branding
      companyName: brandedName || company?.name || '',
      companyAddress,
      companyLogoUrl,
      primaryColor,
      secondaryColor,
      accentColor,
      brandingEnabled,
      signatureImageUrl,
      signatureTitle,

      // Employee info
      employeeName: emp ? `${emp.firstName} ${emp.lastName}` : '—',
      employeeCode: emp?.employeeCode ?? '—',
      department: emp?.department?.name ?? '—',
      designation: emp?.designation?.title ?? '—',
      branch: emp?.branch?.name ?? '—',
      period,
      status: payslip.status,

      // Earnings
      basic: payslip.basic,
      housingAllowance: payslip.housingAllowance,
      transportAllowance: payslip.transportAllowance,
      medicalAllowance: payslip.medicalAllowance,
      otherAllowances: payslip.otherAllowances,
      overtimePay: payslip.overtimePay,
      bonus: payslip.bonus,
      grossPay: payslip.grossPay,

      // Deductions
      taxDeduction: payslip.taxDeduction,
      pensionDeduction: payslip.pensionDeduction,
      insuranceDeduction: payslip.insuranceDeduction,
      loanDeduction: payslip.loanDeduction,
      otherDeductions: payslip.otherDeductions,
      totalDeductions: payslip.totalDeductions,
      netPay: payslip.netPay,

      // Meta
      generatedDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    };

    // Look for a company-specific payslip template
    const customTemplate = await this.prisma.documentTemplate.findFirst({
      where: { companyId, category: 'PAYSLIP', isActive: true },
    });

    let html: string;
    if (customTemplate?.content) {
      // Render the custom template with Handlebars variables
      html = this.documentTemplatesService.renderTemplateWithVariables(customTemplate.content, variables);
    } else {
      // Fall back to the built-in default template
      const defaults = this.documentTemplatesService.getDefaultTemplates();
      const defaultTemplate = defaults.find((t) => t.category === 'PAYSLIP');
      html = defaultTemplate
        ? this.documentTemplatesService.renderTemplateWithVariables(defaultTemplate.content, variables)
        : this.buildFallbackPayslipHtml(payslip, period, emp);
    }

    const buffer = await this.documentTemplatesService.generatePdf(html);
    const filename = `payslip-${period.replace(/\s+/g, '-').toLowerCase()}.pdf`;

    return { buffer, filename, contentType: 'application/pdf' };
  }

  /**
   * Ultimate fallback — a minimal inline HTML payslip when no template exists
   * at all (should never happen since we seed defaults, but safe guard).
   */
  private buildFallbackPayslipHtml(payslip: any, period: string, emp: any): string {
    const fmt = (v: number) =>
      new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(v);
    return `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:20px;">
<h1 style="color:#2563eb;">Payslip</h1>
<p>Period: <strong>${period}</strong></p>
<p>Employee: ${emp?.firstName ?? ''} ${emp?.lastName ?? ''} (${emp?.employeeCode ?? '—'})</p>
<hr>
<h3>Earnings</h3>
<table width="100%" cellpadding="4">
<tr><td>Basic</td><td align="right">${fmt(payslip.basic)}</td></tr>
<tr><td>Housing</td><td align="right">${fmt(payslip.housingAllowance)}</td></tr>
<tr><td>Transport</td><td align="right">${fmt(payslip.transportAllowance)}</td></tr>
<tr><td>Medical</td><td align="right">${fmt(payslip.medicalAllowance)}</td></tr>
<tr><td>Other</td><td align="right">${fmt(payslip.otherAllowances)}</td></tr>
<tr style="font-weight:bold;border-top:2px solid #2563eb;"><td>Gross</td><td align="right">${fmt(payslip.grossPay)}</td></tr>
</table>
<h3>Deductions</h3>
<table width="100%" cellpadding="4">
<tr><td>Tax</td><td align="right">${fmt(payslip.taxDeduction)}</td></tr>
<tr><td>Pension</td><td align="right">${fmt(payslip.pensionDeduction)}</td></tr>
<tr><td>Insurance</td><td align="right">${fmt(payslip.insuranceDeduction)}</td></tr>
<tr style="font-weight:bold;border-top:2px solid #2563eb;"><td>Total Deductions</td><td align="right">${fmt(payslip.totalDeductions)}</td></tr>
</table>
<div style="margin-top:16px;padding:12px;background:#2563eb;color:white;font-size:18px;font-weight:bold;display:flex;justify-content:space-between;">
<span>Net Pay</span><span>${fmt(payslip.netPay)}</span>
</div>
</body></html>`;
  }

  // ---- Bulk Payslip ZIP Download ----

  async downloadAllPayslipsPdf(
    companyId: string,
    employeeId: string,
  ): Promise<{ buffer: Buffer; filename: string; contentType: string }> {
    const payslips = await this.prisma.payslip.findMany({
      where: { employeeId },
      orderBy: { createdAt: 'desc' },
      include: { run: { select: { month: true, year: true } } },
    });

    if (payslips.length === 0) {
      throw new NotFoundException('No payslips found.');
    }

    const archiver = await import('archiver');
    const archive = archiver.default('zip', { zlib: { level: 6 } });
    const chunks: Buffer[] = [];

    archive.on('data', (chunk: Buffer) => chunks.push(chunk));

    const zipPromise = new Promise<void>((resolve, reject) => {
      archive.on('end', () => resolve());
      archive.on('error', (err: Error) => reject(err));
    });

    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    // Generate each payslip PDF and append to archive
    for (const payslip of payslips) {
      try {
        const result = await this.downloadPayslipPdf(companyId, employeeId, payslip.id);
        const mn = payslip.run?.month ?? 1;
        const yr = payslip.run?.year ?? new Date().getFullYear();
        const period = `${monthNames[mn - 1]}-${yr}`;
        archive.append(result.buffer, { name: `payslip-${period.toLowerCase()}.pdf` });
      } catch {
        // Skip payslips that fail to generate
        continue;
      }
    }

    await archive.finalize();
    await zipPromise;

    const zipBuffer = Buffer.concat(chunks);
    return {
      buffer: zipBuffer,
      filename: `all-payslips.zip`,
      contentType: 'application/zip',
    };
  }

  // ---- Generated Documents (from Document Builder) ----

  async myGeneratedDocuments(companyId: string, employeeId: string, query: PaginationQueryDto) {
    return this.documentTemplatesService.findGenerated(companyId, {
      page: query.page,
      limit: query.limit,
      search: query.search,
      employeeId,
    } as any);
  }

  // ---- Documents (uploaded) ----

  async myDocuments(employeeId: string, query: PaginationQueryDto) {
    const where = { employeeId };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.employeeDocument.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: { uploadedAt: 'desc' },
      }),
      this.prisma.employeeDocument.count({ where }),
    ]);
    return {
      items,
      meta: { total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) },
    };
  }

  // ---- Tax Declarations ----

  async myTaxDeclarations(employeeId: string) {
    return this.prisma.taxDeclaration.findMany({
      where: { employeeId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ---- Attendance Regularization ----

  async myRegularizations(employeeId: string, query: PaginationQueryDto) {
    return this.regularizationService.myRequests(employeeId, query);
  }

  async createRegularization(companyId: string, employeeId: string, dto: CreateRegularizationDto) {
    return this.regularizationService.create(companyId, employeeId, dto);
  }

  // ---- Assets ----

  async myAssets(employeeId: string, query: PaginationQueryDto) {
    const where = { employeeId };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.assetAssignment.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        include: { asset: true },
        orderBy: { assignedAt: 'desc' },
      }),
      this.prisma.assetAssignment.count({ where }),
    ]);
    return {
      items,
      meta: { total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) },
    };
  }

  // ---- Training ----

  async myTraining(employeeId: string, query: PaginationQueryDto) {
    const where = { employeeId };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.trainingEnrollment.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        include: { training: true },
        orderBy: { enrolledAt: 'desc' },
      }),
      this.prisma.trainingEnrollment.count({ where }),
    ]);
    return {
      items,
      meta: { total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) },
    };
  }
}
