import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateBillingPlanDto {
  @ApiProperty() @IsString() name: string;
  @ApiProperty() @IsString() slug: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional({ default: 0 }) @IsOptional() @IsNumber() minMonthlyFee?: number;
  @ApiPropertyOptional({ default: 0 }) @IsOptional() @IsNumber() pricePerEmployee?: number;
  @ApiPropertyOptional({ default: 25 }) @IsOptional() @IsInt() includedEmployees?: number;
  @ApiPropertyOptional({ default: 25 }) @IsOptional() @IsInt() maxEmployees?: number;
  @ApiPropertyOptional({ default: 15 }) @IsOptional() @IsInt() annualDiscountPercent?: number;
  @ApiPropertyOptional({ default: 5 }) @IsOptional() @IsInt() maxStorageGB?: number;
  @ApiPropertyOptional({ default: 'INR' }) @IsOptional() @IsString() currency?: string;
  @ApiPropertyOptional() @IsOptional() features?: any;
  @ApiPropertyOptional({ default: 0 }) @IsOptional() @IsInt() sortOrder?: number;
  @ApiPropertyOptional({ default: 0 }) @IsOptional() @IsNumber() yearlyPrice?: number;
  @ApiPropertyOptional({ default: 0 }) @IsOptional() @IsInt() apiLimit?: number;
  @ApiPropertyOptional({ default: 'none' }) @IsOptional() @IsString() prioritySupport?: string;
  @ApiPropertyOptional({ default: 'PUBLIC' }) @IsOptional() @IsString() visibility?: string;
}

export class UpdateBillingPlanDto {
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() minMonthlyFee?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() pricePerEmployee?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() includedEmployees?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() maxEmployees?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() annualDiscountPercent?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() maxStorageGB?: number;
  @ApiPropertyOptional() @IsOptional() features?: any;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsInt() sortOrder?: number;
  @ApiPropertyOptional({ default: 0 }) @IsOptional() @IsNumber() yearlyPrice?: number;
  @ApiPropertyOptional({ default: 0 }) @IsOptional() @IsInt() apiLimit?: number;
  @ApiPropertyOptional({ default: 'none' }) @IsOptional() @IsString() prioritySupport?: string;
  @ApiPropertyOptional({ default: 'PUBLIC' }) @IsOptional() @IsString() visibility?: string;
}

export class CreatePlanFeatureDto {
  @ApiProperty() @IsString() code: string;
  @ApiProperty() @IsString() name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional({ default: 'core' }) @IsOptional() @IsString() category?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() icon?: string;
  @ApiPropertyOptional({ default: 0 }) @IsOptional() @IsInt() sortOrder?: number;
}

export class UpdatePlanFeatureDto {
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() category?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() icon?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsInt() sortOrder?: number;
}

export class UpdateFeatureMappingDto {
  @ApiProperty() @IsBoolean() isEnabled: boolean;
}

export class UpdateCompanySubscriptionDto {
  @ApiProperty() @IsString() billingPlanId: string;
  @ApiPropertyOptional() @IsOptional() @IsString() billingCycle?: 'MONTHLY' | 'YEARLY';
}

export class CreateFeatureFlagDto {
  @ApiProperty() @IsString() code: string;
  @ApiProperty() @IsString() name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isGlobal?: boolean;
}

export class ToggleFeatureFlagDto {
  @ApiProperty() @IsBoolean() isEnabled: boolean;
}

// ════════════════════════════════════════════════════════════════
// Payment Method DTOs
// ════════════════════════════════════════════════════════════════

export class AddPaymentMethodDto {
  @ApiProperty({ example: 'Visa' })
  @IsString()
  brand: string;

  @ApiProperty({ example: '4242' })
  @IsString()
  last4: string;

  @ApiProperty({ example: 12 })
  @IsInt()
  expMonth: number;

  @ApiProperty({ example: 2027 })
  @IsInt()
  expYear: number;

  @ApiPropertyOptional({ example: 'John Doe' })
  @IsOptional()
  @IsString()
  cardholderName?: string;

  @ApiPropertyOptional({ example: '123 Main St' })
  @IsOptional()
  @IsString()
  billingAddress1?: string;

  @ApiPropertyOptional({ example: 'Apt 4B' })
  @IsOptional()
  @IsString()
  billingAddress2?: string;

  @ApiPropertyOptional({ example: 'New York' })
  @IsOptional()
  @IsString()
  billingCity?: string;

  @ApiPropertyOptional({ example: 'NY' })
  @IsOptional()
  @IsString()
  billingState?: string;

  @ApiPropertyOptional({ example: '10001' })
  @IsOptional()
  @IsString()
  billingPostalCode?: string;

  @ApiPropertyOptional({ example: 'US' })
  @IsOptional()
  @IsString()
  billingCountry?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdatePaymentMethodDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cardholderName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  billingAddress1?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  billingAddress2?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  billingCity?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  billingState?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  billingPostalCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  billingCountry?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class SetDefaultPaymentMethodDto {
  @ApiProperty()
  @IsBoolean()
  isDefault: boolean;
}

export class UpdateAutoPayDto {
  @ApiProperty()
  @IsBoolean()
  autoPay: boolean;
}

export class UpdateBillingContactDto {
  @ApiPropertyOptional({ example: 'billing@company.com' })
  @IsOptional()
  @IsString()
  billingEmail?: string;

  @ApiPropertyOptional({ example: '22AAAAA0000A1Z5' })
  @IsOptional()
  @IsString()
  gstNumber?: string;

  @ApiPropertyOptional({ example: 'ABCDE1234F' })
  @IsOptional()
  @IsString()
  panNumber?: string;

  @ApiPropertyOptional({ example: '123 Main St' })
  @IsOptional()
  @IsString()
  addressLine1?: string;

  @ApiPropertyOptional({ example: 'New York' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ example: '10001' })
  @IsOptional()
  @IsString()
  postalCode?: string;
}

export class UpdateCompanyBrandingDto {
  @ApiPropertyOptional() @IsOptional() @IsString() primaryColor?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() secondaryColor?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() accentColor?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() logoUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() faviconUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() companyName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() customDomain?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() emailFooter?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() enabled?: boolean;

  // Signature fields
  @ApiPropertyOptional() @IsOptional() @IsString() signatureImageUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() signatureEnabled?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() signatureTitle?: string;

  // Company address fields
  @ApiPropertyOptional() @IsOptional() @IsString() companyAddress?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() companyCity?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() companyState?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() companyPostalCode?: string;
}
