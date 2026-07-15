import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdatePlatformSettingsDto } from './dto/admin-settings.dto';

@Injectable()
export class AdminSettingsService {
  private readonly logger = new Logger(AdminSettingsService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Get platform-wide settings. Creates the singleton row if it doesn't exist.
   */
  async getSettings() {
    let settings = await this.prisma.platformSettings.findFirst();
    if (!settings) {
      settings = await this.prisma.platformSettings.create({ data: {} });
    }
    return settings;
  }

  /**
   * Update platform-wide settings.
   */
  async updateSettings(dto: UpdatePlatformSettingsDto) {
    const current = await this.getSettings();
    const updated = await this.prisma.platformSettings.update({
      where: { id: current.id },
      data: dto,
    });
    this.logger.log(`Platform settings updated: ${JSON.stringify(dto)}`);
    return updated;
  }

  /**
   * Toggle maintenance mode on/off.
   */
  async toggleMaintenance(enabled: boolean, message?: string) {
    const current = await this.getSettings();
    const updated = await this.prisma.platformSettings.update({
      where: { id: current.id },
      data: {
        maintenanceMode: enabled,
        ...(message !== undefined ? { maintenanceMessage: message } : {}),
      },
    });
    this.logger.log(`Maintenance mode ${enabled ? 'enabled' : 'disabled'}`);
    return updated;
  }
}
