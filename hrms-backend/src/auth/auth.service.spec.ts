import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { LoginSecurityService } from '../common/services/login-security.service';
import { AuditService } from '../common/services/audit.service';
import * as bcrypt from 'bcrypt';

// Mock bcrypt at module level to avoid "Cannot redefine property" errors
// when jest.spyOn is called across multiple tests
jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

describe('AuthService', () => {
  let authService: AuthService;
  let prisma: jest.Mocked<PrismaService>;
  let jwtService: jest.Mocked<JwtService>;
  let loginSecurity: jest.Mocked<LoginSecurityService>;
  let auditService: jest.Mocked<AuditService>;
  let configService: jest.Mocked<ConfigService>;

  const mockPrisma = {
    company: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    employee: {
      create: jest.fn(),
    },
    role: {
      findFirst: jest.fn(),
    },
    userRole: {
      create: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    billingPlan: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn((cb: any) => {
      if (typeof cb === 'function') {
        return cb(mockPrisma);
      }
      return cb;
    }),
  } as any;

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('mock.jwt.token'),
    verify: jest.fn(),
  } as any;

  const mockLoginSecurity = {
    isLocked: jest.fn().mockResolvedValue(false),
    getRemainingLockoutMinutes: jest.fn().mockResolvedValue(25),
    recordFailedAttempt: jest.fn(),
    resetAttempts: jest.fn(),
  } as any;

  const mockAuditService = {
    log: jest.fn(),
  } as any;

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: any) => {
      const config: Record<string, any> = {
        'jwt.accessSecret': 'test-access-secret-at-least-16-chars',
        'jwt.refreshSecret': 'test-refresh-secret-at-least-16-chars',
        'jwt.accessExpiresIn': '15m',
        'jwt.refreshExpiresIn': '7d',
        'bcryptSaltRounds': 12,
      };
      return config[key] ?? defaultValue;
    }),
  } as any;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Default mocks — explicitly set ALL return values because jest.clearAllMocks()
    // only resets call data, NOT mock implementations. Each test may override these.
    mockPrisma.company.findUnique.mockResolvedValue(null);
    mockPrisma.company.create.mockResolvedValue({
      id: 'company-uuid',
      name: 'Test Corp',
      slug: 'test-corp',
    });
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.findFirst.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({
      id: 'user-uuid',
      email: 'admin@testcorp.com',
      companyId: 'company-uuid',
    });
    mockPrisma.employee.create.mockResolvedValue({
      id: 'employee-uuid',
      firstName: 'Admin',
      lastName: 'User',
    });
    mockPrisma.refreshToken.create.mockResolvedValue({
      id: 'rt-uuid',
      tokenHash: 'hashed-token',
      userId: 'user-uuid',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    mockPrisma.refreshToken.findFirst.mockResolvedValue(null);
    mockPrisma.role.findFirst.mockResolvedValue({
      id: 'role-uuid',
      slug: 'company-owner',
      name: 'Company Owner',
      isSystem: true,
      companyId: null,
    });
    mockJwtService.sign.mockReturnValue('mock.jwt.token');

    // LoginSecurity defaults — critical to reset because jest.clearAllMocks()
    // does NOT clear mock implementation (mockResolvedValue).
    // Without this, a previous test's override (e.g. isLocked → true) leaks.
    mockLoginSecurity.isLocked.mockResolvedValue(false);
    mockLoginSecurity.getRemainingLockoutMinutes.mockResolvedValue(25);
    mockLoginSecurity.recordFailedAttempt.mockResolvedValue(undefined);
    mockLoginSecurity.resetAttempts.mockResolvedValue(undefined);

    // AuditService default
    mockAuditService.log.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: LoginSecurityService, useValue: mockLoginSecurity },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    prisma = module.get(PrismaService) as any;
    jwtService = module.get(JwtService) as any;
    loginSecurity = module.get(LoginSecurityService) as any;
    auditService = module.get(AuditService) as any;
    configService = module.get(ConfigService) as any;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ====================================================================
  // 1. Registration
  // ====================================================================
  describe('1. Registration', () => {
    const registerDto = {
      companyName: 'Test Corp',
      companySlug: 'test-corp',
      email: 'admin@testcorp.com',
      password: 'SecurePass123!',
      firstName: 'Admin',
      lastName: 'User',
    };

    it('successfully registers a new company with owner', async () => {
      (bcrypt.hash as jest.Mock).mockResolvedValue('$2b$12$hashedpassword' as never);
      mockPrisma.$transaction.mockImplementation(async (cb: any) => {
        if (typeof cb === 'function') return cb(mockPrisma);
        return cb;
      });

      const result = await authService.register(registerDto);

      expect(result.accessToken).toBe('mock.jwt.token');
      expect(result.refreshToken).toBe('mock.jwt.token');
      expect(mockPrisma.company.create).toHaveBeenCalled();
      expect(mockPrisma.user.create).toHaveBeenCalled();
      expect(mockPrisma.employee.create).toHaveBeenCalled();
    });

    it('rejects registration with existing company slug', async () => {
      mockPrisma.company.findUnique.mockResolvedValue({ id: 'existing', slug: 'test-corp' });

      await expect(authService.register(registerDto))
        .rejects.toThrow('This company slug is already taken.');
    });

    it('propagates Prisma unique constraint error on duplicate email', async () => {
      // Registration doesn't check email uniqueness in service logic — it's enforced
      // at the DB level by Prisma's unique constraint. Simulate that error.
      (bcrypt.hash as jest.Mock).mockResolvedValue('$2b$12$hashed' as never);
      mockPrisma.user.create.mockRejectedValue(
        new Error('Unique constraint failed on the fields: (`email`)'),
      );
      mockPrisma.$transaction.mockImplementation(async (cb: any) => {
        if (typeof cb === 'function') return cb(mockPrisma);
        return cb;
      });

      await expect(authService.register(registerDto))
        .rejects.toThrow();
    });

    it('creates company with correct slug from name', async () => {
      (bcrypt.hash as jest.Mock).mockResolvedValue('$2b$12$hashedpassword' as never);
      mockPrisma.$transaction.mockImplementation(async (cb: any) => {
        if (typeof cb === 'function') return cb(mockPrisma);
        return cb;
      });

      await authService.register(registerDto);

      expect(mockPrisma.company.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ slug: 'test-corp' }),
        }),
      );
    });

    it('hashes password with bcrypt before storing', async () => {
      (bcrypt.hash as jest.Mock).mockResolvedValue('$2b$12$hashedpassword' as never);
      mockPrisma.$transaction.mockImplementation(async (cb: any) => {
        if (typeof cb === 'function') return cb(mockPrisma);
        return cb;
      });

      await authService.register(registerDto);

      expect(bcrypt.hash).toHaveBeenCalledWith('SecurePass123!', expect.any(Number));
    });

    it('generates both access and refresh tokens', async () => {
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed' as never);
      mockPrisma.$transaction.mockImplementation(async (cb: any) => {
        if (typeof cb === 'function') return cb(mockPrisma);
        return cb;
      });

      const result = await authService.register(registerDto);

      expect(jwtService.sign).toHaveBeenCalledTimes(2);
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });

    // ================================================================
    // Billing Plan Selection During Registration
    // ================================================================

    it('links the company to the selected billing plan when billingPlanId is provided', async () => {
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed' as never);
      const mockPlan = {
        id: 'plan-growth',
        name: 'Growth',
        slug: 'growth',
        isActive: true,
        maxEmployees: 100,
        maxStorageGB: 50,
      };
      mockPrisma.billingPlan.findUnique.mockResolvedValue(mockPlan);
      mockPrisma.$transaction.mockImplementation(async (cb: any) => {
        if (typeof cb === 'function') return cb(mockPrisma);
        return cb;
      });

      const result = await authService.register({
        ...registerDto,
        billingPlanId: 'plan-growth',
      });

      // Should have validated the plan exists
      expect(mockPrisma.billingPlan.findUnique).toHaveBeenCalledWith({
        where: { id: 'plan-growth', isActive: true },
      });
      // Should have passed billingPlanId to company.create
      expect(mockPrisma.company.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ billingPlanId: 'plan-growth' }),
        }),
      );
      // Registration still succeeds and returns tokens
      expect(result.accessToken).toBe('mock.jwt.token');
    });

    it('throws BadRequestException when the selected billing plan is inactive', async () => {
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed' as never);
      // Simulate plan not found — billingPlan.findUnique with isActive:true returns null
      mockPrisma.billingPlan.findUnique.mockResolvedValue(null);

      await expect(authService.register({
        ...registerDto,
        billingPlanId: 'nonexistent-plan',
      })).rejects.toThrow('Selected billing plan not found or is inactive.');

      // Company should NOT have been created
      expect(mockPrisma.company.create).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when the billing plan does not exist', async () => {
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed' as never);
      mockPrisma.billingPlan.findUnique.mockResolvedValue(null);

      await expect(authService.register({
        ...registerDto,
        billingPlanId: 'nonexistent-id',
      })).rejects.toThrow('Selected billing plan not found or is inactive.');
    });

    it('still succeeds when no billingPlanId is provided (backward compatible)', async () => {
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed' as never);
      mockPrisma.$transaction.mockImplementation(async (cb: any) => {
        if (typeof cb === 'function') return cb(mockPrisma);
        return cb;
      });

      const result = await authService.register(registerDto);

      // billingPlan should NOT be queried when no billingPlanId in DTO
      expect(mockPrisma.billingPlan.findUnique).not.toHaveBeenCalled();
      // company.create uses billingPlanId: null (null spread from the service)
      const callArg = mockPrisma.company.create.mock.calls[0][0];
      expect(callArg.data.billingPlanId).toBeNull();
      expect(result.accessToken).toBeDefined();
    });
  });

  // ====================================================================
  // 2. Login
  // ====================================================================
  describe('2. Login', () => {
    const loginDto = { email: 'admin@testcorp.com', password: 'SecurePass123!' };

    it('successfully logs in with valid credentials', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'user-uuid',
        email: 'admin@testcorp.com',
        passwordHash: '$2b$12$hashedpassword',
        status: 'ACTIVE',
        companyId: null,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true as never);
      mockJwtService.sign
        .mockReturnValueOnce('access.token.here')
        .mockReturnValueOnce('refresh.token.here');

      const result = await authService.login(loginDto);

      expect(result.accessToken).toBe('access.token.here');
      expect(result.refreshToken).toBe('refresh.token.here');
    });

    it('rejects login with wrong password', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'user-uuid',
        email: 'admin@testcorp.com',
        passwordHash: '$2b$12$hashedpassword',
        status: 'ACTIVE',
        companyId: null,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false as never);
      mockLoginSecurity.recordFailedAttempt.mockResolvedValue({
        remainingAttempts: 3,
        locked: false,
      });

      await expect(authService.login(loginDto))
        .rejects.toThrow('Invalid credentials');
    });

    it('rejects login for non-existent user', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(authService.login(loginDto))
        .rejects.toThrow('Invalid credentials');
    });

    it('rejects login when account is locked', async () => {
      mockLoginSecurity.isLocked.mockResolvedValue(true);
      mockLoginSecurity.getRemainingLockoutMinutes.mockResolvedValue(25);

      await expect(authService.login(loginDto))
        .rejects.toThrow('locked');
    });

    it('logs successful login attempt', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'user-uuid',
        email: 'admin@testcorp.com',
        passwordHash: 'hashed',
        status: 'ACTIVE',
        companyId: null,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true as never);
      mockJwtService.sign.mockReturnValue('token');
      mockPrisma.refreshToken.create.mockResolvedValue({ id: 'rt-uuid' });

      await authService.login(loginDto);

      expect(mockLoginSecurity.resetAttempts).toHaveBeenCalled();
      expect(mockAuditService.log).toHaveBeenCalled();
    });
  });

  // ====================================================================
  // 3. Token Refresh
  // ====================================================================
  describe('3. Token Refresh', () => {
    it('returns new token pair when refresh token is valid', async () => {
      mockJwtService.verify.mockReturnValue({ sub: 'user-uuid' });
      mockPrisma.refreshToken.findFirst.mockResolvedValue({
        id: 'rt-uuid',
        tokenHash: 'hashed-token',
        userId: 'user-uuid',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 86400000),
      });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-uuid',
        email: 'admin@testcorp.com',
        status: 'ACTIVE',
        companyId: null,
      });
      mockJwtService.sign
        .mockReturnValueOnce('new.access.token')
        .mockReturnValueOnce('new.refresh.token');

      const result = await authService.refresh('valid-refresh-token');

      expect(result.accessToken).toBe('new.access.token');
      expect(result.refreshToken).toBe('new.refresh.token');
    });

    it('rejects refresh with revoked token', async () => {
      mockJwtService.verify.mockReturnValue({ sub: 'user-uuid' });
      mockPrisma.refreshToken.findFirst.mockResolvedValue({
        id: 'rt-uuid',
        revokedAt: new Date(), // revoked
        expiresAt: new Date(Date.now() + 86400000),
      });

      await expect(authService.refresh('revoked-token'))
        .rejects.toThrow();
    });

    it('rejects refresh with expired token', async () => {
      mockJwtService.verify.mockReturnValue({ sub: 'user-uuid' });
      mockPrisma.refreshToken.findFirst.mockResolvedValue({
        id: 'rt-uuid',
        revokedAt: null,
        expiresAt: new Date(Date.now() - 86400000), // expired yesterday
      });

      await expect(authService.refresh('expired-token'))
        .rejects.toThrow();
    });

    it('rejects refresh for non-existent token', async () => {
      mockJwtService.verify.mockReturnValue({ sub: 'user-uuid' });
      mockPrisma.refreshToken.findFirst.mockResolvedValue(null);

      await expect(authService.refresh('nonexistent-token'))
        .rejects.toThrow();
    });
  });

  // ====================================================================
  // 4. Logout
  // ====================================================================
  describe('4. Logout', () => {
    it('revokes the refresh token on logout', async () => {
      await authService.logout('user-uuid', 'token-to-revoke');

      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-uuid',
          }),
          data: expect.objectContaining({
            revokedAt: expect.any(Date),
          }),
        }),
      );
    });
  });

  // ====================================================================
  // 5. Token Generation & Payload
  // ====================================================================
  describe('5. Token Payload', () => {
    it('includes userId, email, roles in access token payload', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'user-uuid',
        email: 'admin@testcorp.com',
        passwordHash: 'hashed',
        status: 'ACTIVE',
        companyId: null,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true as never);

      await authService.login({ email: 'admin@testcorp.com', password: 'SecurePass123!' });

      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: 'user-uuid',
          email: 'admin@testcorp.com',
        }),
        expect.objectContaining({
          secret: 'test-access-secret-at-least-16-chars',
          expiresIn: '15m',
        }),
      );
    });

    it('includes companyId when user belongs to a company', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'user-uuid',
        email: 'admin@testcorp.com',
        passwordHash: 'hashed',
        status: 'ACTIVE',
        companyId: 'company-uuid', // must match the company found by slug lookup
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true as never);
      mockPrisma.company.findUnique.mockResolvedValue({
        id: 'company-uuid',
        name: 'Test Corp',
        isActive: true,
      });

      await authService.login({
        email: 'admin@testcorp.com',
        password: 'SecurePass123!',
        companySlug: 'test-corp',
      });

      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({ companyId: expect.any(String) }),
        expect.any(Object),
      );
    });
  });

  // ====================================================================
  // 6. Edge Cases
  // ====================================================================
  describe('6. Edge Cases', () => {
    it('handles empty email gracefully', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(authService.login({ email: '', password: 'pass' }))
        .rejects.toThrow('Invalid credentials');
    });

    it('handles very long password without crashing', async () => {
      const longPassword = 'a'.repeat(2000);
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'user-uuid',
        email: 'admin@testcorp.com',
        passwordHash: '$2b$12$hashed',
        status: 'ACTIVE',
        companyId: null,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false as never);
      mockLoginSecurity.recordFailedAttempt.mockResolvedValue({
        remainingAttempts: 3,
        locked: false,
      });

      const result = authService.login({ email: 'admin@testcorp.com', password: longPassword });
      await expect(result).rejects.toThrow('Invalid credentials');
    });

    it('login with company slug validates company exists', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.company.findUnique.mockResolvedValue(null);

      await expect(authService.login({
        email: 'admin@testcorp.com',
        password: 'pass',
        companySlug: 'nonexistent-slug',
      })).rejects.toThrow();
    });
  });
});
