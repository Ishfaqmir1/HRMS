'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Pencil } from 'lucide-react';
import { api, unwrap } from '@/lib/api-client';
import { ReimbursementCategory } from '@/lib/types';
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

function fmt(v: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v);
}

const schema = z.object({
  name: z.string().min(1, 'Required'),
  description: z.string().optional(),
  maxAmount: z.coerce.number().min(0).optional(),
});
type FormValues = z.infer<typeof schema>;

export default function ReimbursementCategoriesPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ReimbursementCategory | null>(null);

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['payroll', 'reimbursement-categories'],
    queryFn: () => unwrap<ReimbursementCategory[]>(api.get('/payroll/reimbursement-categories')),
  });

  function openCreate() {
    setEditing(null);
    reset({ name: '', description: '', maxAmount: undefined });
    setShowForm(true);
  }

  function openEdit(cat: ReimbursementCategory) {
    setEditing(cat);
    setValue('name', cat.name);
    setValue('description', cat.description ?? '');
    setValue('maxAmount', cat.maxAmount ?? undefined);
    setShowForm(true);
  }

  const saveMut = useMutation({
    mutationFn: (values: FormValues) =>
      editing
        ? api.patch(`/payroll/reimbursement-categories/${editing.id}`, values)
        : api.post('/payroll/reimbursement-categories', values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll', 'reimbursement-categories'] });
      setShowForm(false);
      setEditing(null);
      reset();
    },
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="ledger-tab font-serif text-2xl font-semibold text-ink">Reimbursement Categories</h1>
          <p className="mt-1 text-sm text-ink-faint">
            Define expense categories that employees can claim reimbursements against.
          </p>
        </div>
        <Button onClick={openCreate}><Plus size={16} /> Create category</Button>
      </div>

      <Card>
        <CardContent className="pt-5">
          {isLoading && <p className="text-sm text-ink-faint">Loading categories…</p>}
          {data && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Max Amount</TableHead>
                  <TableHead className="w-24 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((cat) => (
                  <TableRow key={cat.id}>
                    <TableCell className="font-medium text-ink">{cat.name}</TableCell>
                    <TableCell className="text-ink-soft max-w-xs truncate">
                      {cat.description || '—'}
                    </TableCell>
                    <TableCell>
                      {cat.maxAmount ? (
                        <Badge variant="default">{fmt(cat.maxAmount)}</Badge>
                      ) : (
                        <span className="text-ink-faint text-sm">Unlimited</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(cat)}>
                        <Pencil size={14} /> Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {data.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-ink-faint">
                      No reimbursement categories defined yet. Create one to get started.
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
            <DialogTitle>{editing ? 'Edit Category' : 'Create Category'}</DialogTitle>
            <DialogDescription>
              {editing
                ? 'Update the category name, description, or maximum amount.'
                : 'Define a new expense category for reimbursement claims.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit((values) => saveMut.mutate(values))} className="space-y-4">
            <div>
              <Label htmlFor="name">Name *</Label>
              <Input id="name" placeholder="Travel, Meals, Medical, etc." {...register('name')} />
              <FieldError message={errors.name?.message} />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <textarea
                id="description"
                {...register('description')}
                className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"
                placeholder="Eligible expenses and guidelines..."
              />
            </div>
            <div>
              <Label htmlFor="maxAmount">Maximum amount per claim ($)</Label>
              <Input
                id="maxAmount"
                type="number"
                step="0.01"
                min={0}
                placeholder="Leave empty for unlimited"
                {...register('maxAmount')}
              />
              <p className="mt-1 text-xs text-ink-faint">
                Leave empty for no limit.
              </p>
            </div>
            {saveMut.isError && (
              <p className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
                {(saveMut.error as any)?.response?.data?.message || 'Could not save category.'}
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
    </div>
  );
}
