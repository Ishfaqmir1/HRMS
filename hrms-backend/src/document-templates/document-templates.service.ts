import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as Handlebars from 'handlebars';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/services/audit.service';
import {
  CreateDocumentTemplateDto,
  UpdateDocumentTemplateDto,
  GenerateDocumentDto,
  DocumentTemplateCategory,
} from './dto/document-templates.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class DocumentTemplatesService {
  private readonly logger = new Logger(DocumentTemplatesService.name);
  private readonly uploadDir: string;
  private puppeteerModule: any = null;
  private browserPromise: Promise<any> | null = null;

  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private configService: ConfigService,
  ) {
    const storagePath =
      this.configService.get<string>('storage.documentTemplatesPath') ||
      path.join(process.cwd(), 'storage', 'documents');
    this.uploadDir = storagePath;
    this.ensureDir(this.uploadDir);
    this.ensureDir(path.join(this.uploadDir, 'templates'));
    this.ensureDir(path.join(this.uploadDir, 'generated'));

    // Register Handlebars helpers
    Handlebars.registerHelper('formatDate', function (date: string | Date, format?: string) {
      if (!date) return '';
      const d = new Date(date);
      if (format === 'long') return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      if (format === 'short') return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    });

    Handlebars.registerHelper('currency', function (amount: number) {
      if (amount == null) return '';
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
    });

    Handlebars.registerHelper('uppercase', function (str: string) {
      return str ? String(str).toUpperCase() : '';
    });

    Handlebars.registerHelper('ifEquals', function (arg1, arg2, options) {
      return arg1 === arg2 ? options.fn(this) : options.inverse(this);
    });

    Handlebars.registerHelper('now', function (format?: string) {
      const d = new Date();
      if (format === 'year') return d.getFullYear().toString();
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    });
  }

  private async ensureDir(dir: string) {
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch {
      // already exists
    }
  }

  private async getPuppeteer() {
    if (!this.puppeteerModule) {
      this.puppeteerModule = await import('puppeteer');
    }
    return this.puppeteerModule;
  }

  private async getBrowser() {
    if (!this.browserPromise) {
      const puppeteer = await this.getPuppeteer();
      this.browserPromise = puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      }).catch((err: Error) => {
        this.browserPromise = null;
        throw err;
      });
    }
    return this.browserPromise;
  }

  // ====================================================================
  // Default Template Content (built-in templates)
  // ====================================================================

  getDefaultTemplates(): Array<{
    name: string;
    slug: string;
    category: DocumentTemplateCategory;
    content: string;
    description: string;
    variables: string[];
  }> {
    return [
      {
        name: 'Offer Letter',
        slug: 'offer-letter',
        category: DocumentTemplateCategory.OFFER_LETTER,
        description: 'Standard employment offer letter sent to selected candidates.',
        variables: ['candidateName', 'position', 'department', 'joiningDate', 'salary', 'location', 'companyName', 'hrName'],
        content: this.offerLetterTemplate(),
      },
      {
        name: 'Appointment Letter',
        slug: 'appointment-letter',
        category: DocumentTemplateCategory.APPOINTMENT_LETTER,
        description: 'Confirms appointment with terms and conditions of employment.',
        variables: ['employeeName', 'position', 'department', 'joiningDate', 'employmentType', 'probationPeriod', 'reportingManager', 'companyName', 'hrName'],
        content: this.appointmentLetterTemplate(),
      },
      {
        name: 'Experience Letter',
        slug: 'experience-letter',
        category: DocumentTemplateCategory.EXPERIENCE_LETTER,
        description: 'Certificate of experience provided upon employee exit.',
        variables: ['employeeName', 'position', 'department', 'startDate', 'endDate', 'tenure', 'lastDesignation', 'companyName', 'hrName'],
        content: this.experienceLetterTemplate(),
      },
      {
        name: 'Relieving Letter',
        slug: 'relieving-letter',
        category: DocumentTemplateCategory.RELIEVING_LETTER,
        description: 'Official release letter upon resignation or termination.',
        variables: ['employeeName', 'position', 'department', 'lastWorkingDay', 'resignationDate', 'companyName', 'hrName'],
        content: this.relievingLetterTemplate(),
      },
      {
        name: 'Salary Certificate',
        slug: 'salary-certificate',
        category: DocumentTemplateCategory.SALARY_CERTIFICATE,
        description: 'Proof of income showing current salary breakdown.',
        variables: ['employeeName', 'position', 'department', 'basicSalary', 'totalCTC', 'effectiveDate', 'companyName', 'hrName'],
        content: this.salaryCertificateTemplate(),
      },
      {
        name: 'Payslip',
        slug: 'payslip',
        category: DocumentTemplateCategory.PAYSLIP,
        description: 'Monthly payslip template showing earnings, deductions, and net pay.',
        variables: [
          'employeeName', 'employeeCode', 'department', 'designation', 'branch',
          'period', 'status',
          'basic', 'housingAllowance', 'transportAllowance', 'medicalAllowance', 'otherAllowances',
          'overtimePay', 'bonus', 'grossPay',
          'taxDeduction', 'pensionDeduction', 'insuranceDeduction', 'loanDeduction', 'otherDeductions',
          'totalDeductions', 'netPay',
          'generatedDate', 'companyName',
          'primaryColor', 'secondaryColor', 'accentColor', 'companyLogoUrl', 'brandingEnabled',
        ],
        content: this.payslipTemplate(),
      },
    ];
  }

  // ====================================================================
  // CRUD
  // ====================================================================

  async create(companyId: string, dto: CreateDocumentTemplateDto, userId: string) {
    const slug = dto.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    const existing = await this.prisma.documentTemplate.findFirst({
      where: { companyId, slug },
    });
    if (existing) throw new ConflictException(`A template with slug "${slug}" already exists.`);

    const template = await this.prisma.documentTemplate.create({
      data: {
        companyId,
        name: dto.name,
        slug,
        category: dto.category,
        content: dto.content,
        description: dto.description,
        variables: dto.variables ? JSON.parse(dto.variables) : undefined,
      },
    });

    await this.auditService.logCreate(
      { userId, companyId } as any,
      'DocumentTemplate',
      template.id,
      { name: template.name, category: template.category },
    );

    return template;
  }

  async findAll(companyId: string, query: PaginationQueryDto & { category?: string }) {
    const where: any = {
      companyId,
      isActive: true,
      ...(query.category && { category: query.category }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.documentTemplate.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.documentTemplate.count({ where }),
    ]);

    return {
      items,
      meta: { total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) },
    };
  }

  async findOne(companyId: string, id: string) {
    const template = await this.prisma.documentTemplate.findFirst({
      where: { id, companyId },
    });
    if (!template) throw new NotFoundException('Document template not found.');
    return template;
  }

  async update(companyId: string, id: string, dto: UpdateDocumentTemplateDto, userId: string) {
    await this.findOne(companyId, id);

    const data: any = { ...dto };
    if (dto.variables) {
      data.variables = JSON.parse(dto.variables);
    }

    const template = await this.prisma.documentTemplate.update({
      where: { id },
      data,
    });

    await this.auditService.logUpdate(
      { userId, companyId } as any,
      'DocumentTemplate',
      id,
      {},
      { name: template.name, category: template.category },
    );

    return template;
  }

  async remove(companyId: string, id: string, userId: string) {
    await this.findOne(companyId, id);
    await this.prisma.documentTemplate.update({
      where: { id },
      data: { isActive: false },
    });

    await this.auditService.logDelete(
      { userId, companyId } as any,
      'DocumentTemplate',
      id,
    );

    return { message: 'Template deleted.' };
  }

  // ====================================================================
  // Seed default templates (used by app bootstrap or seed)
  // ====================================================================

  async seedDefaults(companyId: string) {
    const defaults = this.getDefaultTemplates();
    const results: any[] = [];

    for (const def of defaults) {
      const existing = await this.prisma.documentTemplate.findFirst({
        where: { companyId, slug: def.slug },
      });
      if (!existing) {
        const template = await this.prisma.documentTemplate.create({
          data: {
            companyId,
            name: def.name,
            slug: def.slug,
            category: def.category,
            content: def.content,
            description: def.description,
            variables: def.variables,
            isDefault: true,
          },
        });
        results.push(template);
      }
    }

    return { seeded: results.length, total: defaults.length };
  }

  // ====================================================================
  // Document Generation
  // ====================================================================

  /**
   * Preview a template from either a stored template or raw content.
   */
  async previewContent(
    companyId: string,
    content: string,
    variables?: Record<string, string>,
    employeeId?: string,
  ) {
    let context = this.getSampleContext(variables);

    if (employeeId) {
      const employee = await this.prisma.employee.findFirst({
        where: { id: employeeId, companyId },
        include: {
          department: { select: { name: true } },
          designation: { select: { title: true } },
          employeeSalaries: { where: { isActive: true }, take: 1 },
        },
      });
      if (employee) {
        const salary = employee.employeeSalaries[0];
        const grossSalary = salary
          ? salary.basic + salary.housingAllowance + salary.transportAllowance +
            salary.medicalAllowance + salary.otherAllowances
          : 0;
        context = {
          ...this.getSampleContext(),
          employeeName: `${employee.firstName} ${employee.lastName}`,
          firstName: employee.firstName,
          lastName: employee.lastName,
          employeeCode: employee.employeeCode,
          position: employee.designation?.title || context.position,
          department: employee.department?.name || context.department,
          joiningDate: employee.dateOfJoining?.toISOString() || context.joiningDate,
          salary: grossSalary.toString(),
          basicSalary: salary?.basic?.toString() || context.basicSalary,
          totalCTC: grossSalary.toString(),
          ...(variables || {}),
        };
      }
    }

    const rendered = this.renderTemplate(content, context);
    return { html: rendered, variables: context };
  }

  private getSampleContext(variables?: Record<string, string>): Record<string, any> {
    return {
      employeeName: 'John Doe',
      firstName: 'John',
      lastName: 'Doe',
      employeeCode: 'EMP-0001',
      position: 'Software Engineer',
      department: 'Engineering',
      joiningDate: new Date().toISOString(),
      startDate: new Date().toISOString(),
      endDate: new Date().toISOString(),
      employmentType: 'Full Time',
      salary: '75,000',
      basicSalary: '50,000',
      totalCTC: '75,000',
      companyName: 'Acme Corp',
      companyAddress: '123 Business Park',
      reportingManager: 'Jane Smith',
      hrName: 'HR Department',
      currentDate: new Date().toISOString(),
      today: new Date().toISOString(),
      year: new Date().getFullYear().toString(),
      tenure: '2 years',
      lastDesignation: 'Software Engineer',
      lastWorkingDay: new Date().toISOString(),
      resignationDate: new Date().toISOString(),
      probationPeriod: '6 months',
      effectiveDate: new Date().toISOString(),
      candidateName: 'John Doe',
      location: 'New York',
      ...(variables || {}),
    };
  }

  async generate(
    companyId: string,
    dto: GenerateDocumentDto,
    userId: string,
  ) {
    const template = await this.findOne(companyId, dto.templateId);

    if (!dto.employeeIds || dto.employeeIds.length === 0) {
      throw new BadRequestException('At least one employee must be selected.');
    }

    const employees = await this.prisma.employee.findMany({
      where: {
        id: { in: dto.employeeIds },
        companyId,
        deletedAt: null,
      },
      include: {
        department: { select: { name: true } },
        designation: { select: { title: true } },
        branch: { select: { name: true } },
        employeeSalaries: {
          where: { isActive: true },
          take: 1,
          orderBy: { effectiveFrom: 'desc' },
        },
        reportingManager: {
          select: { firstName: true, lastName: true },
        },
      },
    });

    if (employees.length === 0) {
      throw new BadRequestException('No valid employees found.');
    }

    const format = dto.format || 'pdf';
    const generatedDocs: any[] = [];

    for (const employee of employees) {
      const salary = employee.employeeSalaries[0];
      const grossSalary = salary
        ? salary.basic + salary.housingAllowance + salary.transportAllowance +
          salary.medicalAllowance + salary.otherAllowances
        : 0;

      // Build complete variable context
      const variableContext: Record<string, any> = {
        // Employee info
        employeeName: `${employee.firstName} ${employee.lastName}`,
        firstName: employee.firstName,
        lastName: employee.lastName,
        employeeCode: employee.employeeCode,
        position: employee.designation?.title || 'Employee',
        department: employee.department?.name || '',
        branch: employee.branch?.name || '',
        joiningDate: employee.dateOfJoining?.toISOString() || '',
        startDate: employee.dateOfJoining?.toISOString() || '',
        endDate: employee.dateOfExit?.toISOString() || '',
        employmentType: employee.employmentType?.replace(/_/g, ' ') || 'Full Time',
        status: employee.status || '',

        // Salary info
        salary: grossSalary.toString(),
        basicSalary: salary?.basic?.toString() || '0',
        totalCTC: grossSalary.toString(),

        // Dates
        currentDate: new Date().toISOString(),
        today: new Date().toISOString(),
        year: new Date().getFullYear().toString(),

        // Company info (would be populated from company record)
        companyName: '',
        companyAddress: '',
        companyCity: '',
        companyState: '',

        // Manager
        reportingManager: employee.reportingManager
          ? `${employee.reportingManager.firstName} ${employee.reportingManager.lastName}`
          : '',

        // Other
        hrName: 'HR Department',

        // Custom overrides from request
        ...(dto.variables || {}),
      };

      const rendered = this.renderTemplate(template.content, variableContext);

      // Generate file
      let fileUrl: string;
      let fileType: string;

      try {
        if (format === 'pdf') {
          fileUrl = await this.renderPdf(rendered, employee.id, template.slug);
          fileType = 'pdf';
        } else if (format === 'docx') {
          fileUrl = await this.renderDocx(template.content, variableContext, employee.id, template.slug);
          fileType = 'docx';
        } else {
          fileUrl = await this.saveHtml(rendered, employee.id, template.slug);
          fileType = 'html';
        }
      } catch (err) {
        this.logger.error(`Failed to render document for employee ${employee.id}: ${(err as Error).message}`);
        // Fall back to saving raw HTML
        fileUrl = await this.saveHtml(rendered, employee.id, template.slug);
        fileType = 'html';
      }

      const doc = await this.prisma.generatedDocument.create({
        data: {
          companyId,
          employeeId: employee.id,
          templateId: template.id,
          documentType: template.category as any,
          title: `${template.name} - ${employee.firstName} ${employee.lastName}`,
          fileUrl,
          fileType,
          variables: variableContext,
          metadata: { notes: dto.notes, generatedBy: userId },
          generatedById: userId,
        },
      });

      generatedDocs.push(doc);
    }

    await this.auditService.logCustom(
      { userId, companyId } as any,
      'DOCUMENTS_GENERATED',
      'DocumentTemplate',
      template.id,
      { count: generatedDocs.length, format, templateName: template.name },
    );

    return {
      documents: generatedDocs,
      count: generatedDocs.length,
      templateName: template.name,
    };
  }

  /**
   * Preview a template — renders with sample data or a specific employee.
   */
  async preview(companyId: string, templateId: string, variables?: Record<string, string>, employeeId?: string, rawContent?: string) {
    // If raw content provided, preview without loading from DB
    if (rawContent) {
      return this.previewContent(companyId, rawContent, variables, employeeId);
    }

    const template = await this.findOne(companyId, templateId);
    const context = this.getSampleContext(variables);

    let finalContext = { ...context };

    // If an employee is specified, use real data
    if (employeeId) {
      const employee = await this.prisma.employee.findFirst({
        where: { id: employeeId, companyId },
        include: {
          department: { select: { name: true } },
          designation: { select: { title: true } },
          employeeSalaries: { where: { isActive: true }, take: 1 },
        },
      });
      if (employee) {
        const salary = employee.employeeSalaries[0];
        const grossSalary = salary
          ? salary.basic + salary.housingAllowance + salary.transportAllowance +
            salary.medicalAllowance + salary.otherAllowances
          : 0;

        finalContext = {
          ...context,
          employeeName: `${employee.firstName} ${employee.lastName}`,
          firstName: employee.firstName,
          lastName: employee.lastName,
          employeeCode: employee.employeeCode,
          position: employee.designation?.title || context.position,
          department: employee.department?.name || context.department,
          joiningDate: employee.dateOfJoining?.toISOString() || context.joiningDate,
          salary: grossSalary.toString(),
          basicSalary: salary?.basic?.toString() || context.basicSalary,
          totalCTC: grossSalary.toString(),
          ...(variables || {}),
        };
      }
    }

    const rendered = this.renderTemplate(template.content, finalContext);
    return { html: rendered, variables: finalContext, templateName: template.name };
  }

  // ====================================================================
  // Generated Documents
  // ====================================================================

  async findGenerated(companyId: string, query: PaginationQueryDto & { employeeId?: string; category?: string }) {
    const where: any = {
      companyId,
      ...(query.employeeId && { employeeId: query.employeeId }),
      ...(query.category && { documentType: query.category }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.generatedDocument.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: { generatedAt: 'desc' },
        include: {
          employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
          template: { select: { id: true, name: true, category: true } },
        },
      }),
      this.prisma.generatedDocument.count({ where }),
    ]);

    return {
      items,
      meta: { total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) },
    };
  }

  /**
   * Generate a PDF from raw HTML using the shared Puppeteer browser instance.
   * This is exposed for other modules (e.g., payslip PDFs) to reuse the same
   * browser singleton instead of launching their own.
   */
  async generatePdf(html: string): Promise<Buffer> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    try {
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdf = await page.pdf({
        format: 'A4',
        margin: { top: '15mm', right: '15mm', bottom: '20mm', left: '15mm' },
        printBackground: true,
      });
      return pdf;
    } finally {
      await page.close().catch(() => {});
    }
  }

  /**
   * Get a single generated document by ID with full details.
   */
  async getGeneratedDocument(companyId: string, id: string) {
    const doc = await this.prisma.generatedDocument.findFirst({
      where: { id, companyId },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
        template: { select: { id: true, name: true, category: true } },
      },
    });
    if (!doc) throw new NotFoundException('Generated document not found.');
    return doc;
  }

  // ====================================================================
  // Template Rendering Engine
  // ====================================================================

  private renderTemplate(templateContent: string, variables: Record<string, any>): string {
    const compiled = Handlebars.compile(templateContent, { noEscape: true });
    return compiled(variables);
  }

  /**
   * Public wrapper around renderTemplate for other modules (e.g., EssService
   * for payslip PDFs) to render Handlebar templates with custom variables
   * while reusing the registered Handlebars helpers.
   */
  renderTemplateWithVariables(templateContent: string, variables: Record<string, any>): string {
    return this.renderTemplate(templateContent, variables);
  }

  private async renderPdf(htmlContent: string, employeeId: string, slug: string): Promise<string> {
    let page: any = null;
    try {
      const browser = await this.getBrowser();
      page = await browser.newPage();
      await page.setContent(htmlContent, { waitUntil: 'networkidle0', timeout: 30000 });

      const fileName = `${slug}-${employeeId}-${Date.now()}.pdf`;
      const filePath = path.join(this.uploadDir, 'generated', fileName);

      await page.pdf({
        path: filePath,
        format: 'A4',
        margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
        printBackground: true,
        timeout: 30000,
      });

      return `/storage/documents/generated/${fileName}`;
    } catch (err) {
      // Browser may have crashed — reset so next call relaunches
      this.browserPromise = null;
      throw err;
    } finally {
      if (page) {
        try { await page.close(); } catch { /* ignore */ }
      }
    }
  }

  private async renderDocx(
    templateContent: string,
    variables: Record<string, any>,
    employeeId: string,
    slug: string,
  ): Promise<string> {
    try {
      const PizZip = await import('pizzip');
      const Docxtemplater = await import('docxtemplater');

      // Create a minimal docx template from the HTML content
      // In production, this would use a pre-uploaded .docx template file
      const zip = new PizZip.default();
      zip.file('word/document.xml', this.htmlToDocxXml(templateContent));
      zip.file('[Content_Types].xml', this.docxContentTypes());
      zip.file('word/_rels/document.xml.rels', this.docxRelationships());

      const doc = new Docxtemplater.default();
      doc.loadZip(zip);

      // Set template variables
      const flatVars: Record<string, string> = {};
      for (const [key, val] of Object.entries(variables)) {
        flatVars[key] = String(val ?? '');
      }
      doc.setData(flatVars);
      doc.render();

      const buf = doc.getZip().generate({ type: 'nodebuffer' });
      const fileName = `${slug}-${employeeId}-${Date.now()}.docx`;
      const filePath = path.join(this.uploadDir, 'generated', fileName);
      await fs.writeFile(filePath, buf);
      return `/storage/documents/generated/${fileName}`;
    } catch (err) {
      this.logger.warn(`DOCX generation failed, falling back to HTML: ${(err as Error).message}`);
      // Fallback: generate HTML instead
      const rendered = this.renderTemplate(templateContent, variables);
      const fileName = `${slug}-${employeeId}-${Date.now()}.html`;
      const filePath = path.join(this.uploadDir, 'generated', fileName);
      await fs.writeFile(filePath, rendered, 'utf-8');
      return `/storage/documents/generated/${fileName}`;
    }
  }

  private htmlToDocxXml(html: string): string {
    // Simple HTML to basic Word XML conversion
    const cleanHtml = html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<\/?html>/gi, '')
      .replace(/<\/?head>/gi, '')
      .replace(/<\/?meta[^>]*>/gi, '');

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:r>
        <w:t>${cleanHtml.replace(/<[^>]*>/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</w:t>
      </w:r>
    </w:p>
  </w:body>
</w:document>`;
  }

  private docxContentTypes(): string {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;
  }

  private docxRelationships(): string {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;
  }

  private async saveHtml(htmlContent: string, employeeId: string, slug: string): Promise<string> {
    const fileName = `${slug}-${employeeId}-${Date.now()}.html`;
    const filePath = path.join(this.uploadDir, 'generated', fileName);
    await fs.writeFile(filePath, htmlContent, 'utf-8');
    return `/storage/documents/generated/${fileName}`;
  }

  // ====================================================================
  // Default Template Contents
  // ====================================================================

  private offerLetterTemplate(): string {
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @page { margin: 20mm 15mm; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12pt; line-height: 1.6; color: #222; max-width: 700px; margin: 0 auto; padding: 20px; }
  .header { text-align: center; border-bottom: 2px solid #0B6E63; padding-bottom: 15px; margin-bottom: 25px; }
  .header h1 { color: #0B6E63; font-size: 22pt; margin: 0; }
  .header p { color: #666; font-size: 10pt; margin: 5px 0 0; }
  .date { text-align: right; color: #555; margin-bottom: 20px; font-size: 11pt; }
  .subject { font-weight: 600; font-size: 13pt; margin: 20px 0; }
  .content p { margin: 8px 0; }
  .signature { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; }
  .signature p { margin: 3px 0; }
  .details-table { width: 100%; border-collapse: collapse; margin: 15px 0; }
  .details-table td { padding: 6px 10px; border-bottom: 1px solid #eee; }
  .details-table td:first-child { font-weight: 600; width: 180px; color: #555; }
  .footer { margin-top: 30px; font-size: 10pt; color: #888; text-align: center; }
</style>
</head>
<body>
<div class="header">
  <h1>{{companyName}}</h1>
  <p>{{companyAddress}}</p>
</div>

<div class="date">Date: {{formatDate currentDate}}</div>

<div class="subject">Subject: Offer of Employment</div>

<p>Dear <strong>{{candidateName}}</strong>,</p>

<div class="content">
<p>We are delighted to offer you the position of <strong>{{position}}</strong> in the <strong>{{department}}</strong> department at {{companyName}}. We were impressed with your qualifications and experience, and we believe you will be a valuable addition to our team.</p>

<p>Your employment will commence on <strong>{{formatDate joiningDate}}</strong> at our {{location}} office. Please find below the key terms of your offer:</p>

<table class="details-table">
  <tr><td>Position</td><td>{{position}}</td></tr>
  <tr><td>Department</td><td>{{department}}</td></tr>
  <tr><td>Date of Joining</td><td>{{formatDate joiningDate}}</td></tr>
  <tr><td>Location</td><td>{{location}}</td></tr>
  <tr><td>Annual CTC</td><td>{{currency salary}}</td></tr>
  <tr><td>Employment Type</td><td>{{employmentType}}</td></tr>
</table>

<p>This offer is contingent upon the verification of your credentials and background check. Please sign and return a copy of this letter to confirm your acceptance by {{formatDate joiningDate}}.</p>

<p>We look forward to welcoming you to the {{companyName}} family!</p>
</div>

<div class="signature">
  {{#if signatureImageUrl}}
  <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">
    <img src="{{signatureImageUrl}}" alt="Signature" style="height:36px;object-fit:contain;" />
  </div>
  {{/if}}
  <p>Sincerely,</p>
  <p><strong>{{#if signatureTitle}}{{signatureTitle}}{{else}}{{hrName}}{{/if}}</strong></p>
  <p>{{companyName}}</p>
</div>

<div class="footer">
  <p>{{companyName}} &bull; {{companyAddress}}</p>
</div>
</body>
</html>`;
  }

  private appointmentLetterTemplate(): string {
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @page { margin: 20mm 15mm; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12pt; line-height: 1.6; color: #222; max-width: 700px; margin: 0 auto; padding: 20px; }
  .header { text-align: center; border-bottom: 2px solid #10192B; padding-bottom: 15px; margin-bottom: 25px; }
  .header h1 { color: #10192B; font-size: 22pt; margin: 0; }
  .header p { color: #666; font-size: 10pt; margin: 5px 0 0; }
  .date { text-align: right; color: #555; margin-bottom: 20px; font-size: 11pt; }
  .subject { font-weight: 600; font-size: 13pt; margin: 20px 0; }
  .content p { margin: 8px 0; }
  .signature { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; }
  .signature p { margin: 3px 0; }
  .details-table { width: 100%; border-collapse: collapse; margin: 15px 0; }
  .details-table td { padding: 6px 10px; border-bottom: 1px solid #eee; }
  .details-table td:first-child { font-weight: 600; width: 200px; color: #555; }
  .footer { margin-top: 30px; font-size: 10pt; color: #888; text-align: center; }
</style>
</head>
<body>
<div class="header">
  <h1>{{companyName}}</h1>
  <p>{{companyAddress}}</p>
</div>

<div class="date">Date: {{formatDate currentDate}}</div>

<div class="subject">Subject: Appointment Letter</div>

<p>Dear <strong>{{employeeName}}</strong>,</p>

<div class="content">
<p>Further to our discussions and your acceptance of our offer, we are pleased to confirm your appointment with <strong>{{companyName}}</strong> as <strong>{{position}}</strong> in the <strong>{{department}}</strong> department.</p>

<table class="details-table">
  <tr><td>Employee Name</td><td>{{employeeName}}</td></tr>
  <tr><td>Designation</td><td>{{position}}</td></tr>
  <tr><td>Department</td><td>{{department}}</td></tr>
  <tr><td>Date of Joining</td><td>{{formatDate joiningDate}}</td></tr>
  <tr><td>Employment Type</td><td>{{employmentType}}</td></tr>
  <tr><td>Probation Period</td><td>{{probationPeriod}}</td></tr>
  <tr><td>Reporting Manager</td><td>{{reportingManager}}</td></tr>
</table>

<p>You will be on probation for a period of <strong>{{probationPeriod}}</strong> from the date of joining. Upon successful completion of your probation, your employment will be confirmed subject to satisfactory performance.</p>

<p>Your employment is governed by the terms and conditions outlined in the company handbook and policies. We trust you will find your association with {{companyName}} rewarding and fulfilling.</p>
</div>

<div class="signature">
  <p>Yours sincerely,</p>
  <p><strong>{{hrName}}</strong></p>
  <p>{{companyName}}</p>
</div>

<div class="footer">
  <p>{{companyName}} &bull; {{companyAddress}}</p>
</div>
</body>
</html>`;
  }

  private experienceLetterTemplate(): string {
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @page { margin: 20mm 15mm; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12pt; line-height: 1.6; color: #222; max-width: 700px; margin: 0 auto; padding: 20px; }
  .header { text-align: center; border-bottom: 2px solid #4DB6A8; padding-bottom: 15px; margin-bottom: 25px; }
  .header h1 { color: #4DB6A8; font-size: 22pt; margin: 0; }
  .header p { color: #666; font-size: 10pt; margin: 5px 0 0; }
  .header .cert-no { float: right; font-size: 9pt; color: #999; }
  .date { text-align: right; color: #555; margin-bottom: 20px; font-size: 11pt; }
  .subject { font-weight: 600; font-size: 13pt; margin: 20px 0; }
  .content p { margin: 8px 0; }
  .signature { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; }
  .signature p { margin: 3px 0; }
  .details-table { width: 100%; border-collapse: collapse; margin: 15px 0; }
  .details-table td { padding: 6px 10px; border-bottom: 1px solid #eee; }
  .details-table td:first-child { font-weight: 600; width: 200px; color: #555; }
  .footer { margin-top: 30px; font-size: 10pt; color: #888; text-align: center; }
  .certificate-border { border: 2px solid #4DB6A8; padding: 30px; border-radius: 4px; }
</style>
</head>
<body>
<div class="certificate-border">
<div class="header">
  <h1>{{companyName}}</h1>
  <p>{{companyAddress}}</p>
  <p class="cert-no">Certificate No: EXP-{{employeeCode}}-{{year}}</p>
</div>

<div class="subject">TO WHOM IT MAY CONCERN</div>

<p>This is to certify that <strong>{{employeeName}}</strong> was employed with <strong>{{companyName}}</strong> from <strong>{{formatDate startDate}}</strong> to <strong>{{formatDate endDate}}</strong>.</p>

<div class="content">
<p>During their tenure with us, {{firstName}} served as <strong>{{lastDesignation}}</strong> in the <strong>{{department}}</strong> department. Throughout their employment, they demonstrated professionalism, dedication, and strong work ethics.</p>

<p>We found {{firstName}} to be a sincere, hardworking, and valuable member of our team. They have consistently delivered quality work and maintained excellent relationships with colleagues and clients alike.</p>

<p>We wish {{firstName}} the very best in all their future endeavors.</p>
</div>

<div class="signature">
  <p>Sincerely,</p>
  <p><strong>{{hrName}}</strong></p>
  <p>{{companyName}}</p>
</div>

<div class="footer">
  <p>This is a computer-generated document and does not require a signature.</p>
</div>
</div>
</body>
</html>`;
  }

  private relievingLetterTemplate(): string {
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @page { margin: 20mm 15mm; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12pt; line-height: 1.6; color: #222; max-width: 700px; margin: 0 auto; padding: 20px; }
  .header { text-align: center; border-bottom: 2px solid #10192B; padding-bottom: 15px; margin-bottom: 25px; }
  .header h1 { color: #10192B; font-size: 22pt; margin: 0; }
  .header p { color: #666; font-size: 10pt; margin: 5px 0 0; }
  .date { text-align: right; color: #555; margin-bottom: 20px; font-size: 11pt; }
  .subject { font-weight: 600; font-size: 13pt; margin: 20px 0; }
  .content p { margin: 8px 0; }
  .signature { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; }
  .signature p { margin: 3px 0; }
  .details-table { width: 100%; border-collapse: collapse; margin: 15px 0; }
  .details-table td { padding: 6px 10px; border-bottom: 1px solid #eee; }
  .details-table td:first-child { font-weight: 600; width: 200px; color: #555; }
  .footer { margin-top: 30px; font-size: 10pt; color: #888; text-align: center; }
</style>
</head>
<body>
<div class="header">
  <h1>{{companyName}}</h1>
  <p>{{companyAddress}}</p>
</div>

<div class="date">Date: {{formatDate currentDate}}</div>

<div class="subject">Subject: Relieving Letter</div>

<p>Dear <strong>{{employeeName}}</strong>,</p>

<div class="content">
<p>This is with reference to your resignation dated <strong>{{formatDate resignationDate}}</strong>. We hereby confirm that you have been relieved from your duties effective <strong>{{formatDate lastWorkingDay}}</strong>.</p>

<p>You were working as <strong>{{position}}</strong> in the <strong>{{department}}</strong> department. We confirm that you have completed all the necessary formalities and cleared all dues with the company.</p>

<table class="details-table">
  <tr><td>Employee Name</td><td>{{employeeName}}</td></tr>
  <tr><td>Designation</td><td>{{position}}</td></tr>
  <tr><td>Department</td><td>{{department}}</td></tr>
  <tr><td>Last Working Day</td><td>{{formatDate lastWorkingDay}}</td></tr>
  <tr><td>Resignation Accepted On</td><td>{{formatDate resignationDate}}</td></tr>
</table>

<p>We appreciate your contributions during your tenure with {{companyName}} and wish you success in your future career.</p>
</div>

<div class="signature">
  <p>Yours sincerely,</p>
  <p><strong>{{hrName}}</strong></p>
  <p>{{companyName}}</p>
</div>

<div class="footer">
  <p>{{companyName}} &bull; {{companyAddress}}</p>
</div>
</body>
</html>`;
  }

  private payslipTemplate(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
    font-size: 11px;
    color: #1a1a2e;
    line-height: 1.5;
    background: #fff;
  }
  .page { max-width: 210mm; margin: 0 auto; padding: 20px 30px; }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 18px;
    border-bottom: 3px solid {{primaryColor}};
    margin-bottom: 20px;
  }
  .header .brand {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .header .brand-logo {
    width: 40px;
    height: 40px;
    object-fit: contain;
    border-radius: 6px;
  }
  .header h1 {
    font-size: 22px;
    font-weight: 700;
    color: {{primaryColor}};
    letter-spacing: -0.5px;
    margin: 0;
  }
  .header .company-name {
    font-size: 13px;
    color: #64748b;
    margin-top: 1px;
  }
  .header .period { text-align: right; font-size: 13px; color: #64748b; }
  .header .period strong { display: block; font-size: 16px; color: #1a1a2e; }
  .info-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px 24px;
    padding: 14px 16px;
    background: #f8fafc;
    border-radius: 8px;
    margin-bottom: 20px;
    border: 1px solid #e2e8f0;
  }
  .info-grid .label { color: #64748b; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
  .info-grid .value { font-weight: 600; color: #1a1a2e; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  th {
    text-align: left;
    padding: 8px 12px;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #64748b;
    background: #f1f5f9;
    border-bottom: 2px solid #e2e8f0;
  }
  td { padding: 7px 12px; border-bottom: 1px solid #f1f5f9; font-size: 11px; }
  td.amt { text-align: right; font-weight: 500; }
  tr.total td {
    border-top: 2px solid {{primaryColor}};
    font-weight: 700;
    font-size: 12px;
    background: {{primaryColor}}14;
  }
  tr.total td.amt { color: {{primaryColor}}; }
  .section-title {
    font-size: 12px;
    font-weight: 700;
    color: {{primaryColor}};
    margin-bottom: 8px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .footer {
    margin-top: 24px;
    padding-top: 14px;
    border-top: 1px solid #e2e8f0;
    display: flex;
    justify-content: space-between;
    font-size: 9px;
    color: #94a3b8;
  }
  .net-pay-box {
    background: linear-gradient(135deg, {{primaryColor}}, {{secondaryColor}});
    color: #fff;
    padding: 12px 20px;
    border-radius: 8px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }
  .net-pay-box .label { font-size: 11px; opacity: 0.85; text-transform: uppercase; letter-spacing: 0.5px; }
  .net-pay-box .amount { font-size: 22px; font-weight: 700; }
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div class="brand">
      {{#if companyLogoUrl}}
        <img src="{{companyLogoUrl}}" alt="Logo" class="brand-logo" />
      {{/if}}
      <div>
        <h1>Payslip</h1>
        <p class="company-name">{{companyName}}</p>
      </div>
    </div>
    <div class="period">
      <span>Pay Period</span>
      <strong>{{period}}</strong>
    </div>
  </div>

  <div class="info-grid">
    <div><div class="label">Employee Name</div><div class="value">{{employeeName}}</div></div>
    <div><div class="label">Employee Code</div><div class="value">{{employeeCode}}</div></div>
    <div><div class="label">Department</div><div class="value">{{department}}</div></div>
    <div><div class="label">Designation</div><div class="value">{{designation}}</div></div>
    <div><div class="label">Branch</div><div class="value">{{branch}}</div></div>
    <div><div class="label">Status</div><div class="value">{{status}}</div></div>
  </div>

  <div class="section-title">Earnings</div>
  <table>
    <thead><tr><th>Component</th><th class="amt">Amount</th></tr></thead>
    <tbody>
      <tr><td>Basic Salary</td><td class="amt">{{currency basic}}</td></tr>
      <tr><td>Housing Allowance</td><td class="amt">{{currency housingAllowance}}</td></tr>
      <tr><td>Transport Allowance</td><td class="amt">{{currency transportAllowance}}</td></tr>
      <tr><td>Medical Allowance</td><td class="amt">{{currency medicalAllowance}}</td></tr>
      <tr><td>Other Allowances</td><td class="amt">{{currency otherAllowances}}</td></tr>
      {{#ifEquals overtimePay 0}}{{else}}<tr><td>Overtime Pay</td><td class="amt">{{currency overtimePay}}</td></tr>{{/ifEquals}}
      {{#ifEquals bonus 0}}{{else}}<tr><td>Bonus</td><td class="amt">{{currency bonus}}</td></tr>{{/ifEquals}}
      <tr class="total"><td>Gross Pay</td><td class="amt">{{currency grossPay}}</td></tr>
    </tbody>
  </table>

  <div class="section-title">Deductions</div>
  <table>
    <thead><tr><th>Component</th><th class="amt">Amount</th></tr></thead>
    <tbody>
      <tr><td>Tax Deduction</td><td class="amt">{{currency taxDeduction}}</td></tr>
      <tr><td>Pension Deduction</td><td class="amt">{{currency pensionDeduction}}</td></tr>
      <tr><td>Insurance Deduction</td><td class="amt">{{currency insuranceDeduction}}</td></tr>
      {{#ifEquals loanDeduction 0}}{{else}}<tr><td>Loan Deduction</td><td class="amt">{{currency loanDeduction}}</td></tr>{{/ifEquals}}
      {{#ifEquals otherDeductions 0}}{{else}}<tr><td>Other Deductions</td><td class="amt">{{currency otherDeductions}}</td></tr>{{/ifEquals}}
      <tr class="total"><td>Total Deductions</td><td class="amt">{{currency totalDeductions}}</td></tr>
    </tbody>
  </table>

  <div class="net-pay-box">
    <span class="label">Net Pay</span>
    <span class="amount">{{currency netPay}}</span>
  </div>

  <div class="footer" style="margin-bottom: {{#if signatureImageUrl}}8{{else}}0{{/if}}px;">
    <span>{{companyName}} &bull; Generated {{generatedDate}}</span>
    <span>This is a computer-generated document</span>
  </div>

  {{#if signatureImageUrl}}
  <div style="margin-top: 14px; padding-top: 14px; border-top: 1px solid #e2e8f0; display: flex; align-items: center; gap: 14px;">
    <img src="{{signatureImageUrl}}" alt="Signature" style="height: 36px; object-fit: contain;" />
    <div style="display: flex; flex-direction: column; gap: 2px;">
      <span style="font-size: 11px; font-weight: 600; color: #1a1a2e;">{{#if signatureTitle}}{{signatureTitle}}{{else}}Authorized Signatory{{/if}}</span>
      <span style="font-size: 10px; color: #64748b;">{{companyName}}</span>
    </div>
  </div>
  {{/if}}
</div>
</body>
</html>`;
  }

  private salaryCertificateTemplate(): string {
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @page { margin: 20mm 15mm; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12pt; line-height: 1.6; color: #222; max-width: 700px; margin: 0 auto; padding: 20px; }
  .header { text-align: center; border-bottom: 2px solid #0B6E63; padding-bottom: 15px; margin-bottom: 25px; }
  .header h1 { color: #0B6E63; font-size: 22pt; margin: 0; }
  .header p { color: #666; font-size: 10pt; margin: 5px 0 0; }
  .date { text-align: right; color: #555; margin-bottom: 20px; font-size: 11pt; }
  .subject { font-weight: 600; font-size: 13pt; margin: 20px 0; }
  .content p { margin: 8px 0; }
  .signature { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; }
  .signature p { margin: 3px 0; }
  .salary-table { width: 100%; border-collapse: collapse; margin: 15px 0; }
  .salary-table th { background: #0B6E63; color: white; padding: 8px 10px; text-align: left; font-size: 11pt; }
  .salary-table td { padding: 6px 10px; border-bottom: 1px solid #ddd; }
  .salary-table .total { font-weight: 600; background: #f5f5f5; }
  .salary-table td:last-child { text-align: right; font-weight: 500; }
  .footer { margin-top: 30px; font-size: 10pt; color: #888; text-align: center; }
  .cert-stamp { margin-top: 20px; border: 1px dashed #0B6E63; padding: 15px; text-align: center; color: #0B6E63; font-size: 10pt; }
</style>
</head>
<body>
<div class="header">
  <h1>{{companyName}}</h1>
  <p>{{companyAddress}}</p>
</div>

<div class="date">Date: {{formatDate currentDate}}</div>

<div class="subject">Salary Certificate</div>

<p>This is to certify that <strong>{{employeeName}}</strong> is employed with <strong>{{companyName}}</strong> as <strong>{{position}}</strong> in the <strong>{{department}}</strong> department.</p>

<p>The annual compensation details as of <strong>{{formatDate effectiveDate}}</strong> are as follows:</p>

<table class="salary-table">
  <tr><th colspan="2">Annual Salary Breakdown</th></tr>
  <tr><td>Basic Salary</td><td>{{currency basicSalary}}</td></tr>
  <tr><td>Total Cost to Company (CTC)</td><td>{{currency totalCTC}}</td></tr>
</table>

<div class="cert-stamp">
  <strong>This is a computer-generated certificate.</strong><br>
  Generated on: {{formatDate currentDate}}
</div>

<div class="signature">
  <p>Authorized Signatory</p>
  <p><strong>{{hrName}}</strong></p>
  <p>{{companyName}}</p>
</div>

<div class="footer">
  <p>{{companyName}} &bull; {{companyAddress}}</p>
</div>
</body>
</html>`;
  }
}
