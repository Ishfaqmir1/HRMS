'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Pencil, Users, Eye } from 'lucide-react';
import { api, unwrap } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input, Label, FieldError } from '@/components/ui/input';
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

interface Training {
  id: string;
  title: string;
  description: string | null;
  provider: string | null;
  duration: string | null;
  mode: string | null;
  startDate: string | null;
  endDate: string | null;
  maxParticipants: number | null;
  status: 'UPCOMING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  _count?: { enrollments: number };
  enrollments?: {
    id: string;
    status: string;
    employee: { id: string; firstName: string; lastName: string; employeeCode: string };
  }[];
}

const STATUS_VARIANTS: Record<string, 'success' | 'warning' | 'default' | 'danger'> = {
  UPCOMING: 'default',
  IN_PROGRESS: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'danger',
};

const schema = z.object({
  title: z.string().min(1, 'Required'),
  description: z.string().optional(),
  provider: z.string().optional(),
  duration: z.string().optional(),
  mode: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  maxParticipants: z.coerce.number().int().min(1).optional(),
});
type FormValues = z.infer<typeof schema>;

export default function TrainingAdminPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Training | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['training-admin'],
    queryFn: () => unwrap<Training[]>(api.get('/training')),
  });

  const { data: detail } = useQuery({
    queryKey: ['training', detailId],
    queryFn: () => unwrap<Training>(api.get(`/training/${detailId}`)),
    enabled: !!detailId,
  });

  function openCreate() {
    setEditing(null);
    reset({ title: '', description: '', provider: '', duration: '', mode: '' });
    setShowForm(true);
  }

  function openEdit(t: Training) {
    setEditing(t);
    setValue('title', t.title);
    setValue('description', t.description ?? '');
    setValue('provider', t.provider ?? '');
    setValue('duration', t.duration ?? '');
    setValue('mode', t.mode ?? '');
    setValue('startDate', t.startDate?.split('T')[0] ?? '');
    setValue('endDate', t.endDate?.split('T')[0] ?? '');
    setValue('maxParticipants', t.maxParticipants ?? undefined);
    setShowForm(true);
  }

  const saveMut = useMutation({
    mutationFn: (values: FormValues) =>
      editing
        ? api.patch(`/training/${editing.id}`, values)
        : api.post('/training', values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-admin'] });
      setShowForm(false);
      setEditing(null);
      reset();
    },
  });

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.post(`/training/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-admin'] });
      queryClient.invalidateQueries({ queryKey: ['training', detailId] });
    },
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="ledger-tab font-serif text-2xl font-semibold text-ink">Training Programs</h1>
        <Button onClick={openCreate}><Plus size={16} /> Create program</Button>
      </div>

      <Card>
        <CardContent className="pt-5">
          {isLoading && <p className="text-sm text-ink-faint">Loading training programs…</p>}
          {data && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead className="w-20">Enrolled</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right w-40">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium text-ink">{t.title}</TableCell>
                    <TableCell className="text-ink-soft">{t.provider || '—'}</TableCell>
                    <TableCell className="text-ink-soft">{t.duration || '—'}</TableCell>
                    <TableCell className="text-ink-soft">{t._count?.enrollments ?? 0}/{t.maxParticipants || '∞'}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANTS[t.status] as any}>{t.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setDetailId(t.id)} title="View enrollments">
                          <Eye size={14} />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => openEdit(t)}>
                          <Pencil size={14} /> Edit
                        </Button>
                        {t.status === 'UPCOMING' && (
                          <Button variant="ghost" size="sm" onClick={() => statusMut.mutate({ id: t.id, status: 'IN_PROGRESS' })}>
                            Start
                          </Button>
                        )}
                        {t.status === 'IN_PROGRESS' && (
                          <Button variant="ghost" size="sm" onClick={() => statusMut.mutate({ id: t.id, status: 'COMPLETED' })}>
                            Complete
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {data.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-ink-faint">
                      No training programs defined yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={(o) => { if (!o) { setShowForm(false); setEditing(null); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Training Program' : 'Create Training Program'}</DialogTitle>
            <DialogDescription>
              {editing ? 'Update program details.' : 'Create a new training or certification program.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit((values) => saveMut.mutate(values))} className="space-y-4">
            <div>
              <Label htmlFor="title">Title *</Label>
              <Input id="title" placeholder="AWS Cloud Practitioner" {...register('title')} />
              <FieldError message={errors.title?.message} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="provider">Provider</Label>
                <Input id="provider" placeholder="Amazon Web Services" {...register('provider')} />
              </div>
              <div>
                <Label htmlFor="duration">Duration</Label>
                <Input id="duration" placeholder="8 hours" {...register('duration')} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="mode">Mode</Label>
                <Input id="mode" placeholder="ONLINE / IN_PERSON" {...register('mode')} />
              </div>
              <div>
                <Label htmlFor="maxParticipants">Max participants</Label>
                <Input id="maxParticipants" type="number" min={1} {...register('maxParticipants')} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="startDate">Start date</Label>
                <Input id="startDate" type="date" {...register('startDate')} />
              </div>
              <div>
                <Label htmlFor="endDate">End date</Label>
                <Input id="endDate" type="date" {...register('endDate')} />
              </div>
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <textarea
                id="description"
                {...register('description')}
                className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"
                placeholder="Program description and learning objectives..."
              />
            </div>
            {saveMut.isError && (
              <p className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
                {(saveMut.error as any)?.response?.data?.message || 'Could not save training program.'}
              </p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setShowForm(false); setEditing(null); }}>
                Cancel
              </Button>
              <Button type="submit" isLoading={saveMut.isPending}>
                {editing ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Detail / Enrollments Dialog */}
      <Dialog open={!!detailId} onOpenChange={(o) => { if (!o) setDetailId(null); }}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          {detail && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <DialogTitle>{detail.title}</DialogTitle>
                  <Badge variant={STATUS_VARIANTS[detail.status] as any}>{detail.status}</Badge>
                </div>
                <DialogDescription>
                  {detail.provider && `${detail.provider} · `}
                  {detail.duration && `${detail.duration} · `}
                  {detail.mode && `${detail.mode}`}
                </DialogDescription>
              </DialogHeader>

              {detail.description && (
                <p className="text-sm text-ink-soft">{detail.description}</p>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg bg-paper p-3 text-center">
                  <p className="text-xs text-ink-faint uppercase">Enrolled</p>
                  <p className="mt-1 font-semibold text-ink">{detail._count?.enrollments ?? 0}</p>
                </div>
                <div className="rounded-lg bg-paper p-3 text-center">
                  <p className="text-xs text-ink-faint uppercase">Capacity</p>
                  <p className="mt-1 font-semibold text-ink">{detail.maxParticipants || '∞'}</p>
                </div>
                <div className="rounded-lg bg-paper p-3 text-center">
                  <p className="text-xs text-ink-faint uppercase">Start</p>
                  <p className="mt-1 font-semibold text-ink">
                    {detail.startDate ? new Date(detail.startDate).toLocaleDateString() : '—'}
                  </p>
                </div>
              </div>

              {detail.enrollments && detail.enrollments.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-medium text-ink">Enrolled Employees</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Code</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detail.enrollments.map((e) => (
                        <TableRow key={e.id}>
                          <TableCell className="font-medium text-ink">
                            {e.employee.firstName} {e.employee.lastName}
                          </TableCell>
                          <TableCell className="text-ink-faint">{e.employee.employeeCode}</TableCell>
                          <TableCell>
                            <Badge variant={STATUS_VARIANTS[e.status] as any}>{e.status}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              <DialogFooter>
                <Button onClick={() => setDetailId(null)}>Close</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
