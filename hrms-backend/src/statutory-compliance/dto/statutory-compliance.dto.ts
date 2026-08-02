import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Min, Max } from 'class-validator';

export class UpdateComplianceConfigDto {
  @ApiPropertyOptional({ description: 'Enable PF deduction' })
  @IsOptional() @IsBoolean() enablePf?: boolean;

  @ApiPropertyOptional({ default: 15000 })
  @IsOptional() @IsInt() @Min(0) pfWageCeiling?: number;

  @ApiPropertyOptional({ default: 12 })
  @IsOptional() @IsNumber() @Min(0) @Max(100) pfEmployeePct?: number;

  @ApiPropertyOptional({ default: 12 })
  @IsOptional() @IsNumber() @Min(0) @Max(100) pfEmployerPct?: number;

  @ApiPropertyOptional({ description: 'Enable ESI deduction' })
  @IsOptional() @IsBoolean() enableEsi?: boolean;

  @ApiPropertyOptional({ default: 21000 })
  @IsOptional() @IsInt() @Min(0) esiWageCeiling?: number;

  @ApiPropertyOptional({ default: 0.75 })
  @IsOptional() @IsNumber() @Min(0) @Max(100) esiEmployeePct?: number;

  @ApiPropertyOptional({ default: 3.25 })
  @IsOptional() @IsNumber() @Min(0) @Max(100) esiEmployerPct?: number;

  @ApiPropertyOptional({ description: 'Enable Professional Tax' })
  @IsOptional() @IsBoolean() enablePt?: boolean;

  @ApiPropertyOptional({ description: 'State for PT calculation', example: 'KARNATAKA' })
  @IsOptional() @IsString() ptState?: string;

  @ApiPropertyOptional({ description: 'Enable TDS deduction' })
  @IsOptional() @IsBoolean() enableTds?: boolean;

  @ApiPropertyOptional({ enum: ['NEW', 'OLD'], description: 'Tax regime' })
  @IsOptional() @IsString() tdsRegime?: string;
}

export class CalculateStatutoryDeductionsDto {
  @ApiProperty({ description: 'Gross monthly salary/wage' })
  @IsNumber() @Min(0) grossPay: number;

  @ApiPropertyOptional({ description: 'State for PT calculation', default: 'KARNATAKA' })
  @IsOptional() @IsString() state?: string;

  @ApiPropertyOptional({ description: 'Use new tax regime', default: true })
  @IsOptional() @IsBoolean() newRegime?: boolean;
}

export class CalculateStatutoryDeductionsResult {
  pfEmployeeShare: number;
  pfEmployerShare: number;
  esiEmployeeShare: number;
  esiEmployerShare: number;
  professionalTax: number;
  tdsEstimatedMonthly: number;
  totalEmployeeDeductions: number;
  totalEmployerContributions: number;
}

/// Response wrapper for compliance config
export class ComplianceConfigResponse {
  id: string;
  companyId: string;
  enablePf: boolean;
  pfWageCeiling: number;
  pfEmployeePct: number;
  pfEmployerPct: number;
  enableEsi: boolean;
  esiWageCeiling: number;
  esiEmployeePct: number;
  esiEmployerPct: number;
  enablePt: boolean;
  ptState: string;
  enableTds: boolean;
  tdsRegime: string;
  createdAt: Date;
  updatedAt: Date;
}
