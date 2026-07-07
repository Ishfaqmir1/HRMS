import {
  Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AttendanceSecurityService } from './attendance-security.service';
import {
  UpdateSecurityConfigDto,
  RegisterDeviceDto,
  VerifyQrCodeDto,
  EnrollFaceDto,
  VerifyFaceDto,
  AddWifiNetworkDto,
  AddIpAllowlistDto,
  SecurityLogQueryDto,
} from './dto/attendance-security.dto';
import { TenantId } from '../common/decorators/tenant.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';

@ApiTags('Attendance Security')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller('attendance-security')
export class AttendanceSecurityController {
  constructor(private readonly securityService: AttendanceSecurityService) {}

  // ==================================================================
  // Security Configuration (admin)
  // ==================================================================

  @Get('config')
  @Permissions('attendance.approve')
  getConfig(@TenantId() companyId: string) {
    return this.securityService.getConfig(companyId);
  }

  @Get('config/summary')
  @Permissions('attendance.approve')
  getConfigSummary(@TenantId() companyId: string) {
    return this.securityService.getConfigSummary(companyId);
  }

  @Patch('config')
  @Permissions('attendance.approve')
  updateConfig(@TenantId() companyId: string, @Body() dto: UpdateSecurityConfigDto) {
    return this.securityService.updateConfig(companyId, dto);
  }

  // ==================================================================
  // Trusted Devices (employee self-service)
  // ==================================================================

  @Post('devices/register')
  @Permissions('attendance.create')
  registerDevice(
    @TenantId() companyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RegisterDeviceDto,
  ) {
    this.assertHasEmployeeProfile(user);
    return this.securityService.registerDevice(companyId, user.employeeId!, dto);
  }

  @Get('devices')
  @Permissions('attendance.read')
  getMyDevices(@TenantId() companyId: string, @CurrentUser() user: AuthenticatedUser) {
    this.assertHasEmployeeProfile(user);
    return this.securityService.getMyDevices(companyId, user.employeeId!);
  }

  @Post('devices/:deviceId/trust')
  @Permissions('attendance.create')
  trustDevice(
    @TenantId() companyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('deviceId') deviceId: string,
  ) {
    this.assertHasEmployeeProfile(user);
    return this.securityService.trustDevice(companyId, user.employeeId!, deviceId);
  }

  @Delete('devices/:deviceId')
  @Permissions('attendance.create')
  removeDevice(
    @TenantId() companyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('deviceId') deviceId: string,
  ) {
    this.assertHasEmployeeProfile(user);
    return this.securityService.removeDevice(companyId, user.employeeId!, deviceId);
  }

  // Admin: View employee devices

  @Get('employees/:employeeId/devices')
  @Permissions('attendance.approve')
  getEmployeeDevices(
    @TenantId() companyId: string,
    @Param('employeeId') employeeId: string,
  ) {
    return this.securityService.getEmployeeDevices(companyId, employeeId);
  }

  // ==================================================================
  // QR Code
  // ==================================================================

  @Post('qr/generate')
  @Permissions('attendance.create')
  generateQrCode(
    @TenantId() companyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query('expiresIn') expiresIn?: string,
  ) {
    this.assertHasEmployeeProfile(user);
    return this.securityService.generateQrCode(
      companyId,
      user.employeeId!,
      expiresIn ? parseInt(expiresIn, 10) : undefined,
    );
  }

  @Post('qr/verify')
  @Permissions('attendance.create')
  verifyQrCode(
    @TenantId() companyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: VerifyQrCodeDto,
  ) {
    this.assertHasEmployeeProfile(user);
    return this.securityService.verifyQrCode(companyId, user.employeeId!, dto);
  }

  // ==================================================================
  // Face Enrollment & Verification
  // ==================================================================

  @Post('face/enroll')
  @Permissions('attendance.create')
  enrollFace(
    @TenantId() companyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: EnrollFaceDto,
  ) {
    this.assertHasEmployeeProfile(user);
    return this.securityService.enrollFace(companyId, user.employeeId!, dto);
  }

  @Get('face/enrollment')
  @Permissions('attendance.read')
  getFaceEnrollment(@TenantId() companyId: string, @CurrentUser() user: AuthenticatedUser) {
    this.assertHasEmployeeProfile(user);
    return this.securityService.getFaceEnrollment(companyId, user.employeeId!);
  }

  @Post('face/verify')
  @Permissions('attendance.create')
  verifyFace(
    @TenantId() companyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: VerifyFaceDto,
  ) {
    this.assertHasEmployeeProfile(user);
    return this.securityService.verifyFace(companyId, user.employeeId!, dto);
  }

  @Delete('face/enrollment')
  @Permissions('attendance.create')
  removeFaceEnrollment(@TenantId() companyId: string, @CurrentUser() user: AuthenticatedUser) {
    this.assertHasEmployeeProfile(user);
    return this.securityService.removeFaceEnrollment(companyId, user.employeeId!);
  }

  // ==================================================================
  // Branch Wi-Fi Networks (admin)
  // ==================================================================

  @Get('branches/:branchId/wifi')
  @Permissions('attendance.approve')
  getWifiNetworks(@TenantId() companyId: string, @Param('branchId') branchId: string) {
    return this.securityService.getWifiNetworks(companyId, branchId);
  }

  @Post('branches/:branchId/wifi')
  @Permissions('attendance.approve')
  addWifiNetwork(
    @TenantId() companyId: string,
    @Param('branchId') branchId: string,
    @Body() dto: AddWifiNetworkDto,
  ) {
    return this.securityService.addWifiNetwork(companyId, branchId, dto);
  }

  @Delete('wifi/:wifiId')
  @Permissions('attendance.approve')
  removeWifiNetwork(@TenantId() companyId: string, @Param('wifiId') wifiId: string) {
    return this.securityService.removeWifiNetwork(companyId, wifiId);
  }

  // ==================================================================
  // Branch IP Allowlist (admin)
  // ==================================================================

  @Get('branches/:branchId/ip-allowlist')
  @Permissions('attendance.approve')
  getIpAllowlist(@TenantId() companyId: string, @Param('branchId') branchId: string) {
    return this.securityService.getIpAllowlist(companyId, branchId);
  }

  @Post('branches/:branchId/ip-allowlist')
  @Permissions('attendance.approve')
  addIpAllowlist(
    @TenantId() companyId: string,
    @Param('branchId') branchId: string,
    @Body() dto: AddIpAllowlistDto,
  ) {
    return this.securityService.addIpAllowlist(companyId, branchId, dto);
  }

  @Delete('ip-allowlist/:entryId')
  @Permissions('attendance.approve')
  removeIpAllowlist(@TenantId() companyId: string, @Param('entryId') entryId: string) {
    return this.securityService.removeIpAllowlist(companyId, entryId);
  }

  // ==================================================================
  // Security Audit Logs (admin)
  // ==================================================================

  @Get('logs')
  @Permissions('attendance.approve')
  getSecurityLogs(@TenantId() companyId: string, @Query() query: SecurityLogQueryDto) {
    return this.securityService.getSecurityLogs(companyId, query);
  }

  // ==================================================================
  // Master security verification (used internally by clock-in/out)
  // ==================================================================

  @Post('verify/:action')
  @Permissions('attendance.create')
  verifyAttendanceAction(
    @TenantId() companyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('action') action: 'CLOCK_IN' | 'CLOCK_OUT',
    @Body() dto: any,
  ) {
    this.assertHasEmployeeProfile(user);
    return this.securityService.verifyAttendanceAction(companyId, user.employeeId!, action, dto);
  }

  // ==================================================================
  // Helper
  // ==================================================================

  private assertHasEmployeeProfile(user: AuthenticatedUser) {
    if (!user.employeeId) {
      throw new ForbiddenException('This account is not linked to an employee profile.');
    }
  }
}
