'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api-client';
import { Company, PaginatedResult } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';

export default function CompaniesPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [confirmAction, setConfirmAction] = useState<{ id: string; action: 'suspend' | 'activate' } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['companies', page, search],
    queryFn: () =>
      unwrap<PaginatedResult<Company>>(
        api.get('/companies', { params: { page, limit: 20, search: search || undefined } }),
      ),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'suspend' | 'activate' }) =>
      api.patch(`/companies/${id}/${action}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      setConfirmAction(null);
    },
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <h1 className="ledger-tab font-serif text-2xl font-semibold text-ink">Companies</h1>

      <Card>
        <CardContent className="pt-5">
          <Input
            placeholder="Search by name or slug…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="mb-4 max-w-sm"
          />

          {isLoading && <p className="text-sm text-ink-faint">Loading companies…</p>}

          {data && (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Employees</TableHead>
                    <TableHead>Users</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((company) => (
                    <TableRow key={company.id}>
                      <TableCell className="font-medium text-ink">{company.name}</TableCell>
                      <TableCell><span className="record-code">{company.slug}</span></TableCell>
                      <TableCell>
                        <Badge variant={company.isActive ? 'success' : 'destructive'}>
                          {company.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-ink-soft">{company._count?.employees ?? 0}</TableCell>
                      <TableCell className="text-ink-soft">{company._count?.users ?? 0}</TableCell>
                      <TableCell className="text-ink-soft">
                        {new Date(company.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {company.isActive ? (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setConfirmAction({ id: company.id, action: 'suspend' })}
                          >
                            Suspend
                          </Button>
                        ) : (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => setConfirmAction({ id: company.id, action: 'activate' })}
                          >
                            Activate
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {data.items.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="py-8 text-center text-ink-faint">
                        No companies found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              <div className="mt-4 flex items-center justify-between text-sm text-ink-faint">
                <span>
                  Page {data.meta.page} of {Math.max(data.meta.totalPages, 1)} · {data.meta.total} total
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= data.meta.totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Confirm Dialog */}
      <Dialog open={!!confirmAction} onOpenChange={(o) => !o && setConfirmAction(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {confirmAction?.action === 'suspend' ? 'Suspend company?' : 'Activate company?'}
            </DialogTitle>
            <DialogDescription>
              {confirmAction?.action === 'suspend'
                ? 'All users in this company will lose access until reactivated.'
                : 'The company and its users will regain access.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAction(null)}>Cancel</Button>
            <Button
              variant={confirmAction?.action === 'suspend' ? 'destructive' : 'default'}
              onClick={() => {
                if (confirmAction) toggleMutation.mutate(confirmAction);
              }}
              isLoading={toggleMutation.isPending}
            >
              {confirmAction?.action === 'suspend' ? 'Suspend' : 'Activate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
