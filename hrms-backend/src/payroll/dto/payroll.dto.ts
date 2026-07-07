import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

// ============================================================================
// Salary Structure
// ============================================================================
export class CreateSalaryStructureDto {
  @ApiProperty() @IsString() name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;

  @ApiPropertyOptional({ default: 0 }) @IsOptional() @IsNumber() basic?: number;
  @ApiPropertyOptional({ default: 0 }) @IsOptional() @IsNumber() housingAllowance?: number;
  @ApiPropertyOptional({ default: 0 }) @IsOptional() @IsNumber() transportAllowance?: number;
  @ApiPropertyOptional({ default: 0 }) @IsOptional() @IsNumber() medicalAllowance?: number;
  @ApiPropertyOptional({ default: 0 }) @IsOptional() @IsNumber() otherAllowances?: number;
  @ApiPropertyOptional({ default: 0 }) @IsOptional() @IsNumber() taxPercent?: number;
  @ApiPropertyOptional({ default: 0 }) @IsOptional() @IsNumber() pensionPercent?: number;
  @ApiPropertyOptional({ default: 0 }) @IsOptional() @IsNumber() insuranceDeduction?: number;
}

export class UpdateSalaryStructureDto extends PartialType(CreateSalaryStructureDto) {}

// ============================================================================
// Employee Salary
// ============================================================================
export class CreateEmployeeSalaryDto {
  @ApiProperty() @IsUUID() employeeId: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() structureId?: string;
  @ApiProperty() @IsDateString() effectiveFrom: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() effectiveTo?: string;

  @ApiPropertyOptional({ default: 0 }) @IsOptional() @IsNumber() basic?: number;
  @ApiPropertyOptional({ default: 0 }) @IsOptional() @IsNumber() housingAllowance?: number;
  @ApiPropertyOptional({ default: 0 }) @IsOptional() @IsNumber() transportAllowance?: number;
  @ApiPropertyOptional({ default: 0 }) @IsOptional() @IsNumber() medicalAllowance?: number;
  @ApiPropertyOptional({ default: 0 }) @IsOptional() @IsNumber() otherAllowances?: number;
  @ApiPropertyOptional({ default: 0 }) @IsOptional() @IsNumber() taxPercent?: number;
  @ApiPropertyOptional({ default: 0 }) @IsOptional() @IsNumber() pensionPercent?: number;
  @ApiPropertyOptional({ default: 0 }) @IsOptional() @IsNumber() insuranceDeduction?: number;
}

export class UpdateEmployeeSalaryDto extends PartialType(CreateEmployeeSalaryDto) {}

// ============================================================================
// Payroll Run
// ============================================================================
export class CreatePayrollRunDto {
  @ApiProperty({ example: 7 }) @IsInt() @Min(1) @Max(12) month: number;
  @ApiProperty({ example: 2026 }) @IsInt() year: number;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

// ============================================================================
// Payslip
// ============================================================================
export class UpdatePayslipStatusDto {
  @ApiProperty({ enum: ['APPROVED', 'PAID'] })
  @IsEnum(['APPROVED', 'PAID'] as const)
  status: 'APPROVED' | 'PAID';

  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

// ============================================================================
// Loan
// ============================================================================
export class CreateLoanDto {
  @ApiProperty() @IsUUID() employeeId: string;
  @ApiProperty({ enum: ['PERSONAL', 'ADVANCE', 'EMERGENCY'] })
  @IsEnum(['PERSONAL', 'ADVANCE', 'EMERGENCY'] as const)
  loanType: 'PERSONAL' | 'ADVANCE' | 'EMERGENCY';
  @ApiProperty() @IsNumber() amount: number;
  @ApiPropertyOptional({ default: 0 }) @IsOptional() @IsNumber() interestRate?: number;
  @ApiProperty() @IsInt() @Min(1) @Max(60) repaymentMonths: number;
  @ApiPropertyOptional() @IsOptional() @IsString() purpose?: string;
}

export class ApproveLoanDto {
  @ApiProperty() @IsDateString() disbursedAt: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export class RejectLoanDto {
  @ApiProperty() @IsString() reason: string;
}

// ============================================================================
// Reimbursement Category
// ============================================================================
export class CreateReimbursementCategoryDto {
  @ApiProperty() @IsString() name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() maxAmount?: number;
}

export class UpdateReimbursementCategoryDto extends PartialType(CreateReimbursementCategoryDto) {}

// ============================================================================
// Reimbursement
// ============================================================================
export class CreateReimbursementDto {
  @ApiProperty() @IsUUID() employeeId: string;
  @ApiProperty() @IsUUID() categoryId: string;
  @ApiProperty() @IsNumber() amount: number;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() receiptUrl?: string;
}

export class ApproveReimbursementDto {
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}
