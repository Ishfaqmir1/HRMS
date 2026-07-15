import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  let prismaService: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PrismaService],
    }).compile();

    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(async () => {
    await prismaService?.onModuleDestroy();
  });

  it('should be defined', () => {
    expect(prismaService).toBeDefined();
  });

  it('should have a $connect method', () => {
    expect(prismaService.$connect).toBeDefined();
    expect(typeof prismaService.$connect).toBe('function');
  });

  it('should have a $disconnect method', () => {
    expect(prismaService.$disconnect).toBeDefined();
    expect(typeof prismaService.$disconnect).toBe('function');
  });

  it('should have a $transaction method', () => {
    expect(prismaService.$transaction).toBeDefined();
    expect(typeof prismaService.$transaction).toBe('function');
  });

  it('should expose Prisma model delegates', () => {
    // Core models that must be available
    expect(prismaService.user).toBeDefined();
    expect(prismaService.company).toBeDefined();
    expect(prismaService.employee).toBeDefined();
    expect(prismaService.attendanceRecord).toBeDefined();
    expect(prismaService.leaveRequest).toBeDefined();
    expect(prismaService.payslip).toBeDefined();
  });
});
