'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Pencil, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { api, unwrap } from '@/lib/api-client';
import { Holiday } from '@/lib/types';
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

const holidaySchema = z.object({
  name: z.string().min(1, 'Required'),
  date: z.string().min(1, 'Required'),
  isOptional: z.boolean().optional().default(false),
});
type HolidayForm = z.infer<typeof holidaySchema>;

export default function HolidaysPage() {
  const queryClient = useQueryClient();
  const [year, setYear] = useState(new Date().getFullYear());
  const [showForm, setShowForm] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const { data: holidays, isLoading } = useQuery({
    queryKey: ['holidays', year],
    queryFn: () => unwrap<Holiday[]>(api.get('/holidays', { params: { year } })),
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<HolidayForm>({
    resolver: zodResolver(holidaySchema),
  });

  function openCreate() {
    setEditingHoliday(null);
    reset({ isOptional: false });
    setShowForm(true);
  }

  function openEdit(holiday: Holiday) {
    setEditingHoliday(holiday);
    reset({
      name: holiday.name,
      date: holiday.date.slice(0, 10),
      isOptional: holiday.isOptional,
    });
    setShowForm(true);
  }

  const saveMutation = useMutation({
    mutationFn: (values: HolidayForm) => {
      const payload = { ...values, isOptional: values.isOptional ?? false };
      return editingHoliday
        ? api.patch(`/holidays/${editingHoliday.id}`, payload)
        : api.post('/holidays', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holidays'] });
      setShowForm(false);
      setEditingHoliday(null);
      reset();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/holidays/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holidays'] });
      setDeleteConfirm(null);
    },
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="ledger-tab font-serif text-2xl font-semibold text-ink">Holidays</h1>
        <Button onClick={openCreate}><Plus size={16} /> Add holiday</Button>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => setYear((y) => y - 1)}>
            <ChevronLeft size={14} />
          </Button>
          <span className="font-serif text-lg font-semibold text-ink">{year}</span>
          <Button variant="outline" size="sm" onClick={() => setYear((y) => y + 1)}>
            <ChevronRight size={14} />
          </Button>
        </div>
        <span className="text-sm text-ink-faint">{holidays?.length || 0} holidays</span>
      </div>

      <Card>
        <CardContent className="pt-5">
          {isLoading && <p className="text-sm text-ink-faint">Loading holidays…</p>}
          {holidays && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {holidays.map((holiday) => (
                  <TableRow key={holiday.id}>
                    <TableCell className="font-medium text-ink">
                      {new Date(holiday.date).toLocaleDateString(undefined, {
                        weekday: 'short', month: 'short', day: 'numeric',
                      })}
                    </TableCell>
                    <TableCell className="text-ink">{holiday.name}</TableCell>
                    <TableCell>
                      {holiday.isOptional ? (
                        <Badge variant="warning">Optional</Badge>
                      ) : (
                        <Badge variant="success">Mandatory</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(holiday)}>
                          <Pencil size={14} />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setDeleteConfirm(holiday.id)}>
                          <Trash2 size={14} className="text-danger" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {holidays.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-ink-faint">
                      No holidays for {year}.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingHoliday ? 'Edit Holiday' : 'Add Holiday'}</DialogTitle>
            <DialogDescription>Add a company-wide or optional holiday.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit((values) => saveMutation.mutate(values))} className="space-y-4">
            <div>
              <Label htmlFor="name">Holiday name</Label>
              <Input id="name" placeholder="New Year's Day" {...register('name')} />
              <FieldError message={errors.name?.message} />
            </div>
            <div>
              <Label htmlFor="date">Date</Label>
              <Input id="date" type="date" {...register('date')} />
              <FieldError message={errors.date?.message} />
            </div>
            <label className="flex items-center gap-2 text-sm text-ink-soft">
              <input type="checkbox" {...register('isOptional')} className="h-4 w-4 rounded border-border text-accent" />
              Optional holiday (employees may choose to work)
            </label>
            {saveMutation.isError && (
              <p className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
                {(saveMutation.error as any)?.response?.data?.message || 'Could not save holiday.'}
              </p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit" isLoading={saveMutation.isPending}>
                {editingHoliday ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={(o) => !o && setDeleteConfirm(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete holiday?</DialogTitle>
            <DialogDescription>This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm)}
              isLoading={deleteMutation.isPending}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
