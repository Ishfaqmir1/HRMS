'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Pencil, Users, X } from 'lucide-react';
import { api, unwrap } from '@/lib/api-client';
import { Shift, Employee, PaginatedResult } from '@/lib/types';
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

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const shiftSchema = z.object({
  name: z.string().min(1, 'Required'),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Use HH:mm format'),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Use HH:mm format'),
  breakMinutes: z.coerce.number().min(0).default(60),
  gracePeriodMinutes: z.coerce.number().min(0).default(0),
  workingDays: z.array(z.number()).min(1, 'Select at least one day'),
});
type ShiftForm = z.infer<typeof shiftSchema>;

export default function ShiftsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [assigningShift, setAssigningShift] = useState<Shift | null>(null);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]);

  const { data: shifts, isLoading } = useQuery({
    queryKey: ['shifts'],
    queryFn: () => unwrap<Shift[]>(api.get('/shifts')),
  });

  const { data: employees } = useQuery({
    queryKey: ['employees-list'],
    queryFn: () => unwrap<PaginatedResult<Employee>>(api.get('/employees', { params: { limit: 100 } })),
    enabled: !!assigningShift,
  });

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<ShiftForm>({
    resolver: zodResolver(shiftSchema),
    defaultValues: { breakMinutes: 60, gracePeriodMinutes: 0, workingDays: [1, 2, 3, 4, 5] },
  });

  function openCreate() {
    setEditingShift(null);
    setSelectedDays([1, 2, 3, 4, 5]);
    setValue('workingDays', [1, 2, 3, 4, 5]);
    setShowForm(true);
  }

  function openEdit(shift: Shift) {
    setEditingShift(shift);
    setSelectedDays(shift.workingDays);
    setValue('name', shift.name);
    setValue('startTime', shift.startTime);
    setValue('endTime', shift.endTime);
    setValue('breakMinutes', shift.breakMinutes);
    setValue('gracePeriodMinutes', shift.gracePeriodMinutes);
    setValue('workingDays', shift.workingDays);
    setShowForm(true);
  }

  function toggleDay(day: number) {
    const next = selectedDays.includes(day)
      ? selectedDays.filter((d) => d !== day)
      : [...selectedDays, day];
    setSelectedDays(next);
    setValue('workingDays', next);
  }

  const saveMutation = useMutation({
    mutationFn: (values: ShiftForm) => {
      const payload = { ...values, workingDays: selectedDays };
      return editingShift
        ? api.patch(`/shifts/${editingShift.id}`, payload)
        : api.post('/shifts', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      setShowForm(false);
      setEditingShift(null);
      reset();
    },
  });

  const assignMutation = useMutation({
    mutationFn: ({ shiftId, employeeIds }: { shiftId: string; employeeIds: string[] }) =>
      api.post(`/shifts/${shiftId}/assign`, { employeeIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      setAssigningShift(null);
    },
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="ledger-tab font-serif text-2xl font-semibold text-ink">Shifts</h1>
        <Button onClick={openCreate}><Plus size={16} /> Create shift</Button>
      </div>

      <Card>
        <CardContent className="pt-5">
          {isLoading && <p className="text-sm text-ink-faint">Loading shifts…</p>}
          {shifts && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead>Working Days</TableHead>
                  <TableHead>Grace</TableHead>
                  <TableHead>Assigned</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shifts.map((shift) => (
                  <TableRow key={shift.id}>
                    <TableCell className="font-medium text-ink">{shift.name}</TableCell>
                    <TableCell className="text-ink-soft">{shift.startTime} – {shift.endTime}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {shift.workingDays.map((d) => (
                          <span key={d} className="record-code">{DAY_NAMES[d]}</span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-ink-soft">{shift.gracePeriodMinutes}m</TableCell>
                    <TableCell className="text-ink-soft">{shift._count?.employees ?? 0}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setAssigningShift(shift)}>
                          <Users size={14} /> Assign
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => openEdit(shift)}>
                          <Pencil size={14} /> Edit
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {shifts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-ink-faint">No shifts defined yet.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingShift ? 'Edit Shift' : 'Create Shift'}</DialogTitle>
            <DialogDescription>Define shift timings and working days.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit((values) => saveMutation.mutate(values))} className="space-y-4">
            <div>
              <Label htmlFor="name">Shift name</Label>
              <Input id="name" placeholder="General Shift" {...register('name')} />
              <FieldError message={errors.name?.message} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="startTime">Start time</Label>
                <Input id="startTime" placeholder="09:00" {...register('startTime')} />
                <FieldError message={errors.startTime?.message} />
              </div>
              <div>
                <Label htmlFor="endTime">End time</Label>
                <Input id="endTime" placeholder="18:00" {...register('endTime')} />
                <FieldError message={errors.endTime?.message} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="breakMinutes">Break (minutes)</Label>
                <Input id="breakMinutes" type="number" {...register('breakMinutes')} />
              </div>
              <div>
                <Label htmlFor="gracePeriodMinutes">Grace period (minutes)</Label>
                <Input id="gracePeriodMinutes" type="number" {...register('gracePeriodMinutes')} />
              </div>
            </div>
            <div>
              <Label>Working days</Label>
              <div className="flex gap-2 mt-1">
                {DAY_NAMES.map((name, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggleDay(i)}
                    className={`h-9 w-10 rounded-md text-xs font-medium transition-colors ${
                      selectedDays.includes(i)
                        ? 'bg-accent text-white'
                        : 'bg-paper text-ink-faint hover:bg-border'
                    }`}
                  >
                    {name}
                  </button>
                ))}
              </div>
              <FieldError message={errors.workingDays?.message} />
            </div>
            {saveMutation.isError && (
              <p className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
                {(saveMutation.error as any)?.response?.data?.message || 'Could not save shift.'}
              </p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit" isLoading={saveMutation.isPending}>
                {editingShift ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Assign Shift Dialog */}
      <Dialog open={!!assigningShift} onOpenChange={(o) => {
        if (!o) { setAssigningShift(null); setSelectedEmployeeIds([]); }
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Assign: {assigningShift?.name}</DialogTitle>
            <DialogDescription>Select employees to assign this shift to.</DialogDescription>
          </DialogHeader>
          <div className="max-h-64 overflow-y-auto space-y-1">
            {employees?.items.map((emp) => {
              const checked = selectedEmployeeIds.includes(emp.id);
              return (
                <label
                  key={emp.id}
                  className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-paper cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      setSelectedEmployeeIds((prev) =>
                        prev.includes(emp.id)
                          ? prev.filter((id) => id !== emp.id)
                          : [...prev, emp.id]
                      );
                    }}
                    className="h-4 w-4 rounded border-border text-accent focus:ring-accent"
                  />
                  <div>
                    <p className="text-sm font-medium text-ink">{emp.firstName} {emp.lastName}</p>
                    <p className="text-xs text-ink-faint">{emp.employeeCode} · {emp.department?.name || '—'}</p>
                  </div>
                </label>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAssigningShift(null); setSelectedEmployeeIds([]); }}>Cancel</Button>
            <Button
              onClick={() => {
                if (selectedEmployeeIds.length && assigningShift) {
                  assignMutation.mutate({ shiftId: assigningShift.id, employeeIds: selectedEmployeeIds });
                }
              }}
              disabled={selectedEmployeeIds.length === 0}
              isLoading={assignMutation.isPending}
            >
              Assign to {selectedEmployeeIds.length} employee{selectedEmployeeIds.length !== 1 ? 's' : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
