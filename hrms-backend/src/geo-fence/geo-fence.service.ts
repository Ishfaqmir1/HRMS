import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface GeoCoordinates {
  latitude: number;
  longitude: number;
}

export interface GeoFenceResult {
  withinFence: boolean;
  distanceMeters: number;
  branchName?: string;
  fenceRadiusMeters?: number;
}

@Injectable()
export class GeoFenceService {
  private readonly logger = new Logger(GeoFenceService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Haversine formula — calculates the great-circle distance between two
   * points on the Earth's surface. Returns distance in meters.
   */
  calculateDistance(origin: GeoCoordinates, destination: GeoCoordinates): number {
    const EARTH_RADIUS_M = 6_371_000; // Earth's mean radius in meters

    const toRad = (deg: number) => (deg * Math.PI) / 180;

    const dLat = toRad(destination.latitude - origin.latitude);
    const dLon = toRad(destination.longitude - origin.longitude);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(origin.latitude)) *
        Math.cos(toRad(destination.latitude)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return EARTH_RADIUS_M * c;
  }

  /**
   * Validates whether the given coordinates are within the geo-fence of
   * the employee's assigned branch. If no fence is configured, returns
   * a pass-through result (withinFence = true).
   */
  async validateAttendanceLocation(
    companyId: string,
    employeeId: string,
    coordinates: GeoCoordinates,
  ): Promise<GeoFenceResult> {
    // Get the employee's assigned branch with geo-fence data
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, companyId },
      include: {
        branch: {
          select: {
            id: true,
            name: true,
            latitude: true,
            longitude: true,
            geoFenceRadiusMeters: true,
          },
        },
      },
    });

    // No employee or no branch assigned — can't validate
    if (!employee?.branch) {
      return { withinFence: true, distanceMeters: 0 };
    }

    const branch = employee.branch;

    // No geo-fence configured for this branch — pass through
    if (branch.latitude == null || branch.longitude == null || branch.geoFenceRadiusMeters == null) {
      return { withinFence: true, distanceMeters: 0 };
    }

    const distance = this.calculateDistance(coordinates, {
      latitude: branch.latitude,
      longitude: branch.longitude,
    });

    const withinFence = distance <= branch.geoFenceRadiusMeters;

    if (!withinFence) {
      this.logger.warn(
        `Employee ${employeeId} attempted clock-in ${Math.round(distance)}m from branch "${branch.name}" ` +
        `(fence: ${branch.geoFenceRadiusMeters}m)`,
      );
    }

    return {
      withinFence,
      distanceMeters: Math.round(distance),
      branchName: branch.name,
      fenceRadiusMeters: branch.geoFenceRadiusMeters,
    };
  }
}
