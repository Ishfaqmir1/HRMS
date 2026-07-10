'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api-client';
import { Interview, JobApplication, PaginatedResult } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { CalendarCheck } from 'lucide-react';

const STATUS_TONES: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
  SCHEDULED: 'warning', CONFIRMED: 'default', COMPLETED: 'success', CANCELLED: 'danger', RESCHEDULED: 'warning',
};

export default function InterviewsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [editOpen, setEditOpen] = useState<Interview | null>(null);
  const [form, setForm] = useState({ applicationId: '', title: '', type: 'VIDEO', scheduledAt: '', durationMinutes: 60, location: '', status: 'SCHEDULED' });

  const { data } = useQuery({
    queryKey: ['recruitment', 'interviews', page],
    queryFn: () => unwrap<PaginatedResult<Interview>>(api.get('/recruitment/interviews', { params: { page, limit: 20 } })),
  });

  const { data: upcoming } = useQuery({
    queryKey: ['recruitment', 'interviews', 'upcoming'],
    queryFn: () => unwrap<Interview[]>(api.get('/recruitment/interviews/upcoming')),
  });

  const { data: apps } = useQuery({
    queryKey: ['recruitment', 'applications', 'short'],
    queryFn: () => unwrap<PaginatedResult<JobApplication>>(api.get('/recruitment/applications', { params: { limit: 100 } })),
  });

  const createMut = useMutation({
    mutationFn: () => api.post('/recruitment/interviews', form),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['recruitment', 'interviews'] }); setScheduleOpen(false); },
  });

  const updateMut = useMutation({
    mutationFn: () => api.patch(`/recruitment/interviews/${editOpen!.id}`, form),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['recruitment', 'interviews'] }); setEditOpen(null); },
  });

  function openSchedule() {
    setForm({ applicationId: apps?.items[0]?.id || '', title: '', type: 'VIDEO', scheduledAt: '', durationMinutes: 60, location: '', status: 'SCHEDULED' });
    setScheduleOpen(true);
  }

  function openEdit(i: Interview) {
    setForm({ applicationId: i.applicationId, title: i.title, type: i.type || 'VIDEO', scheduledAt: new Date(i.scheduledAt).toISOString().slice(0, 16), durationMinutes: i.durationMinutes, location: i.location || '', status: i.status });
    setEditOpen(i);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h1 className="ledger-tab font-serif text-2xl font-semibold text-ink">Interviews</h1>
        <Button onClick={openSchedule}><CalendarCheck size={14} /> Schedule</Button>
      </div>

      {/* Upcoming interviews */}
      {upcoming && upcoming.length > 0 && (
        <Card>
          <CardContent className="pt-5">
            <h2 className="mb-3 text-sm font-medium text-ink-soft uppercase tracking-wider">Upcoming</h2>
            <div className="space-y-2">
              {upcoming.map(i => (
                <div key={i.id} className="flex items-center justify-between rounded-md border border-border p-3">
                  <div>
                    <p className="text-sm font-medium text-ink">{i.title}</p>
                    <p className="text-xs text-ink-faint">{i.application?.candidateName} · {i.application?.jobPosting?.title}</p>
                    <p className="text-xs text-ink-faint">{new Date(i.scheduledAt).toLocaleString()} · {i.durationMinutes}min{i.location ? ` · ${i.location}` : ''}</p>
                  </div>
                  <Badge tone={STATUS_TONES[i.status]}>{i.status}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-5">
          {data && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead><TableHead>Candidate</TableHead><TableHead>Job</TableHead>
                  <TableHead>Scheduled</TableHead><TableHead>Duration</TableHead><TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map(i => (
                  <TableRow key={i.id}>
                    <TableCell className="font-medium text-ink">{i.title}</TableCell>
                    <TableCell>{i.application?.candidateName}</TableCell>
                    <TableCell className="text-ink-soft text-xs">{i.application?.jobPosting?.title}</TableCell>
                    <TableCell className="text-xs text-ink-soft">{new Date(i.scheduledAt).toLocaleDateString()}</TableCell>
                    <TableCell>{i.durationMinutes}m</TableCell>
                    <TableCell><Badge tone={STATUS_TONES[i.status]}>{i.status}</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(i)}>Edit</Button>
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

      {/* Schedule Dialog */}
      <Dialog open={scheduleOpen} onOpenChange={o => !o && setScheduleOpen(false)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Schedule Interview</DialogTitle><DialogDescription>Set up a new interview for an applicant.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div><Label>Applicant</Label>
              <select value={form.applicationId} onChange={e => setForm({ ...form, applicationId: e.target.value })} className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm">
                {apps?.items.filter(a => ['NEW', 'SCREENING', 'SHORTLISTED'].includes(a.status)).map(a => (
                  <option key={a.id} value={a.id}>{a.candidateName} — {a.jobPosting?.title}</option>
                ))}
              </select>
            </div>
            <div><Label>Title</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Technical Screen" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Type</Label>
                <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm">
                  <option value="PHONE">Phone</option><option value="VIDEO">Video</option><option value="IN_PERSON">In Person</option>
                </select>
              </div>
              <div><Label>Duration (min)</Label><Input type="number" value={form.durationMinutes} onChange={e => setForm({ ...form, durationMinutes: Number(e.target.value) })} /></div>
            </div>
            <div><Label>Date & Time</Label><Input type="datetime-local" value={form.scheduledAt} onChange={e => setForm({ ...form, scheduledAt: e.target.value })} /></div>
            <div><Label>Location / Link</Label><Input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="Zoom link or room #" /></div>
            {createMut.isError && <p className="text-sm text-danger">{(createMut.error as any)?.response?.data?.message || 'Failed.'}</p>}
            <DialogFooter>
              <Button variant="outline" onClick={() => setScheduleOpen(false)}>Cancel</Button>
              <Button onClick={() => createMut.mutate()} isLoading={createMut.isPending}>Schedule</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editOpen} onOpenChange={o => !o && setEditOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Update Interview</DialogTitle><DialogDescription>Update interview details or status.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div><Label>Title</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Type</Label>
                <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm">
                  <option value="PHONE">Phone</option><option value="VIDEO">Video</option><option value="IN_PERSON">In Person</option>
                </select>
              </div>
              <div><Label>Duration</Label><Input type="number" value={form.durationMinutes} onChange={e => setForm({ ...form, durationMinutes: Number(e.target.value) })} /></div>
            </div>
            <div><Label>Date & Time</Label><Input type="datetime-local" value={form.scheduledAt} onChange={e => setForm({ ...form, scheduledAt: e.target.value })} /></div>
            <div><Label>Location</Label><Input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} /></div>            <div><Label>Status</Label>
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm">
                <option value="SCHEDULED">Scheduled</option><option value="CONFIRMED">Confirmed</option>
                <option value="COMPLETED">Completed</option><option value="CANCELLED">Cancelled</option>
              </select>
            </div>
            {updateMut.isError && <p className="text-sm text-danger">{(updateMut.error as any)?.response?.data?.message || 'Failed.'}</p>}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditOpen(null)}>Cancel</Button>
              <Button onClick={() => updateMut.mutate()} isLoading={updateMut.isPending}>Update</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
