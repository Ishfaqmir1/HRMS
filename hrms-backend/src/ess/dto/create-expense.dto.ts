import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

/** Employee submits an expense / reimbursement request. */
export class CreateExpenseDto {
  @ApiProperty({ description: 'Reimbursement category ID' })
  @IsUUID()
  categoryId: string;

  @ApiProperty({ example: 2500 })
  @IsNumber()
  @Min(1)
  amount: number;

  @ApiPropertyOptional({ example: 'Team lunch with clients' })
  @IsOptional()
  @IsString()
  description?: string;
}
