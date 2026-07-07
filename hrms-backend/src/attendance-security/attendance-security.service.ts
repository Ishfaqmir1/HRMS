import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GeoFenceService } from '../geo-fence/geo-fence.service';
import * as crypto from 'crypto';
import {
  UpdateSecurityConfigDto,
  RegisterDeviceDto,
  VerifyQrCodeDto,
  EnrollFaceDto,
  VerifyFaceDto,
  AddWifiNetworkDto,
  AddIpAllowlistDto,
  AttendanceSecurityVerificationDto,
  SecurityLogQueryDto,
} from './dto/attendance-security.dto';

export interface SecurityLayerResult {
  layer: number;
  name: string;
  passed: boolean;
  required: boolean;
  details?: Record<string, any>;
  failureReason?: string;
}

export interface SecurityVerificationResult {
  allowed: boolean;
  strictMode: boolean;
  layers: SecurityLayerResult[];
  summary: string;
}

@Injectable()
export class AttendanceSecurityService {
  private readonly logger = new Logger(AttendanceSecurityService.name);

  constructor(
    private prisma: PrismaService,
    private geoFenceService: GeoFenceService,
  ) {}

  // ==================================================================
  // Layer 2: Trusted Devices — Register, verify, manage trusted devices
  // ==================================================================

  async registerDevice(companyId: string, employeeId: string, dto: RegisterDeviceDto) {
    const config = await this.getOrCreateConfig(companyId);

    // Check device limit
    if (config.enforceDeviceBinding) {
      const activeCount = await this.prisma.trustedDevice.count({
        where: { companyId, employeeId, isActive: true },
      });
      if (activeCount >= config.allowedDevicesPerEmployee) {
        throw new BadRequestException(
          `Device limit reached (max ${config.allowedDevicesPerEmployee}). Deactivate an existing device first.`,
        );
      }
    }

    // Check for existing device with same ID
    const existing = await this.prisma.trustedDevice.findUnique({
      where: { companyId_employeeId_deviceId: { companyId, employeeId, deviceId: dto.deviceId } },
    });

    if (existing) {
      if (!existing.isActive) {
        return this.prisma.trustedDevice.update({
          where: { id: existing.id },
          data: { isActive: true, deviceName: dto.deviceName ?? existing.deviceName ?? '', browserInfo: dto.browserInfo ?? null },
        });
      }
      return existing;
    }

    const device = await this.prisma.trustedDevice.create({
      data: {
        companyId,
        employeeId,
        deviceId: dto.deviceId,
        deviceName: dto.deviceName ?? null,
        platform: dto.platform ?? null,
        osVersion: dto.osVersion ?? null,
        browserInfo: dto.browserInfo ?? null,
      },
    });

    await this.logSecurityEvent(companyId, employeeId, {
      action: 'DEVICE_REGISTERED',
      status: 'ALLOWED',
      deviceId: dto.deviceId,
      deviceName: dto.deviceName ?? null,
      metadata: { platform: dto.platform ?? null, osVersion: dto.osVersion ?? null },
    });

    return device;
  }

  async getMyDevices(companyId: string, employeeId: string) {
    return this.prisma.trustedDevice.findMany({
      where: { companyId, employeeId, isActive: true },
      orderBy: { lastUsedAt: 'desc' },
    });
  }

  async getEmployeeDevices(companyId: string, employeeId: string) {
    return this.prisma.trustedDevice.findMany({
      where: { companyId, employeeId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async trustDevice(companyId: string, employeeId: string, deviceId: string) {
    const device = await this.prisma.trustedDevice.findUnique({
      where: { companyId_employeeId_deviceId: { companyId, employeeId, deviceId } },
    });
    if (!device) throw new NotFoundException('Device not found.');

    return this.prisma.trustedDevice.update({
      where: { id: device.id },
      data: { isTrusted: true, verifiedAt: new Date() },
    });
  }

  async removeDevice(companyId: string, employeeId: string, deviceId: string) {
    const device = await this.prisma.trustedDevice.findUnique({
      where: { companyId_employeeId_deviceId: { companyId, employeeId, deviceId } },
    });
    if (!device) throw new NotFoundException('Device not found.');

    await this.prisma.trustedDevice.update({
      where: { id: device.id },
      data: { isActive: false, isTrusted: false },
    });

    await this.logSecurityEvent(companyId, employeeId, {
      action: 'DEVICE_REMOVED',
      status: 'ALLOWED',
      deviceId,
      deviceName: device.deviceName,
    });

    return { message: 'Device deactivated.' };
  }

  // ==================================================================
  // Layer 7: QR Code — Generate & verify dynamic QR codes
  // ==================================================================

  async generateQrCode(companyId: string, employeeId: string, expiresInSeconds = 45) {
    const config = await this.getOrCreateConfig(companyId);

    // Invalidate any existing unused codes
    await this.prisma.qRCodeSession.updateMany({
      where: { companyId, employeeId, isUsed: false, expiresAt: { gt: new Date() } },
      data: { isUsed: true, usedAt: new Date() },
    });

    const code = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + (expiresInSeconds || config.qrCodeRefreshSeconds) * 1000);

    const session = await this.prisma.qRCodeSession.create({
      data: { companyId, employeeId, code, expiresAt },
    });

    return { qrCode: session.code, expiresAt: session.expiresAt, expiresInSeconds: expiresInSeconds || config.qrCodeRefreshSeconds };
  }

  async verifyQrCode(companyId: string, employeeId: string, dto: VerifyQrCodeDto) {
    const session = await this.prisma.qRCodeSession.findUnique({
      where: { code: dto.code },
    });

    if (!session) {
      await this.logSecurityEvent(companyId, employeeId, {
        action: 'QR_SCAN',
        status: 'DENIED',
        metadata: { reason: 'Invalid QR code' },
      });
      return { valid: false, reason: 'Invalid QR code.' };
    }

    if (session.employeeId !== employeeId || session.companyId !== companyId) {
      return { valid: false, reason: 'QR code does not belong to you.' };
    }

    if (session.isUsed) {
      return { valid: false, reason: 'QR code has already been used.' };
    }

    if (session.expiresAt < new Date()) {
      return { valid: false, reason: 'QR code has expired. Please generate a new one.' };
    }

    await this.prisma.qRCodeSession.update({
      where: { id: session.id },
      data: { isUsed: true, usedAt: new Date() },
    });

    await this.logSecurityEvent(companyId, employeeId, {
      action: 'QR_SCAN',
      status: 'ALLOWED',
      metadata: { qrSessionId: session.id },
    });

    return { valid: true };
  }

  // ==================================================================
  // Layer 8: Face Enrollment & Verification
  // ==================================================================

  async enrollFace(companyId: string, employeeId: string, dto: EnrollFaceDto) {
    const existing = await this.prisma.faceEnrollment.findUnique({
      where: { companyId_employeeId: { companyId, employeeId } },
    });

    if (existing) {
      return this.prisma.faceEnrollment.update({
        where: { id: existing.id },
        data: { faceEncoding: dto.faceEncoding, imageUrl: dto.imageUrl, isActive: true },
      });
    }

    const enrollment = await this.prisma.faceEnrollment.create({
      data: { companyId, employeeId, faceEncoding: dto.faceEncoding, imageUrl: dto.imageUrl },
    });

    await this.logSecurityEvent(companyId, employeeId, {
      action: 'FACE_ENROLLED',
      status: 'ALLOWED',
    });

    return enrollment;
  }

  async getFaceEnrollment(companyId: string, employeeId: string) {
    return this.prisma.faceEnrollment.findUnique({
      where: { companyId_employeeId: { companyId, employeeId } },
    });
  }

  async verifyFace(companyId: string, employeeId: string, dto: VerifyFaceDto) {
    const config = await this.getOrCreateConfig(companyId);
    const enrollment = await this.prisma.faceEnrollment.findUnique({
      where: { companyId_employeeId: { companyId, employeeId } },
    });

    if (!enrollment?.faceEncoding) {
      return { matched: false, score: 0, reason: 'No face enrollment found.' };
    }

    const threshold = dto.threshold ?? config.faceMatchThreshold;
    const enrolledVector = enrollment.faceEncoding as number[];
    const capturedVector = dto.faceEncoding;

    if (!capturedVector || capturedVector.length === 0) {
      return { matched: false, score: 0, reason: 'No face data provided for verification.' };
    }

    // Cosine similarity between face vectors
    const similarity = this.cosineSimilarity(enrolledVector, capturedVector);
    const matched = similarity >= threshold;

    this.logger.log(`Face verification for ${employeeId}: similarity=${similarity.toFixed(4)}, threshold=${threshold}, matched=${matched}`);

    // Liveness check (Layer 9)
    let livenessPassed = true;
    if (config.requireLivenessCheck && dto.livenessResult) {
      livenessPassed = dto.livenessResult.passed;
      if (!livenessPassed) {
        this.logger.warn(`Liveness check failed for employee ${employeeId}: method=${dto.livenessResult.method}`);
      }
    }

    await this.logSecurityEvent(companyId, employeeId, {
      action: 'FACE_VERIFY',
      status: matched && livenessPassed ? 'ALLOWED' : 'DENIED',
      metadata: { similarity, threshold, matched, livenessPassed, livenessMethod: dto.livenessResult?.method },
    });

    return {
      matched: matched && livenessPassed,
      score: similarity,
      livenessPassed,
      reason: matched && livenessPassed ? undefined : 'Face verification failed.',
    };
  }

  async removeFaceEnrollment(companyId: string, employeeId: string) {
    const enrollment = await this.prisma.faceEnrollment.findUnique({
      where: { companyId_employeeId: { companyId, employeeId } },
    });
    if (!enrollment) throw new NotFoundException('No face enrollment found.');

    await this.prisma.faceEnrollment.update({
      where: { id: enrollment.id },
      data: { isActive: false },
    });

    return { message: 'Face enrollment removed.' };
  }

  // ==================================================================
  // Wi-Fi Networks (per branch)
  // ==================================================================

  async getWifiNetworks(companyId: string, branchId: string) {
    return this.prisma.branchWifiNetwork.findMany({
      where: { branchId, branch: { companyId }, isActive: true },
    });
  }

  async addWifiNetwork(companyId: string, branchId: string, dto: AddWifiNetworkDto) {
    const branch = await this.prisma.branch.findFirst({ where: { id: branchId, companyId } });
    if (!branch) throw new NotFoundException('Branch not found.');

    return this.prisma.branchWifiNetwork.create({
      data: { branchId, ssid: dto.ssid, bssid: dto.bssid },
    });
  }

  async removeWifiNetwork(companyId: string, wifiNetworkId: string) {
    const network = await this.prisma.branchWifiNetwork.findFirst({
      where: { id: wifiNetworkId, branch: { companyId } },
    });
    if (!network) throw new NotFoundException('Wi-Fi network not found.');

    await this.prisma.branchWifiNetwork.update({
      where: { id: wifiNetworkId },
      data: { isActive: false },
    });

    return { message: 'Wi-Fi network removed.' };
  }

  // ==================================================================
  // IP Allowlist (per branch)
  // ==================================================================

  async getIpAllowlist(companyId: string, branchId: string) {
    return this.prisma.branchIpAllowlist.findMany({
      where: { branchId, branch: { companyId }, isActive: true },
    });
  }

  async addIpAllowlist(companyId: string, branchId: string, dto: AddIpAllowlistDto) {
    const branch = await this.prisma.branch.findFirst({ where: { id: branchId, companyId } });
    if (!branch) throw new NotFoundException('Branch not found.');

    return this.prisma.branchIpAllowlist.create({
      data: { branchId, ipAddress: dto.ipAddress, description: dto.description },
    });
  }

  async removeIpAllowlist(companyId: string, ipAllowlistId: string) {
    const entry = await this.prisma.branchIpAllowlist.findFirst({
      where: { id: ipAllowlistId, branch: { companyId } },
    });
    if (!entry) throw new NotFoundException('IP allowlist entry not found.');

    await this.prisma.branchIpAllowlist.update({
      where: { id: ipAllowlistId },
      data: { isActive: false },
    });

    return { message: 'IP allowlist entry removed.' };
  }

  // ==================================================================
  // Security Configuration (per company)
  // ==================================================================

  async getConfig(companyId: string) {
    return this.getOrCreateConfig(companyId);
  }

  async updateConfig(companyId: string, dto: UpdateSecurityConfigDto) {
    const config = await this.getOrCreateConfig(companyId);
    return this.prisma.attendanceSecurityConfig.update({
      where: { id: config.id },
      data: dto as any,
    });
  }

  async getConfigSummary(companyId: string) {
    const config = await this.getOrCreateConfig(companyId);
    const enabledLayers: { layer: number; name: string }[] = [];
    if (config.requireTrustedDevice) enabledLayers.push({ layer: 2, name: 'Trusted Devices' });
    if (config.requireWifiVerification) enabledLayers.push({ layer: 5, name: 'Wi-Fi Verification' });
    if (config.requireIpValidation) enabledLayers.push({ layer: 6, name: 'IP Validation' });
    if (config.requireQrScan) enabledLayers.push({ layer: 7, name: 'QR Code Scan' });
    if (config.requireFaceVerification) enabledLayers.push({ layer: 8, name: 'Face Verification' });
    if (config.requireLivenessCheck) enabledLayers.push({ layer: 9, name: 'Liveness Detection' });
    if (config.enforceDeviceBinding) enabledLayers.push({ layer: 10, name: 'Device Binding' });
    if (config.checkLocationIntegrity) enabledLayers.push({ layer: 11, name: 'Location Integrity' });
    if (config.detectVpn) enabledLayers.push({ layer: 12, name: 'VPN Detection' });
    if (config.detectNetworkChange) enabledLayers.push({ layer: 13, name: 'Network Change Detection' });
    if (config.captureAttendancePhoto) enabledLayers.push({ layer: 15, name: 'Attendance Photo' });

    const activeLayerCount = enabledLayers.length + 3; // Layers 1 (JWT), 3 (GPS), 14 (Server Time) are always active
    const totalLayerCount = 16;

    return {
      config,
      enabledLayers,
      activeLayerCount,
      totalLayerCount,
      securityScore: Math.round((activeLayerCount / totalLayerCount) * 100),
    };
  }

  // ==================================================================
  // Layer 16: Security Logging
  // ==================================================================

  async logSecurityEvent(
    companyId: string,
    employeeId: string,
    data: {
      action: string;
      status: string;
      deviceId?: string | null;
      deviceName?: string | null;
      ipAddress?: string | null;
      userAgent?: string | null;
      latitude?: number;
      longitude?: number;
      accuracy?: number;
      layerResults?: any;
      failureReason?: string;
      metadata?: any;
    },
  ) {
    return this.prisma.attendanceSecurityLog.create({
      data: {
        companyId,
        employeeId,
        action: data.action,
        status: data.status,
        deviceId: data.deviceId,
        deviceName: data.deviceName,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        latitude: data.latitude,
        longitude: data.longitude,
        accuracy: data.accuracy,
        layerResults: data.layerResults,
        failureReason: data.failureReason,
        metadata: data.metadata,
      },
    });
  }

  async getSecurityLogs(companyId: string, query: SecurityLogQueryDto) {
    const where: any = { companyId };
    if (query.employeeId) where.employeeId = query.employeeId;
    if (query.action) where.action = query.action;
    if (query.status) where.status = query.status;
    if (query.from || query.to) {
      where.createdAt = {};
      if (query.from) where.createdAt.gte = new Date(query.from);
      if (query.to) where.createdAt.lte = new Date(query.to);
    }

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.attendanceSecurityLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } } },
      }),
      this.prisma.attendanceSecurityLog.count({ where }),
    ]);

    return {
      items,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ==================================================================
  // THE MASTER VERIFICATION — Runs all enabled security layers
  // ==================================================================

  async verifyAttendanceAction(
    companyId: string,
    employeeId: string,
    action: 'CLOCK_IN' | 'CLOCK_OUT',
    dto: AttendanceSecurityVerificationDto & { lat?: number; lng?: number },
  ): Promise<SecurityVerificationResult> {
    const config = await this.getOrCreateConfig(companyId);
    const layerResults: SecurityLayerResult[] = [];
    let blocked = false;

    // Layer 1: JWT Authentication — already handled by the auth guard
    layerResults.push({ layer: 1, name: 'JWT Authentication', passed: true, required: true });

    // Layer 2: Trusted Device verification
    if (config.requireTrustedDevice && dto.deviceId) {
      const trusted = await this.prisma.trustedDevice.findUnique({
        where: { companyId_employeeId_deviceId: { companyId, employeeId, deviceId: dto.deviceId } },
      });
      const passed = !!trusted?.isTrusted && trusted.isActive;
      layerResults.push({
        layer: 2,
        name: 'Trusted Device',
        passed,
        required: true,
        details: { deviceId: dto.deviceId, deviceName: dto.deviceName, isTrusted: trusted?.isTrusted, isActive: trusted?.isActive },
        failureReason: passed ? undefined : 'Device is not trusted. Register and verify your device first.',
      });
      if (!passed && config.strictMode) blocked = true;

      // Update last used timestamp
      if (trusted) {
        await this.prisma.trustedDevice.update({ where: { id: trusted.id }, data: { lastUsedAt: new Date() } });
      }
    } else if (config.requireTrustedDevice && !dto.deviceId) {
      layerResults.push({
        layer: 2,
        name: 'Trusted Device',
        passed: false,
        required: true,
        failureReason: 'Device ID is required for verification.',
      });
      if (config.strictMode) blocked = true;
    } else {
      layerResults.push({ layer: 2, name: 'Trusted Device', passed: true, required: false });
    }

    // Layer 3: GPS Location — captured in attendance record
    layerResults.push({
      layer: 3,
      name: 'GPS Location',
      passed: true,
      required: false,
      details: dto.lat != null ? { latitude: dto.lat, longitude: dto.lng } : undefined,
    });

    // Layer 4: Geo-fence — handled by GeoFenceService, integrated in AttendanceService

    // Layer 5: Wi-Fi Verification
    if (config.requireWifiVerification && dto.wifiSsid) {
      const employee = await this.prisma.employee.findFirst({
        where: { id: employeeId, companyId },
        include: { branch: { include: { wifiNetworks: { where: { isActive: true } } } } },
      });

      const authorizedNetworks = employee?.branch?.wifiNetworks || [];
      const matched = authorizedNetworks.some(
        (n) => n.ssid === dto.wifiSsid && (!n.bssid || n.bssid === dto.wifiBssid),
      );

      layerResults.push({
        layer: 5,
        name: 'Wi-Fi Verification',
        passed: matched,
        required: true,
        details: { ssid: dto.wifiSsid, bssid: dto.wifiBssid, authorizedCount: authorizedNetworks.length },
        failureReason: matched ? undefined : 'Not connected to an authorized office Wi-Fi network.',
      });
      if (!matched && config.strictMode) blocked = true;
    } else if (config.requireWifiVerification && !dto.wifiSsid) {
      layerResults.push({
        layer: 5,
        name: 'Wi-Fi Verification',
        passed: false,
        required: true,
        failureReason: 'Wi-Fi SSID is required for verification.',
      });
      if (config.strictMode) blocked = true;
    } else {
      layerResults.push({ layer: 5, name: 'Wi-Fi Verification', passed: true, required: false });
    }

    // Layer 6: IP Validation
    if (config.requireIpValidation && dto.ipAddress) {
      const employee = await this.prisma.employee.findFirst({
        where: { id: employeeId, companyId },
        include: { branch: { include: { ipAllowlists: { where: { isActive: true } } } } },
      });

      const allowedIps = employee?.branch?.ipAllowlists || [];
      const matched = allowedIps.some((entry) => entry.ipAddress === dto.ipAddress);

      layerResults.push({
        layer: 6,
        name: 'IP Validation',
        passed: matched,
        required: true,
        details: { ipAddress: dto.ipAddress, allowedCount: allowedIps.length },
        failureReason: matched ? undefined : 'IP address not in the authorized allowlist.',
      });
      if (!matched && config.strictMode) blocked = true;
    } else if (config.requireIpValidation && !dto.ipAddress) {
      layerResults.push({
        layer: 6,
        name: 'IP Validation',
        passed: false,
        required: true,
        failureReason: 'IP address is required for verification.',
      });
      if (config.strictMode) blocked = true;
    } else {
      layerResults.push({ layer: 6, name: 'IP Validation', passed: true, required: false });
    }

    // Layer 7: QR Code Verification
    if (config.requireQrScan && dto.qrCode) {
      const qrResult = await this.verifyQrCode(companyId, employeeId, { code: dto.qrCode });
      layerResults.push({
        layer: 7,
        name: 'QR Code Scan',
        passed: qrResult.valid,
        required: true,
        failureReason: qrResult.valid ? undefined : qrResult.reason,
      });
      if (!qrResult.valid && config.strictMode) blocked = true;
    } else if (config.requireQrScan && !dto.qrCode) {
      layerResults.push({
        layer: 7,
        name: 'QR Code Scan',
        passed: false,
        required: true,
        failureReason: 'QR code is required for verification.',
      });
      if (config.strictMode) blocked = true;
    } else {
      layerResults.push({ layer: 7, name: 'QR Code Scan', passed: true, required: false });
    }

    // Layer 8: Face Verification + Layer 9: Liveness Detection
    if (config.requireFaceVerification && dto.faceEncoding && dto.faceEncoding.length > 0) {
      const faceResult = await this.verifyFace(companyId, employeeId, {
        faceEncoding: dto.faceEncoding,
        threshold: config.faceMatchThreshold,
        livenessResult: dto.livenessResult,
      });

      layerResults.push({
        layer: 8,
        name: 'Face Verification',
        passed: faceResult.matched,
        required: true,
        details: { score: faceResult.score },
        failureReason: faceResult.matched ? undefined : faceResult.reason,
      });
      if (!faceResult.matched && config.strictMode) blocked = true;

      layerResults.push({
        layer: 9,
        name: 'Liveness Detection',
        passed: Boolean(faceResult.livenessPassed),
        required: true,
        details: { method: dto.livenessResult?.method },
        failureReason: faceResult.livenessPassed ? undefined : 'Liveness check failed. Please try again.',
      });
      if (!faceResult.livenessPassed && config.requireLivenessCheck && config.strictMode) blocked = true;
    } else if (config.requireFaceVerification && (!dto.faceEncoding || dto.faceEncoding.length === 0)) {
      layerResults.push({
        layer: 8,
        name: 'Face Verification',
        passed: false,
        required: true,
        failureReason: 'Face data is required for verification.',
      });
      if (config.strictMode) blocked = true;
    } else {
      layerResults.push({ layer: 8, name: 'Face Verification', passed: true, required: false });
      layerResults.push({ layer: 9, name: 'Liveness Detection', passed: true, required: false });
    }

    // Layer 10: Device Binding
    if (config.enforceDeviceBinding && dto.deviceId) {
      const deviceCount = await this.prisma.trustedDevice.count({
        where: { companyId, employeeId, isActive: true, isTrusted: true },
      });
      const withinLimit = deviceCount <= config.allowedDevicesPerEmployee;
      layerResults.push({
        layer: 10,
        name: 'Device Binding',
        passed: withinLimit,
        required: true,
        details: { activeDevices: deviceCount, maxAllowed: config.allowedDevicesPerEmployee },
        failureReason: withinLimit ? undefined : `Too many active devices (${deviceCount}/${config.allowedDevicesPerEmployee}). Deactivate unused devices.`,
      });
      if (!withinLimit && config.strictMode) blocked = true;
    } else {
      layerResults.push({ layer: 10, name: 'Device Binding', passed: true, required: false });
    }

    // Layer 11: Location Integrity
    if (config.checkLocationIntegrity) {
      const integrityPassed = dto.locationAccuracy == null || dto.locationAccuracy <= 100; // 100m accuracy threshold
      layerResults.push({
        layer: 11,
        name: 'Location Integrity',
        passed: integrityPassed,
        required: true,
        details: { accuracy: dto.locationAccuracy },
        failureReason: integrityPassed ? undefined : 'GPS accuracy is too low. Location may be spoofed.',
      });
      if (!integrityPassed && config.strictMode) blocked = true;
    } else {
      layerResults.push({ layer: 11, name: 'Location Integrity', passed: true, required: false });
    }

    // Layer 12: VPN Detection
    if (config.detectVpn) {
      const noVpn = !dto.vpnDetected;
      layerResults.push({
        layer: 12,
        name: 'VPN Detection',
        passed: noVpn,
        required: true,
        details: { vpnDetected: dto.vpnDetected },
        failureReason: noVpn ? undefined : 'VPN detected. Disable VPN to clock in/out.',
      });
      if (!noVpn && config.strictMode) blocked = true;
    } else {
      layerResults.push({ layer: 12, name: 'VPN Detection', passed: true, required: false });
    }

    // Layer 13: Network Change Detection
    if (config.detectNetworkChange && dto.networkChanged) {
      layerResults.push({
        layer: 13,
        name: 'Network Change Detection',
        passed: false,
        required: true,
        details: { networkChanged: dto.networkChanged },
        failureReason: 'Network changed during verification. Please try again.',
      });
      if (config.strictMode) blocked = true;
    } else {
      layerResults.push({ layer: 13, name: 'Network Change Detection', passed: true, required: false });
    }

    // Layer 14: Time Validation — server-side, always enforced
    layerResults.push({ layer: 14, name: 'Time Validation (Server)', passed: true, required: true });

    // Layer 15: Attendance Photo
    if (config.captureAttendancePhoto && dto.photoUrl) {
      layerResults.push({
        layer: 15,
        name: 'Attendance Photo',
        passed: true,
        required: true,
        details: { photoCaptured: true },
      });
    } else if (config.captureAttendancePhoto && !dto.photoUrl) {
      layerResults.push({
        layer: 15,
        name: 'Attendance Photo',
        passed: false,
        required: true,
        failureReason: 'Attendance photo is required.',
      });
      if (config.strictMode) blocked = true;
    } else {
      layerResults.push({ layer: 15, name: 'Attendance Photo', passed: true, required: false });
    }

    // Layer 16: Audit Log
    const failedLayers = layerResults.filter((l) => !l.passed && l.required);
    const allowed = !blocked;
    const status = allowed ? 'ALLOWED' : 'DENIED';
    const summary = failedLayers.length > 0
      ? `Blocked by ${failedLayers.length} security layer(s): ${failedLayers.map((l) => l.name).join(', ')}`
      : `${action} allowed after passing ${layerResults.filter((l) => l.passed).length}/${layerResults.length} security checks.`;

    // Log the event
    await this.logSecurityEvent(companyId, employeeId, {
      action,
      status,
      deviceId: dto.deviceId,
      deviceName: dto.deviceName,
      ipAddress: dto.ipAddress,
      userAgent: dto.browserInfo,
      latitude: dto.lat,
      longitude: dto.lng,
      accuracy: dto.locationAccuracy,
      layerResults: { layers: layerResults },
      failureReason: failedLayers.length > 0 ? failedLayers.map((l) => `${l.name}: ${l.failureReason}`).join('; ') : undefined,
    });

    return { allowed, strictMode: config.strictMode, layers: layerResults, summary };
  }

  // ==================================================================
  // Helpers
  // ==================================================================

  private async getOrCreateConfig(companyId: string) {
    let config = await this.prisma.attendanceSecurityConfig.findUnique({
      where: { companyId },
    });
    if (!config) {
      config = await this.prisma.attendanceSecurityConfig.create({
        data: { companyId },
      });
    }
    return config;
  }

  /**
   * Cosine similarity between two vectors.
   * Higher = more similar. 1.0 = identical, 0.0 = orthogonal.
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }
}
