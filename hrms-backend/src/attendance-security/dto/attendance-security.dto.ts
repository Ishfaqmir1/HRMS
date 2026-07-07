import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

// ================================================================
// Company Security Configuration
// ================================================================

export class UpdateSecurityConfigDto {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() requireTrustedDevice?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(1) @Max(10) maxTrustedDevices?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() requireWifiVerification?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() requireIpValidation?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() requireQrScan?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(15) @Max(300) qrCodeRefreshSeconds?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() requireFaceVerification?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(1) faceMatchThreshold?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() requireLivenessCheck?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() enforceDeviceBinding?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(1) @Max(10) allowedDevicesPerEmployee?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() checkLocationIntegrity?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() detectVpn?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() detectNetworkChange?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() captureAttendancePhoto?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() strictMode?: boolean;
}

// ================================================================
// Device Registration & Management
// ================================================================

export class RegisterDeviceDto {
  @ApiProperty({ description: 'Unique device identifier (fingerprint)' })
  @IsString()
  deviceId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deviceName?: string;

  @ApiPropertyOptional({ description: 'ios, android, web, windows, macos, linux' })
  @IsOptional()
  @IsString()
  platform?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  osVersion?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  browserInfo?: string;
}

export class VerifyDeviceDto {
  @ApiProperty()
  @IsString()
  deviceId: string;

  @ApiProperty()
  @IsString()
  verificationCode: string;
}

export class TrustDeviceDto {
  @ApiProperty()
  @IsString()
  deviceId: string;
}

// ================================================================
// QR Code
// ================================================================

export class GenerateQrCodeDto {
  @ApiPropertyOptional({ description: 'Expiry in seconds (default 45)' })
  @IsOptional()
  @IsNumber()
  @Min(10)
  @Max(300)
  expiresInSeconds?: number;
}

export class VerifyQrCodeDto {
  @ApiProperty()
  @IsString()
  code: string;
}

// ================================================================
// Face Enrollment & Verification
// ================================================================

export class EnrollFaceDto {
  @ApiProperty({ description: 'Face encoding vector as array of numbers' })
  @IsArray()
  @IsNumber({}, { each: true })
  faceEncoding: number[];

  @ApiPropertyOptional({ description: 'URL of enrollment image' })
  @IsOptional()
  @IsString()
  imageUrl?: string;
}

export class VerifyFaceDto {
  @ApiProperty({ description: 'Face encoding vector captured during attendance' })
  @IsArray()
  @IsNumber({}, { each: true })
  faceEncoding: number[];

  @ApiPropertyOptional({ description: 'Score threshold (0-1), defaults to company config' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  threshold?: number;

  @ApiPropertyOptional({ description: 'Liveness check result' })
  @IsOptional()
  @IsObject()
  livenessResult?: { passed: boolean; score?: number; method?: string };
}

// ================================================================
// Wi-Fi Networks (per branch)
// ================================================================

export class AddWifiNetworkDto {
  @ApiProperty()
  @IsString()
  ssid: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bssid?: string;
}

// ================================================================
// IP Allowlist (per branch)
// ================================================================

export class AddIpAllowlistDto {
  @ApiProperty()
  @IsString()
  ipAddress: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}

// ================================================================
// Attendance Verification (submitted during clock-in/out)
// ================================================================

export class AttendanceSecurityVerificationDto {
  @ApiPropertyOptional({ description: 'Device ID (Layer 2 & 10)' })
  @IsOptional()
  @IsString()
  deviceId?: string;

  @ApiPropertyOptional({ description: 'Device name' })
  @IsOptional()
  @IsString()
  deviceName?: string;

  @ApiPropertyOptional({ description: 'Browser/platform info (Layer 2)' })
  @IsOptional()
  @IsString()
  browserInfo?: string;

  @ApiPropertyOptional({ description: 'Connected Wi-Fi SSID (Layer 5)' })
  @IsOptional()
  @IsString()
  wifiSsid?: string;

  @ApiPropertyOptional({ description: 'Connected Wi-Fi BSSID / MAC (Layer 5)' })
  @IsOptional()
  @IsString()
  wifiBssid?: string;

  @ApiPropertyOptional({ description: 'Public IP address (Layer 6)' })
  @IsOptional()
  @IsString()
  ipAddress?: string;

  @ApiPropertyOptional({ description: 'QR code token (Layer 7)' })
  @IsOptional()
  @IsString()
  qrCode?: string;

  @ApiPropertyOptional({ description: 'Face encoding vector (Layer 8 & 9)' })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  faceEncoding?: number[];

  @ApiPropertyOptional({ description: 'Liveness check result (Layer 9)' })
  @IsOptional()
  @IsObject()
  livenessResult?: { passed: boolean; score?: number; method?: string };

  @ApiPropertyOptional({ description: 'GPS accuracy in meters (Layer 11)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  locationAccuracy?: number;

  @ApiPropertyOptional({ description: 'Whether VPN is detected (Layer 12)' })
  @IsOptional()
  @IsBoolean()
  vpnDetected?: boolean;

  @ApiPropertyOptional({ description: 'Network change detected during session (Layer 13)' })
  @IsOptional()
  @IsBoolean()
  networkChanged?: boolean;

  @ApiPropertyOptional({ description: 'Attendance selfie image URL (Layer 15)' })
  @IsOptional()
  @IsString()
  photoUrl?: string;
}

// ================================================================
// Audit & Logs
// ================================================================

export class SecurityLogQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  employeeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  action?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  to?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  page?: number = 1;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  limit?: number = 20;
}
