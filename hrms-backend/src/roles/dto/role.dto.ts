import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsOptional, IsString, IsUUID, Matches } from 'class-validator';

export class CreateRoleDto {
  @ApiProperty({ example: 'Regional HR Lead' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'regional-hr-lead' })
  @IsString()
  @Matches(/^[a-z0-9-]+$/, { message: 'Slug may only contain lowercase letters, numbers, hyphens.' })
  slug: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ type: [String], example: ['employee.read', 'leave.approve'] })
  @IsOptional()
  @IsArray()
  permissionCodes?: string[];
}

export class AssignPermissionsDto {
  @ApiProperty({ type: [String], example: ['employee.read', 'employee.update'] })
  @IsArray()
  @ArrayNotEmpty()
  permissionCodes: string[];
}

export class AssignRoleToUserDto {
  @ApiProperty()
  @IsUUID()
  userId: string;

  @ApiProperty()
  @IsUUID()
  roleId: string;
}
