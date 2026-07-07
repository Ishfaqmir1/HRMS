'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api-client';
import { Employee } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';

const profileSchema = z.object({
  personalEmail: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  firstName: z.string().min(1, 'Required').optional(),
  lastName: z.string().min(1, 'Required').optional(),
});
type ProfileForm = z.infer<typeof profileSchema>;

export default function ProfilePage() {
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);

  const { data: profile, isLoading } = useQuery({
    queryKey: ['me', 'profile'],
    queryFn: () => unwrap<any>(api.get('/me/profile')),
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
  });

  const updateMut = useMutation({
    mutationFn: (v: ProfileForm) => api.patch('/me/profile', v),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me', 'profile'] });
      setEditOpen(false);
    },
  });

  if (isLoading) return <p className="text-sm text-ink-faint">Loading profile…</p>;

  const openEdit = () => {
    reset({
      personalEmail: profile?.personalEmail || '',
      phone: profile?.phone || '',
      firstName: profile?.firstName || '',
      lastName: profile?.lastName || '',
    });
    setEditOpen(true);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="ledger-tab font-serif text-2xl font-semibold text-ink">My Profile</h1>
        <Button onClick={openEdit}>Edit Profile</Button>
      </div>

      {profile && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>{profile.firstName} {profile.lastName}</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-ink-faint">Employee Code</dt>
                  <dd className="mt-1 text-sm text-ink"><span className="record-code">{profile.employeeCode}</span></dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-ink-faint">Status</dt>
                  <dd className="mt-1"><Badge tone={profile.status === 'ACTIVE' ? 'success' : 'warning'}>{profile.status}</Badge></dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-ink-faint">Designation</dt>
                  <dd className="mt-1 text-sm text-ink">{profile.designation?.title || '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-ink-faint">Department</dt>
                  <dd className="mt-1 text-sm text-ink">{profile.department?.name || '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-ink-faint">Branch</dt>
                  <dd className="mt-1 text-sm text-ink">{profile.branch?.name || '—'}{profile.branch?.city ? ` (${profile.branch.city})` : ''}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-ink-faint">Team</dt>
                  <dd className="mt-1 text-sm text-ink">{profile.team?.name || '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-ink-faint">Work Email</dt>
                  <dd className="mt-1 text-sm text-ink">{profile.workEmail || '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-ink-faint">Personal Email</dt>
                  <dd className="mt-1 text-sm text-ink">{profile.personalEmail || '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-ink-faint">Phone</dt>
                  <dd className="mt-1 text-sm text-ink">{profile.phone || '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-ink-faint">Reporting Manager</dt>
                  <dd className="mt-1 text-sm text-ink">{profile.reportingManager ? `${profile.reportingManager.firstName} ${profile.reportingManager.lastName}` : '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-ink-faint">Employment Type</dt>
                  <dd className="mt-1 text-sm text-ink">{profile.employmentType || '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-ink-faint">Date of Joining</dt>
                  <dd className="mt-1 text-sm text-ink">
                    {profile.dateOfJoining ? new Date(profile.dateOfJoining).toLocaleDateString() : '—'}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          {profile.shift && (
            <Card>
              <CardHeader><CardTitle>Shift Details</CardTitle></CardHeader>
              <CardContent>
                <dl className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <dt className="text-ink-faint">Shift</dt>
                    <dd className="text-ink font-medium">{profile.shift.name}</dd>
                  </div>
                  <div className="flex justify-between text-sm">
                    <dt className="text-ink-faint">Start Time</dt>
                    <dd className="text-ink">{profile.shift.startTime}</dd>
                  </div>
                  <div className="flex justify-between text-sm">
                    <dt className="text-ink-faint">End Time</dt>
                    <dd className="text-ink">{profile.shift.endTime}</dd>
                  </div>
                  <div className="flex justify-between text-sm">
                    <dt className="text-ink-faint">Break</dt>
                    <dd className="text-ink">{profile.shift.breakMinutes} min</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Edit Profile Dialog */}
      <Dialog open={editOpen} onOpenChange={o => !o && setEditOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
            <DialogDescription>Update your contact information.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(v => updateMut.mutate(v))} className="space-y-4">
            <div>
              <Label>First Name</Label>
              <Input {...register('firstName')} />
            </div>
            <div>
              <Label>Last Name</Label>
              <Input {...register('lastName')} />
            </div>
            <div>
              <Label>Personal Email</Label>
              <Input type="email" {...register('personalEmail')} placeholder="personal@example.com" />
            </div>
            <div>
              <Label>Phone</Label>
              <Input {...register('phone')} placeholder="+1 555-0123" />
            </div>
            {updateMut.isError && (
              <p className="text-sm text-danger">{(updateMut.error as any)?.response?.data?.message || 'Failed to update.'}</p>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button type="submit" isLoading={updateMut.isPending}>Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
