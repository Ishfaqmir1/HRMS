'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Pencil, Trash2, Building2, Users } from 'lucide-react';
import { api, unwrap } from '@/lib/api-client';
import { Department, PaginatedResult, Branch } from '@/lib/types';
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
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';

const departmentSchema = z.object({
  name: z.string().min(1, 'Department name is required'),
  code: z.string().optional(),
  parentId: z.string().optional(),
  branchId: z.string().optional(),
  isActive: z.boolean().default(true),
});
type DepartmentForm = z.infer<typeof departmentSchema>;

interface DepartmentWithRelations extends Department {
  branch?: { id: string; name: string } | null;
  parent?: { id: string; name: string } | null;
  _count?: { employees: number; children: number };
}

export default function DepartmentsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [editingDept, setEditingDept] = useState<DepartmentWithRelations | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['departments', page, search],
    queryFn: () =>
      unwrap<PaginatedResult<DepartmentWithRelations>>(
        api.get('/departments', { params: { page, limit: 20, search: search || undefined } }),
      ),
  });

  const { data: branches } = useQuery({
    queryKey: ['branches', 'list'],
    queryFn: () => unwrap<PaginatedResult<Branch>>(api.get('/branches', { params: { limit: 100 } })),
  });

  const { data: allDepts } = useQuery({
    queryKey: ['departments', 'parents'],
    queryFn: () => unwrap<PaginatedResult<DepartmentWithRelations>>(api.get('/departments', { params: { limit: 100 } })),
    enabled: showDialog,
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<DepartmentForm>({
    resolver: zodResolver(departmentSchema),
    defaultValues: { isActive: true },
  });

  function openCreate() {
    setEditingDept(null);
    reset({ name: '', code: '', parentId: '', branchId: '', isActive: true });
    setShowDialog(true);
  }

  function openEdit(dept: DepartmentWithRelations) {
    setEditingDept(dept);
    setValue('name', dept.name);
    setValue('code', dept.code || '');
    setValue('parentId', dept.parent?.id || '');
    setValue('branchId', dept.branch?.id || '');
    setValue('isActive', true);
    setShowDialog(true);
  }

  const saveMutation = useMutation({
    mutationFn: (values: DepartmentForm) => {
      const payload = {
        name: values.name,
        code: values.code || undefined,
        parentId: values.parentId || undefined,
        branchId: values.branchId || undefined,
      };
      return editingDept
        ? api.patch(`/departments/${editingDept.id}`, payload)
        : api.post('/departments', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      setShowDialog(false);
      setEditingDept(null);
      reset();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/departments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      setDeleteId(null);
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['departments'] });

  const totalPages = data?.meta?.totalPages ?? 1;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="ledger-tab font-serif text-2xl font-semibold text-ink">Departments</h1>
          <p className="mt-0.5 text-sm text-ink-soft">Manage organizational departments and sub-departments</p>
        </div>
        <Button onClick={openCreate}>
          <Plus size={16} className="mr-1" /> Create Department
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Building2 size={14} className="text-ink-soft" />
              All Departments
              {data && (
                <span className="text-xs font-normal text-ink-faint">
                  ({data.meta.total})
                </span>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Input
                placeholder="Search departments..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="h-8 w-48 text-xs"
              />
              <Button variant="ghost" size="sm" onClick={() => invalidate()} className="h-8 text-xs">
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 p-5">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="skeleton h-10 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Parent</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Employees</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.items.map((dept) => (
                  <TableRow key={dept.id}>
                    <TableCell className="font-medium text-ink">{dept.name}</TableCell>
                    <TableCell className="text-ink-soft">
                      {dept.code ? <Badge variant="default">{dept.code}</Badge> : '—'}
                    </TableCell>
                    <TableCell className="text-ink-soft">{dept.parent?.name || '—'}</TableCell>
                    <TableCell className="text-ink-soft">{dept.branch?.name || '—'}</TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1 text-sm text-ink-soft">
                        <Users size={12} />
                        {(dept as any)._count?.employees ?? 0}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => openEdit(dept)}
                          className="rounded-md p-1.5 text-ink-faint transition-colors hover:bg-accent-soft hover:text-accent"
                          title="Edit"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => setDeleteId(dept.id)}
                          className="rounded-md p-1.5 text-ink-faint transition-colors hover:bg-danger-soft hover:text-danger"
                          title="Delete"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {(!data || data.items.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-12 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <Building2 size={24} className="text-ink-faint" />
                        <p className="text-sm text-ink-faint">No departments found.</p>
                        <p className="text-xs text-ink-faint">Create your first department to get started.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}

          {/* Pagination */}
          {data && data.meta.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border px-5 py-3">
              <p className="text-xs text-ink-faint">
                Page {data.meta.page} of {data.meta.totalPages}
              </p>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                  Previous
                </Button>
                <Button variant="ghost" size="sm" disabled={page >= data.meta.totalPages} onClick={() => setPage((p) => p + 1)}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={(o) => { if (!o) { setShowDialog(false); setEditingDept(null); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingDept ? 'Edit Department' : 'Create Department'}</DialogTitle>
            <DialogDescription>
              {editingDept ? 'Update department details.' : 'Add a new department to your organization.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit((values) => saveMutation.mutate(values))} className="space-y-4">
            <div>
              <Label htmlFor="name">Department Name *</Label>
              <Input id="name" placeholder="e.g. Engineering" {...register('name')} />
              <FieldError message={errors.name?.message} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="code">Code</Label>
                <Input id="code" placeholder="e.g. ENG" {...register('code')} />
              </div>
              <div>
                <Label htmlFor="branch">Branch</Label>
                <select
                  id="branch"
                  {...register('branchId')}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-accent/30"
                >
                  <option value="">No branch</option>
                  {branches?.items?.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <Label htmlFor="parentId">Parent Department</Label>
              <select
                id="parentId"
                {...register('parentId')}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-accent/30"
              >
                <option value="">No parent (top-level)</option>
                {allDepts?.items
                  ?.filter((d) => d.id !== editingDept?.id)
                  .map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
              </select>
            </div>
            {saveMutation.isError && (
              <p className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
                {(saveMutation.error as any)?.response?.data?.message || 'Could not save department.'}
              </p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
              <Button type="submit" isLoading={saveMutation.isPending}>
                {editingDept ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteId} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Department</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this department? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              isLoading={deleteMutation.isPending}
            >
              <Trash2 size={14} className="mr-1" /> Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
