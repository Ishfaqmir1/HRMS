import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';

export enum TaxDeclarationStatusDto {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
}

export class CreateTaxDeclarationDto {
  @ApiProperty({ example: '2025-26' }) @IsString() financialYear: string;

  @ApiPropertyOptional() @IsOptional() @IsString() panNumber?: string;

  @ApiPropertyOptional() @IsOptional() declarations?: Record<string, any>;

  @ApiPropertyOptional() @IsOptional() @IsNumber() totalIncome?: number;

  @ApiPropertyOptional() @IsOptional() @IsNumber() totalDeductions?: number;

  @ApiPropertyOptional() @IsOptional() @IsNumber() totalTaxPaid?: number;
}

export class UpdateTaxDeclarationDto {
  @ApiPropertyOptional() @IsOptional() @IsString() panNumber?: string;

  @ApiPropertyOptional() @IsOptional() declarations?: Record<string, any>;

  @ApiPropertyOptional() @IsOptional() @IsNumber() totalIncome?: number;

  @ApiPropertyOptional() @IsOptional() @IsNumber() totalDeductions?: number;

  @ApiPropertyOptional() @IsOptional() @IsNumber() totalTaxPaid?: number;
}
