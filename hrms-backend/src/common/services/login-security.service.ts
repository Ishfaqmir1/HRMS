import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisCacheService } from '../../redis/redis-cache.service';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;
const FAILED_PREFIX = 'login:failed:';
const LOCKOUT_PREFIX = 'login:lockout:';

@Injectable()
export class LoginSecurityService {
  private readonly logger = new Logger(LoginSecurityService.name);
  private readonly maxAttempts: number;
  private readonly lockoutMinutes: number;

  constructor(
    private readonly cache: RedisCacheService,
    private readonly configService: ConfigService,
  ) {
    this.maxAttempts =
      this.configService.get<number>('loginSecurity.maxFailedAttempts') ?? MAX_FAILED_ATTEMPTS;
    this.lockoutMinutes =
      this.configService.get<number>('loginSecurity.lockoutDurationMinutes') ?? LOCKOUT_DURATION_MINUTES;
  }

  /**
   * Check if an account is currently locked due to too many failed attempts.
   */
  async isLocked(email: string): Promise<boolean> {
    const lockoutKey = `${LOCKOUT_PREFIX}${email.toLowerCase()}`;
    const locked = await this.cache.get(lockoutKey);
    return !!locked;
  }

  /**
   * Get remaining lockout time in minutes.
   */
  async getRemainingLockoutMinutes(email: string): Promise<number> {
    const lockoutKey = `${LOCKOUT_PREFIX}${email.toLowerCase()}`;
    const ttl = await this.cache.getTtl(lockoutKey);
    return Math.ceil(ttl / 60);
  }

  /**
   * Record a failed login attempt. If the maxAttempts threshold is reached,
   * lock the account temporarily.
   *
   * Returns the number of remaining attempts before lockout.
   */
  async recordFailedAttempt(email: string): Promise<{ remainingAttempts: number; locked: boolean }> {
    const normalizedEmail = email.toLowerCase();
    const failedKey = `${FAILED_PREFIX}${normalizedEmail}`;

    const currentAttempts = (await this.cache.get<number>(failedKey)) || 0;
    const newAttempts = currentAttempts + 1;

    // Store with TTL that resets on each attempt (rolling window)
    await this.cache.set(failedKey, newAttempts, 60 * this.lockoutMinutes);

    if (newAttempts >= this.maxAttempts) {
      // Lock the account
      const lockoutKey = `${LOCKOUT_PREFIX}${normalizedEmail}`;
      await this.cache.set(lockoutKey, true, 60 * this.lockoutMinutes);

      this.logger.warn(
        `Account locked: ${normalizedEmail} after ${newAttempts} failed attempts (${this.lockoutMinutes}min lockout)`,
      );

      return { remainingAttempts: 0, locked: true };
    }

    const remaining = this.maxAttempts - newAttempts;
    return { remainingAttempts: remaining, locked: false };
  }

  /**
   * Clear failed attempts on successful login.
   */
  async resetAttempts(email: string): Promise<void> {
    const normalizedEmail = email.toLowerCase();
    const failedKey = `${FAILED_PREFIX}${normalizedEmail}`;
    const lockoutKey = `${LOCKOUT_PREFIX}${normalizedEmail}`;

    await Promise.all([
      this.cache.del(failedKey),
      this.cache.del(lockoutKey),
    ]);
  }

  /**
   * Get current failed attempt count for an email.
   */
  async getFailedAttemptCount(email: string): Promise<number> {
    const failedKey = `${FAILED_PREFIX}${email.toLowerCase()}`;
    return (await this.cache.get<number>(failedKey)) || 0;
  }
}
