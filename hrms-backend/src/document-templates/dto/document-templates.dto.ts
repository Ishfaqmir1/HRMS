import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsJSON,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export enum DocumentTemplateCategory {
  OFFER_LETTER = 'OFFER_LETTER',
  APPOINTMENT_LETTER = 'APPOINTMENT_LETTER',
  EXPERIENCE_LETTER = 'EXPERIENCE_LETTER',
  RELIEVING_LETTER = 'RELIEVING_LETTER',
  SALARY_CERTIFICATE = 'SALARY_CERTIFICATE',
  CONFIRMATION_LETTER = 'CONFIRMATION_LETTER',
  PROMOTION_LETTER = 'PROMOTION_LETTER',
  TRANSFER_LETTER = 'TRANSFER_LETTER',
  PAYSLIP = 'PAYSLIP',
  OTHER = 'OTHER',
}

export const DOCUMENT_CATEGORY_LABELS: Record<string, string> = {
  OFFER_LETTER: 'Offer Letter',
  APPOINTMENT_LETTER: 'Appointment Letter',
  EXPERIENCE_LETTER: 'Experience Letter',
  RELIEVING_LETTER: 'Relieving Letter',
  SALARY_CERTIFICATE: 'Salary Certificate',
  CONFIRMATION_LETTER: 'Confirmation Letter',
  PROMOTION_LETTER: 'Promotion Letter',
  TRANSFER_LETTER: 'Transfer Letter',
  PAYSLIP: 'Payslip Template',
  OTHER: 'Other',
};

export class CreateDocumentTemplateDto {
  @ApiProperty() @IsString() name: string;

  @ApiProperty() @IsEnum(DocumentTemplateCategory) category: DocumentTemplateCategory;

  @ApiProperty() @IsString() content: string;

  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;

  @ApiPropertyOptional() @IsOptional() @IsBoolean() isDefault?: boolean;

  @ApiPropertyOptional({ description: 'JSON string of variable names used in template' })
  @IsOptional() @IsJSON() variables?: string;
}

export class UpdateDocumentTemplateDto {
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;

  @ApiPropertyOptional() @IsOptional() @IsEnum(DocumentTemplateCategory) category?: DocumentTemplateCategory;

  @ApiPropertyOptional() @IsOptional() @IsString() content?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;

  @ApiPropertyOptional() @IsOptional() @IsBoolean() isDefault?: boolean;

  @ApiPropertyOptional({ description: 'JSON string of variable names used in template' })
  @IsOptional() @IsJSON() variables?: string;
}

export class GenerateDocumentDto {
  @ApiProperty() @IsUUID() templateId: string;

  @ApiProperty({ description: 'Array of employee IDs to generate documents for' })
  employeeIds: string[];

  @ApiPropertyOptional({ description: 'Additional variable overrides (e.g. {"customReason": "Excellent performance"})' })
  @IsOptional() variables?: Record<string, string>;

  @ApiPropertyOptional({ enum: ['pdf', 'docx', 'html'], default: 'pdf' })
  @IsOptional() @IsString() format?: 'pdf' | 'docx' | 'html';

  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export class PreviewTemplateDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() templateId?: string;

  @ApiPropertyOptional({ description: 'Raw template content to preview (if no templateId)' })
  @IsOptional() @IsString() content?: string;

  @ApiPropertyOptional() @IsOptional() @IsUUID() employeeId?: string;

  @ApiPropertyOptional() @IsOptional() variables?: Record<string, string>;
}
