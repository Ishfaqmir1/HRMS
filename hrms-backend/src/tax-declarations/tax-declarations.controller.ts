import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TaxDeclarationsService } from './tax-declarations.service';
import { CreateTaxDeclarationDto, UpdateTaxDeclarationDto } from './dto/tax-declarations.dto';
import { TenantId } from '../common/decorators/tenant.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';

@ApiTags('Tax Declarations')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller('tax-declarations')
export class TaxDeclarationsController {
  constructor(private readonly taxDeclarationsService: TaxDeclarationsService) {}

  @Post()
  create(
    @TenantId() companyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTaxDeclarationDto,
  ) {
    this.assertHasEmployeeProfile(user);
    return this.taxDeclarationsService.create(companyId, user.employeeId!, dto);
  }

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    this.assertHasEmployeeProfile(user);
    return this.taxDeclarationsService.findAll(user.employeeId!);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    this.assertHasEmployeeProfile(user);
    return this.taxDeclarationsService.findOne(user.employeeId!, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateTaxDeclarationDto,
  ) {
    this.assertHasEmployeeProfile(user);
    return this.taxDeclarationsService.update(user.employeeId!, id, dto);
  }

  @Post(':financialYear/submit')
  submit(
    @TenantId() companyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('financialYear') financialYear: string,
  ) {
    this.assertHasEmployeeProfile(user);
    return this.taxDeclarationsService.submit(companyId, user.employeeId!, financialYear);
  }

  private assertHasEmployeeProfile(user: AuthenticatedUser) {
    if (!user.employeeId) {
      throw new ForbiddenException('This account is not linked to an employee profile.');
    }
  }
}
