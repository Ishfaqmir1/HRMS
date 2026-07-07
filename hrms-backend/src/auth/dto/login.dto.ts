import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'jane.doe@acme.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'StrongPass123!' })
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiProperty({
    example: 'acme-corp',
    required: false,
    description:
      'Tenant (company) slug. Optional for platform Super Admin login; required for all tenant users since email is only unique per-company.',
  })
  @IsOptional()
  @IsString()
  companySlug?: string;
}
