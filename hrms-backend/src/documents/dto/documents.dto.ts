import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';

export enum DocumentCategoryDto {
  ID_PROOF = 'ID_PROOF',
  ADDRESS_PROOF = 'ADDRESS_PROOF',
  EDUCATION = 'EDUCATION',
  CERTIFICATION = 'CERTIFICATION',
  CONTRACT = 'CONTRACT',
  TAX_FORM = 'TAX_FORM',
  MEDICAL = 'MEDICAL',
  OTHER = 'OTHER',
}

export class UploadDocumentDto {
  @ApiProperty() @IsString() name: string;

  @ApiPropertyOptional({ enum: DocumentCategoryDto, default: DocumentCategoryDto.OTHER })
  @IsOptional()
  @IsEnum(DocumentCategoryDto)
  category?: DocumentCategoryDto;

  @ApiProperty() @IsString() fileUrl: string;

  @ApiPropertyOptional() @IsOptional() @IsInt() fileSize?: number;

  @ApiPropertyOptional() @IsOptional() @IsString() mimeType?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}
