'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api-client';
import { JobApplication, JobPosting, PaginatedResult } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Plus, Star } from 'lucide-react';

const STATUS_FLOW = ['NEW', 'SCREENING', 'SHORTLISTED', 'INTERVIEW', 'OFFERED', 'HIRED'];
const STATUS_TONES: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
  NEW: 'default', SCREENING: 'default', SHORTLISTED: 'warning', INTERVIEW: 'warning',
  OFFERED: 'success', HIRED: 'success', REJECTED: 'danger', WITHDRAWN: 'danger',
};

export default function ApplicantsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [jobFilter, setJobFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [detailApp, setDetailApp] = useState<JobApplication | null>(null);
  const [formData, setFormData] = useState({ jobPostingId: '', candidateName: '', candidateEmail: '', candidatePhone: '', source: '' });

  const { data } = useQuery({
    queryKey: ['recruitment', 'applications', page, jobFilter, statusFilter],
    queryFn: () => unwrap<PaginatedResult<JobApplication>>(api.get('/recruitment/applications', { params: { page, limit: 20, jobPostingId: jobFilter || undefined, status: statusFilter || undefined } })),
  });

  const { data: jobs } = useQuery({
    queryKey: ['recruitment', 'jobs', 'all'],
    queryFn: () => unwrap<PaginatedResult<JobPosting>>(api.get('/recruitment/jobs', { params: { limit: 50 } })),
  });

  const createMut = useMutation({
    mutationFn: () => api.post('/recruitment/applications', formData),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['recruitment', 'applications'] }); setCreateOpen(false); setFormData({ jobPostingId: '', candidateName: '', candidateEmail: '', candidatePhone: '', source: '' }); },
  });

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.patch(`/recruitment/applications/${id}/status`, { status }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['recruitment', 'applications'] }); setDetailApp(null); },
  });

  const ratingMut = useMutation({
    mutationFn: ({ id, rating }: { id: string; rating: number }) => api.patch(`/recruitment/applications/${id}/rating`, { rating }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recruitment', 'applications'] }),
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="ledger-tab font-serif text-2xl font-semibold text-ink">Applicants</h1>
        <Button onClick={() => { setFormData({ jobPostingId: jobs?.items[0]?.id || '', candidateName: '', candidateEmail: '', candidatePhone: '', source: '' }); setCreateOpen(true); }}>
          <Plus size={14} /> Add Applicant
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <select value={jobFilter} onChange={e => { setJobFilter(e.target.value); setPage(1); }} className="h-8 rounded-md border border-input bg-background px-2 text-xs">
          <option value="">All Jobs</option>
          {jobs?.items.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
        </select>
        {['', 'NEW', 'SCREENING', 'SHORTLISTED', 'INTERVIEW', 'OFFERED', 'HIRED', 'REJECTED'].map(s => (
          <Button key={s} variant={statusFilter === s ? 'default' : 'outline'} size="sm" onClick={() => { setStatusFilter(s); setPage(1); }}>{s || 'All'}</Button>
        ))}
      </div>

      <Card>
        <CardContent className="pt-5">
          {data && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Job</TableHead>
                  <TableHead>Source</TableHead><TableHead>Rating</TableHead><TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map(a => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium text-ink">{a.candidateName}</TableCell>
                    <TableCell className="text-ink-soft text-xs">{a.candidateEmail}</TableCell>
                    <TableCell>{a.jobPosting?.title}</TableCell>
                    <TableCell className="text-ink-soft text-xs">{a.source || '—'}</TableCell>
                    <TableCell>
                      {a.rating ? <span className="flex items-center gap-1"><Star size={12} className="text-amber" />{a.rating}/5</span> : '—'}
                    </TableCell>
                    <TableCell><Badge tone={STATUS_TONES[a.status]}>{a.status}</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => setDetailApp(a)}>View</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <div className="mt-4 flex items-center justify-between text-sm text-ink-faint">
            <span>Page {data?.meta.page || 1} of {Math.max(data?.meta.totalPages || 1, 1)}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
              <Button variant="outline" size="sm" disabled={page >= (data?.meta.totalPages || 1)} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={o => !o && setCreateOpen(false)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Applicant</DialogTitle><DialogDescription>Manually add a candidate application.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div><Label>Job</Label>
              <select value={formData.jobPostingId} onChange={e => setFormData({ ...formData, jobPostingId: e.target.value })} className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm">
                {jobs?.items.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
              </select>
            </div>
            <div><Label>Name</Label><Input value={formData.candidateName} onChange={e => setFormData({ ...formData, candidateName: e.target.value })} /></div>
            <div><Label>Email</Label><Input type="email" value={formData.candidateEmail} onChange={e => setFormData({ ...formData, candidateEmail: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Phone</Label><Input value={formData.candidatePhone} onChange={e => setFormData({ ...formData, candidatePhone: e.target.value })} /></div>
              <div><Label>Source</Label><Input value={formData.source} onChange={e => setFormData({ ...formData, source: e.target.value })} placeholder="LinkedIn" /></div>
            </div>
            {createMut.isError && <p className="text-sm text-danger">{(createMut.error as any)?.response?.data?.message || 'Failed.'}</p>}
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button onClick={() => createMut.mutate()} isLoading={createMut.isPending}>Add</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={!!detailApp} onOpenChange={o => !o && setDetailApp(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{detailApp?.candidateName}</DialogTitle>
            <DialogDescription>{detailApp?.jobPosting?.title} · {detailApp?.candidateEmail}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-ink-soft">Status:</span>
              {detailApp && <Badge tone={STATUS_TONES[detailApp.status]}>{detailApp.status}</Badge>}
            </div>

            {/* Status progression */}
            <div className="flex flex-wrap gap-1">
              {STATUS_FLOW.map(s => (
                <Button key={s} size="sm" variant={detailApp?.status === s ? 'default' : 'outline'}
                  disabled={!detailApp || (STATUS_FLOW.indexOf(s) < STATUS_FLOW.indexOf(detailApp!.status) && detailApp!.status !== 'REJECTED')}
                  onClick={() => detailApp && statusMut.mutate({ id: detailApp.id, status: s })}>
                  {s}
                </Button>
              ))}
              <Button size="sm" variant="destructive" onClick={() => detailApp && statusMut.mutate({ id: detailApp.id, status: 'REJECTED' })}>
                Reject
              </Button>
            </div>

            {/* Rating */}
            <div>
              <Label>Rating</Label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(r => (
                  <button key={r} onClick={() => detailApp && ratingMut.mutate({ id: detailApp.id, rating: r })} className={`h-8 w-8 rounded-md border text-sm ${(detailApp?.rating ?? 0) >= r ? 'bg-amber text-white border-amber' : 'bg-background text-ink-faint'}`}>
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {detailApp?.notes && <div><Label>Notes</Label><p className="text-sm text-ink-soft">{detailApp.notes}</p></div>}

            {/* Interviews */}
            {detailApp?.interviews && detailApp.interviews.length > 0 && (
              <div>
                <Label>Interviews</Label>
                <div className="space-y-2 mt-1">
                  {detailApp.interviews.map(i => (
                    <div key={i.id} className="rounded-md border border-border p-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-ink">{i.title}</span>
                        <Badge variant="default">{i.status}</Badge>
                      </div>
                      <p className="text-xs text-ink-faint mt-1">{new Date(i.scheduledAt).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
