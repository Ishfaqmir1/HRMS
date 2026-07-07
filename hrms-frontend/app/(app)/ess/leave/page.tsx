'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api-client';
import { PaginatedResult, LeaveRequest } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';

const STATUS_TONES: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
  APPROVED: 'success', PENDING: 'warning', REJECTED: 'danger', CANCELLED: 'danger',
};

export default function LeaveHistoryPage() {
  const [page, setPage] = useState(1);

  const { data: leaveData, isLoading } = useQuery({
    queryKey: ['me', 'leave-history', page],
    queryFn: () => unwrap<PaginatedResult<LeaveRequest>>(api.get('/me/leave/history', { params: { page, limit: 20 } })),
  });

  const { data: balances } = useQuery({
    queryKey: ['me', 'leave-balances'],
    queryFn: () => unwrap<any[]>(api.get('/me/leave/balances')),
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <h1 className="ledger-tab font-serif text-2xl font-semibold text-ink">Leave History</h1>

      {balances && balances.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {balances.map((b) => (
            <div key={b.id} className="rounded-md border border-border p-4">
              <p className="text-xs text-ink-faint">{b.leaveType.name}</p>
              <p className="font-serif text-2xl font-semibold text-ink">
                {(b.allocated + b.carriedForward - b.used).toFixed(1)}
              </p>
              <p className="text-xs text-ink-faint">
                of {(b.allocated + b.carriedForward).toFixed(1)} days
              </p>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-paper">
                <div
                  className="h-full rounded-full bg-accent transition-all"
                  style={{ width: `${Math.min((b.allocated + b.carriedForward - b.used) / Math.max(b.allocated + b.carriedForward, 1) * 100, 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <Card>
        <CardHeader><CardTitle>Leave Requests</CardTitle></CardHeader>
        <CardContent>
          {isLoading && <p className="text-sm text-ink-faint">Loading leave history…</p>}
          {leaveData && (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead>Days</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaveData.items.map((lr) => (
                    <TableRow key={lr.id}>
                      <TableCell><Badge variant="default">{lr.leaveType.name}</Badge></TableCell>
                      <TableCell className="text-ink">
                        {new Date(lr.startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </TableCell>
                      <TableCell className="text-ink">
                        {new Date(lr.endDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </TableCell>
                      <TableCell className="font-medium text-ink">{lr.totalDays}</TableCell>
                      <TableCell className="max-w-[200px] truncate text-ink-soft">{lr.reason || '—'}</TableCell>
                      <TableCell>
                        <Badge tone={STATUS_TONES[lr.status]}>{lr.status}</Badge>
                      </TableCell>
                      <TableCell className="text-ink-faint">
                        {new Date(lr.createdAt).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                  {leaveData.items.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="py-8 text-center text-ink-faint">No leave requests yet.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
              <div className="mt-4 flex items-center justify-between text-sm text-ink-faint">
                <span>Page {leaveData.meta.page} of {Math.max(leaveData.meta.totalPages, 1)}</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
                  <Button variant="outline" size="sm" disabled={page >= leaveData.meta.totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
