import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString } from 'class-validator';

// Employees may only self-edit contact details — organizational fields
// (department, designation, manager, etc.) remain HR-controlled.
export class UpdateMyProfileDto {
  @ApiPropertyOptional() @IsOptional() @IsEmail() personalEmail?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
}
