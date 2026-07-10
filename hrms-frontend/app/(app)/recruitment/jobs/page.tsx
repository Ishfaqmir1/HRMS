'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api-client';
import { JobPosting, Department, PaginatedResult } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input, Label, FieldError } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Plus, Pencil, Eye, EyeOff } from 'lucide-react';

const STATUS_TONES: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
  PUBLISHED: 'success', DRAFT: 'warning', CLOSED: 'danger', ON_HOLD: 'default',
};

export default function JobPostingsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [dialog, setDialog] = useState<{ mode: 'create' | 'edit'; data?: JobPosting } | null>(null);
  const [formData, setFormData] = useState<any>({ title: '', location: '', employmentType: 'FULL_TIME', description: '', requirements: '', openings: 1, status: 'DRAFT', departmentId: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['recruitment', 'jobs', page, statusFilter],
    queryFn: () => unwrap<PaginatedResult<JobPosting>>(api.get('/recruitment/jobs', { params: { page, limit: 20, status: statusFilter || undefined } })),
  });

  const { data: depts } = useQuery({ queryKey: ['departments'], queryFn: () => unwrap<PaginatedResult<Department>>(api.get('/departments', { params: { limit: 50 } })) });

  function openCreate() { setFormData({ title: '', location: '', employmentType: 'FULL_TIME', description: '', requirements: '', openings: 1, status: 'DRAFT', departmentId: '' }); setDialog({ mode: 'create' }); }
  function openEdit(j: JobPosting) { setFormData({ title: j.title, location: j.location || '', employmentType: j.employmentType, description: j.description || '', requirements: j.requirements || '', openings: j.openings, status: j.status, departmentId: j.departmentId || '' }); setDialog({ mode: 'edit', data: j }); }

  const saveMut = useMutation({
    mutationFn: () => {
      const body = { ...formData, departmentId: formData.departmentId || undefined };
      return dialog?.mode === 'edit' ? api.patch(`/recruitment/jobs/${dialog.data!.id}`, body) : api.post('/recruitment/jobs', body);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['recruitment', 'jobs'] }); setDialog(null); },
  });

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.patch(`/recruitment/jobs/${id}/status`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recruitment', 'jobs'] }),
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="ledger-tab font-serif text-2xl font-semibold text-ink">Job Postings</h1>
        <Button onClick={openCreate}><Plus size={14} /> New Job</Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {['', 'PUBLISHED', 'DRAFT', 'CLOSED', 'ON_HOLD'].map(s => (
          <Button key={s} variant={statusFilter === s ? 'default' : 'outline'} size="sm" onClick={() => { setStatusFilter(s); setPage(1); }}>
            {s || 'All'}
          </Button>
        ))}
      </div>

      <Card>
        <CardContent className="pt-5">
          {isLoading && <p className="text-sm text-ink-faint">Loading…</p>}
          {data && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead><TableHead>Department</TableHead><TableHead>Type</TableHead>
                  <TableHead>Openings</TableHead><TableHead>Applicants</TableHead><TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map(j => (
                  <TableRow key={j.id}>
                    <TableCell className="font-medium text-ink">{j.title}</TableCell>
                    <TableCell className="text-ink-soft">{j.department?.name || '—'}</TableCell>
                    <TableCell><Badge variant="default">{j.employmentType.replace('_', ' ')}</Badge></TableCell>
                    <TableCell>{j.openings}</TableCell>
                    <TableCell>{j._count?.applications || 0}</TableCell>
                    <TableCell><Badge tone={STATUS_TONES[j.status]}>{j.status}</Badge></TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(j)}><Pencil size={12} /></Button>
                        {j.status === 'DRAFT' && <Button variant="ghost" size="sm" onClick={() => statusMut.mutate({ id: j.id, status: 'PUBLISHED' })}><Eye size={12} /></Button>}
                        {j.status === 'PUBLISHED' && <Button variant="ghost" size="sm" onClick={() => statusMut.mutate({ id: j.id, status: 'CLOSED' })}><EyeOff size={12} /></Button>}
                      </div>
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

      <Dialog open={!!dialog} onOpenChange={o => !o && setDialog(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{dialog?.mode === 'edit' ? 'Edit' : 'Create'} Job Posting</DialogTitle>
            <DialogDescription>Define the job listing details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2"><Label>Title</Label><Input value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} placeholder="Senior Software Engineer" /></div>
              <div><Label>Department</Label>
                <select value={formData.departmentId} onChange={e => setFormData({ ...formData, departmentId: e.target.value })} className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm">
                  <option value="">—</option>
                  {depts?.items.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div><Label>Location</Label><Input value={formData.location} onChange={e => setFormData({ ...formData, location: e.target.value })} placeholder="Remote / NYC" /></div>
              <div><Label>Employment Type</Label>
                <select value={formData.employmentType} onChange={e => setFormData({ ...formData, employmentType: e.target.value })} className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm">
                  <option value="FULL_TIME">Full Time</option><option value="PART_TIME">Part Time</option>
                  <option value="CONTRACT">Contract</option><option value="INTERN">Intern</option><option value="PROBATION">Probation</option>
                </select>
              </div>
              <div><Label>Openings</Label><Input type="number" value={formData.openings} onChange={e => setFormData({ ...formData, openings: Number(e.target.value) })} /></div>
              <div><Label>Status</Label>
                <select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })} className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm">
                  <option value="DRAFT">Draft</option><option value="PUBLISHED">Published</option>
                </select>
              </div>
            </div>
            <div><Label>Description</Label><textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm" /></div>
            <div><Label>Requirements</Label><textarea value={formData.requirements} onChange={e => setFormData({ ...formData, requirements: e.target.value })} className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm" /></div>
            {saveMut.isError && <p className="text-sm text-danger">{(saveMut.error as any)?.response?.data?.message || 'Save failed.'}</p>}
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
              <Button onClick={() => saveMut.mutate()} isLoading={saveMut.isPending}>Save</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
