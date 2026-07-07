import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateEmployeeDto } from './create-employee.dto';

// createLoginAccount / roleSlug are one-time creation flags, not editable fields.
export class UpdateEmployeeDto extends PartialType(
  OmitType(CreateEmployeeDto, ['createLoginAccount', 'roleSlug'] as const),
) {}
