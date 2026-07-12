'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Pencil, X } from 'lucide-react';
import { api, unwrap } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input, Label, FieldError } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';

interface Designation {
  id: string;
  title: string;
  level: number | null;
  isActive: boolean;
  _count?: { employees: number };
}

const schema = z.object({
  title: z.string().min(1, 'Required'),
  level: z.coerce.number().int().min(0).optional(),
});
type FormValues = z.infer<typeof schema>;

export default function DesignationsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Designation | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['designations'],
    queryFn: () => unwrap<Designation[]>(api.get('/designations')),
  });

  function openCreate() {
    setEditing(null);
    reset({ title: '', level: 0 });
    setShowForm(true);
  }

  function openEdit(d: Designation) {
    setEditing(d);
    setValue('title', d.title);
    setValue('level', d.level ?? 0);
    setShowForm(true);
  }

  const saveMut = useMutation({
    mutationFn: (values: FormValues) =>
      editing
        ? api.patch(`/designations/${editing.id}`, values)
        : api.post('/designations', values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['designations'] });
      setShowForm(false);
      setEditing(null);
      reset();
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/designations/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['designations'] });
      setDeleteId(null);
    },
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="ledger-tab font-serif text-2xl font-semibold text-ink">Designations</h1>
        <Button onClick={openCreate}><Plus size={16} /> Create designation</Button>
      </div>

      <Card>
        <CardContent className="pt-5">
          {isLoading && <p className="text-sm text-ink-faint">Loading designations…</p>}
          {data && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead className="w-20">Level</TableHead>
                  <TableHead className="w-24">Employees</TableHead>
                  <TableHead className="w-24 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium text-ink">{d.title}</TableCell>
                    <TableCell className="text-ink-soft">{d.level ?? '—'}</TableCell>
                    <TableCell className="text-ink-soft">{d._count?.employees ?? 0}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(d)}>
                          <Pencil size={14} /> Edit
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setDeleteId(d.id)}>
                          <X size={14} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {data.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-ink-faint">
                      No designations defined yet.
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Designation' : 'Create Designation'}</DialogTitle>
            <DialogDescription>
              {editing ? 'Update the designation title or level.' : 'Add a new job designation/title.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit((values) => saveMut.mutate(values))} className="space-y-4">
            <div>
              <Label htmlFor="title">Title</Label>
              <Input id="title" placeholder="Senior Software Engineer" {...register('title')} />
              <FieldError message={errors.title?.message} />
            </div>
            <div>
              <Label htmlFor="level">Level (lower = more junior)</Label>
              <Input id="level" type="number" min={0} {...register('level')} />
            </div>
            {saveMut.isError && (
              <p className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
                {(saveMut.error as any)?.response?.data?.message || 'Could not save designation.'}
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

      {/* Delete Confirmation */}
      <Dialog open={!!deleteId} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Deactivate Designation</DialogTitle>
            <DialogDescription>
              This will mark the designation as inactive. Employees with this designation will not be affected.
            </DialogDescription>
          </DialogHeader>
          {deleteMut.isError && (
            <p className="text-sm text-danger">
              {(deleteMut.error as any)?.response?.data?.message || 'Failed to deactivate.'}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deleteId && deleteMut.mutate(deleteId)}
              isLoading={deleteMut.isPending}
            >
              Deactivate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
