import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { DocumentTemplatesService } from './document-templates.service';
import {
  CreateDocumentTemplateDto,
  UpdateDocumentTemplateDto,
  GenerateDocumentDto,
  PreviewTemplateDto,
} from './dto/document-templates.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { TenantId } from '../common/decorators/tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';

@ApiTags('Document Templates')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller('document-templates')
export class DocumentTemplatesController {
  constructor(private readonly documentTemplatesService: DocumentTemplatesService) {}

  // ==================================================================
  // Template CRUD
  // ==================================================================

  @Post()
  @Permissions('documents.create')
  create(
    @TenantId() companyId: string,
    @Body() dto: CreateDocumentTemplateDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.documentTemplatesService.create(companyId, dto, userId);
  }

  @Get()
  @Permissions('documents.read')
  findAll(
    @TenantId() companyId: string,
    @Query() query: PaginationQueryDto & { category?: string },
  ) {
    return this.documentTemplatesService.findAll(companyId, query);
  }

  @Get(':id')
  @Permissions('documents.read')
  findOne(@TenantId() companyId: string, @Param('id') id: string) {
    return this.documentTemplatesService.findOne(companyId, id);
  }

  @Patch(':id')
  @Permissions('documents.update')
  update(
    @TenantId() companyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateDocumentTemplateDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.documentTemplatesService.update(companyId, id, dto, userId);
  }

  @Delete(':id')
  @Permissions('documents.delete')
  remove(
    @TenantId() companyId: string,
    @Param('id') id: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.documentTemplatesService.remove(companyId, id, userId);
  }

  // ==================================================================
  // Seed Defaults
  // ==================================================================

  @Post('seed')
  @Permissions('documents.create')
  seedDefaults(@TenantId() companyId: string) {
    return this.documentTemplatesService.seedDefaults(companyId);
  }

  // ==================================================================
  // Preview
  // ==================================================================

  @Post('preview')
  @Permissions('documents.read')
  preview(
    @TenantId() companyId: string,
    @Body() dto: PreviewTemplateDto,
  ) {
    if (dto.content) {
      // Preview raw template content without a saved template
      return this.documentTemplatesService.previewContent(
        companyId,
        dto.content,
        dto.variables,
        dto.employeeId,
      );
    }
    return this.documentTemplatesService.preview(
      companyId,
      dto.templateId!,
      dto.variables,
      dto.employeeId,
    );
  }

  // ==================================================================
  // Generation
  // ==================================================================

  @Post('generate')
  @Permissions('documents.create')
  generate(
    @TenantId() companyId: string,
    @Body() dto: GenerateDocumentDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.documentTemplatesService.generate(companyId, dto, userId);
  }

  // ==================================================================
  // Generated Documents
  // ==================================================================

  @Get('generated')
  @Permissions('documents.read')
  findGenerated(
    @TenantId() companyId: string,
    @Query() query: PaginationQueryDto & { employeeId?: string; category?: string },
  ) {
    return this.documentTemplatesService.findGenerated(companyId, query);
  }

  // ==================================================================
  // File Download
  // ==================================================================

  @Get('generated/:id/download')
  @Permissions('documents.read')
  async download(
    @TenantId() companyId: string,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const doc = await this.documentTemplatesService.getGeneratedDocument(companyId, id);
    const filePath = path.join(process.cwd(), 'storage', 'documents', 'generated', path.basename(doc.fileUrl));

    if (!fs.existsSync(filePath)) {
      res.status(404).json({ message: 'File not found.' });
      return;
    }

    const fileName = `${doc.title.replace(/[^a-zA-Z0-9-_\s]/g, '')}.${doc.fileType}`;
    res.setHeader('Content-Type', this.getMimeType(doc.fileType));
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', fs.statSync(filePath).size.toString());
    res.sendFile(filePath);
  }

  private getMimeType(fileType: string): string {
    switch (fileType) {
      case 'pdf': return 'application/pdf';
      case 'docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      case 'html': return 'text/html; charset=utf-8';
      default: return 'application/octet-stream';
    }
  }
}
