import {
  Controller,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Permissions } from '../common/decorators/permissions.decorator';
import { TenantId } from '../common/decorators/tenant.decorator';

@ApiTags('Upload')
@ApiBearerAuth()
@Controller('upload')
export class UploadController {
  private readonly logger = new Logger(UploadController.name);

  constructor() {
    // Ensure upload directories exist
    const fs = require('fs');
    const dirs = [
      join(process.cwd(), 'storage', 'uploads', 'branding'),
      join(process.cwd(), 'storage', 'uploads', 'documents'),
    ];
    for (const dir of dirs) {
      try { fs.mkdirSync(dir, { recursive: true }); } catch { /* exists */ }
    }
  }

  @Post('branding')
  @UseGuards(PermissionsGuard)
  @Permissions('company.update')
  @Permissions('company.update')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: join(process.cwd(), 'storage', 'uploads', 'branding'),
        filename: (_req, file: any, cb) => {
          const ext = extname(file.originalname).toLowerCase();
          const name = `${uuidv4()}${ext}`;
          cb(null, name);
        },
      }),
      limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
      fileFilter: (_req: any, file: any, cb: any) => {
        const allowed = ['.png', '.jpg', '.jpeg', '.gif', '.svg'];
        const ext = extname(file.originalname).toLowerCase();
        if (!allowed.includes(ext)) {
          cb(new BadRequestException('Only image files (PNG, JPG, GIF, SVG) are allowed.'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  uploadBrandingImage(
    @TenantId() _companyId: string,
    @UploadedFile() file: any,
  ) {
    if (!file) throw new BadRequestException('No file uploaded.');
    return {
      url: `/storage/uploads/branding/${file.filename}`,
      filename: file.filename,
      originalName: file.originalname,
      size: file.size,
      mimeType: file.mimetype,
    };
  }

  @Post('company-document')
  @UseGuards(PermissionsGuard)
  @Permissions('company.update')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: join(process.cwd(), 'storage', 'uploads', 'documents'),
        filename: (_req, file: any, cb) => {
          const ext = extname(file.originalname).toLowerCase();
          const name = `${uuidv4()}${ext}`;
          cb(null, name);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
      fileFilter: (_req: any, file: any, cb: any) => {
        const allowed = ['.pdf', '.png', '.jpg', '.jpeg'];
        const ext = extname(file.originalname).toLowerCase();
        if (!allowed.includes(ext)) {
          cb(new BadRequestException('Only PDF, PNG, and JPG files are allowed.'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  uploadCompanyDocument(
    @TenantId() _companyId: string,
    @UploadedFile() file: any,
  ) {
    if (!file) throw new BadRequestException('No file uploaded.');
    return {
      url: `/storage/uploads/documents/${file.filename}`,
      filename: file.filename,
      originalName: file.originalname,
      size: file.size,
      mimeType: file.mimetype,
    };
  }
}
