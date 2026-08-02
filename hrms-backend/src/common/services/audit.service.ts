import { Injectable } from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../decorators/current-user.decorator';

export interface AuditEntry {
  action: string;
  entityType: string;
  entityId: string;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Log an audit entry with full context.
   *
   * ```ts
   * await this.auditService.log(user, {
   *   action: 'EMPLOYEE_CREATED',
   *   entityType: 'Employee',
   *   entityId: employee.id,
   *   newValue: { firstName, lastName, departmentId },
   *   ipAddress: req.ip,
   *   userAgent: req.headers['user-agent'],
   * });
   * ```
   */
  async log(
    user: AuthenticatedUser | { userId: string; companyId: string | null; email?: string },
    entry: AuditEntry,
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        companyId: user.companyId,
        userId: user.userId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        metadata: {
        old: entry.oldValue ?? null,
        new: entry.newValue ?? null,
        ...(entry.metadata || {}),
      } as any,
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
      },
    });
  }

  /**
   * Log an action with before/after values (for update operations).
   */
  async logUpdate(
    user: AuthenticatedUser | { userId: string; companyId: string | null },
    entityType: string,
    entityId: string,
    oldValue: Record<string, unknown>,
    newValue: Record<string, unknown>,
    req?: Request,
  ): Promise<void> {
    await this.log(user, {
      action: `${entityType.toUpperCase()}_UPDATED`,
      entityType,
      entityId,
      oldValue,
      newValue,
      ipAddress: req?.ip,
      userAgent: req?.headers?.['user-agent'],
    });
  }

  /**
   * Log a creation action.
   */
  async logCreate(
    user: AuthenticatedUser | { userId: string; companyId: string | null },
    entityType: string,
    entityId: string,
    value: Record<string, unknown>,
    req?: Request,
  ): Promise<void> {
    await this.log(user, {
      action: `${entityType.toUpperCase()}_CREATED`,
      entityType,
      entityId,
      newValue: value,
      ipAddress: req?.ip,
      userAgent: req?.headers?.['user-agent'],
    });
  }

  /**
   * Log a deletion action.
   */
  async logDelete(
    user: AuthenticatedUser | { userId: string; companyId: string | null },
    entityType: string,
    entityId: string,
    oldValue?: Record<string, unknown>,
    req?: Request,
  ): Promise<void> {
    await this.log(user, {
      action: `${entityType.toUpperCase()}_DELETED`,
      entityType,
      entityId,
      oldValue,
      ipAddress: req?.ip,
      userAgent: req?.headers?.['user-agent'],
    });
  }

  /**
   * Log a custom action with arbitrary metadata.
   */
  async logCustom(
    user: AuthenticatedUser | { userId: string; companyId: string | null },
    action: string,
    entityType: string,
    entityId: string,
    metadata?: Record<string, unknown>,
    req?: Request,
  ): Promise<void> {
    await this.log(user, {
      action,
      entityType,
      entityId,
      metadata,
      ipAddress: req?.ip,
      userAgent: req?.headers?.['user-agent'],
    });
  }
}
