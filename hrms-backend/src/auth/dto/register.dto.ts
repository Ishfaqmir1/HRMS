import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'Acme Corporation' })
  @IsString()
  @IsNotEmpty()
  companyName: string;

  @ApiProperty({ example: 'acme-corp', description: 'Unique tenant slug, used for subdomain routing' })
  @IsString()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Slug may only contain lowercase letters, numbers, and hyphens.',
  })
  companySlug: string;

  @ApiProperty({ example: 'Technology' })
  @IsOptional()
  @IsString()
  industry?: string;

  @ApiProperty({ example: '11-50' })
  @IsOptional()
  @IsString()
  size?: string;

  @ApiProperty({ example: 'US' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiProperty({ example: 'America/New_York' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiProperty({ example: 'USD' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({ example: '22AAAAA0000A1Z5' })
  @IsOptional()
  @IsString()
  gstNumber?: string;

  @ApiProperty({ example: 'ABCDE1234F' })
  @IsOptional()
  @IsString()
  panNumber?: string;

  @ApiProperty({ example: '+1-555-0100' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ example: 'acme.com' })
  @IsOptional()
  @IsString()
  domain?: string;

  @ApiProperty({ example: 'clx8e2g3k0000abc123def456', description: 'Selected billing plan ID during registration' })
  @IsOptional()
  @IsString()
  billingPlanId?: string;

  @ApiProperty({ example: 'Jane' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty({ example: 'jane.doe@acme.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'StrongPass123!', minLength: 8 })
  @IsString()
  @MinLength(8)
  @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message: 'Password must contain uppercase, lowercase, and a number or symbol.',
  })
  password: string;
}

export class VerifyEmailDto {
  @ApiProperty({ description: 'Email verification token' })
  @IsString()
  @IsNotEmpty()
  token: string;
}
