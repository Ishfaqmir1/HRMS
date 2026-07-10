import { AttendanceRegularizationService } from './attendance-regularization.service';

describe('AttendanceRegularizationService', () => {
  const prisma = {
    employee: {
      findFirst: jest.fn(),
    },
    attendanceRegularization: {
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
    },
    attendanceRecord: {
      findFirst: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  } as any;

  let service: AttendanceRegularizationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AttendanceRegularizationService(prisma);
  });

  it('clears stale moderation metadata when a request is resubmitted', async () => {
    prisma.employee.findFirst.mockResolvedValue({ id: 'employee-1' });
    prisma.attendanceRegularization.findUnique.mockResolvedValue({
      id: 'regularization-1',
      status: 'REJECTED',
      attendanceId: 'attendance-1',
      requestedCheckIn: new Date('2026-07-09T09:00:00Z'),
      requestedCheckOut: null,
      requestedStatus: 'PRESENT',
      notes: 'old note',
    });
    prisma.attendanceRegularization.update.mockResolvedValue({ id: 'regularization-1', status: 'PENDING' });

    await service.create('company-1', 'employee-1', {
      date: '2026-07-09',
      reason: 'Resubmitting after correction',
      requestedCheckIn: '2026-07-09T09:15:00Z',
    } as any);

    expect(prisma.attendanceRegularization.update).toHaveBeenCalledWith({
      where: { id: 'regularization-1' },
      data: expect.objectContaining({
        status: 'PENDING',
        approvedById: null,
        approvedAt: null,
        rejectionReason: null,
      }),
    });
  });
});