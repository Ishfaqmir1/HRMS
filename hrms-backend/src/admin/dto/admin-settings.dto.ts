import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdatePlatformSettingsDto {
  @ApiPropertyOptional({ description: 'Platform name shown across the app' })
  @IsOptional()
  @IsString()
  platformName?: string;

  @ApiPropertyOptional({ description: 'Platform logo URL' })
  @IsOptional()
  @IsString()
  platformLogoUrl?: string;

  @ApiPropertyOptional({ description: 'Platform favicon URL' })
  @IsOptional()
  @IsString()
  platformFaviconUrl?: string;

  @ApiPropertyOptional({ description: 'Platform primary brand color (hex)' })
  @IsOptional()
  @IsString()
  platformPrimaryColor?: string;

  @ApiPropertyOptional({ description: 'Platform secondary brand color (hex)' })
  @IsOptional()
  @IsString()
  platformSecondaryColor?: string;

  @ApiPropertyOptional({ description: 'Platform accent color (hex)' })
  @IsOptional()
  @IsString()
  platformAccentColor?: string;

  @ApiPropertyOptional({ description: 'Enable maintenance mode' })
  @IsOptional()
  @IsBoolean()
  maintenanceMode?: boolean;

  @ApiPropertyOptional({ description: 'Maintenance mode message shown to users' })
  @IsOptional()
  @IsString()
  maintenanceMessage?: string;

  @ApiPropertyOptional({ description: 'Global email footer for all outbound emails' })
  @IsOptional()
  @IsString()
  emailFooter?: string;

  @ApiPropertyOptional({ description: 'Default timezone for new companies' })
  @IsOptional()
  @IsString()
  defaultTimezone?: string;

  @ApiPropertyOptional({ description: 'Default locale for new companies' })
  @IsOptional()
  @IsString()
  defaultLocale?: string;

  @ApiPropertyOptional({ description: 'Default currency for new companies' })
  @IsOptional()
  @IsString()
  defaultCurrency?: string;
}

export class AuditLogQueryDto {
  @IsOptional()
  page?: number = 1;

  @IsOptional()
  limit?: number = 50;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @IsString()
  companyId?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  entityType?: string;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  get skip(): number {
    return (Math.max(1, this.page ?? 1) - 1) * (this.limit ?? 50);
  }
}
