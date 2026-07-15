import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEmail } from 'class-validator';

export class UpdateCompanyDto {
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() logoUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() industry?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() size?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() timezone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() locale?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() currency?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() billingEmail?: string;

  // Profile fields
  @ApiPropertyOptional() @IsOptional() @IsString() gstNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() panNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() addressLine1?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() addressLine2?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() city?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() state?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() country?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() postalCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() domain?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
}

/** Super admin update of any company (bypasses company ownership check). */
export class AdminUpdateCompanyDto {
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() industry?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() size?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() timezone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() locale?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() currency?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() country?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() gstNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() panNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() addressLine1?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() addressLine2?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() city?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() state?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() postalCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() domain?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() billingEmail?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() billingPlanId?: string;
}
