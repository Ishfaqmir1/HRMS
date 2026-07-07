'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, X } from 'lucide-react';
import { api, unwrap } from '@/lib/api-client';
import { Employee, PaginatedResult } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Label, FieldError } from '@/components/ui/input';
import { Badge, statusTone } from '@/components/ui/badge';

const schema = z.object({
  employeeCode: z.string().min(1, 'Required'),
  firstName: z.string().min(1, 'Required'),
  lastName: z.string().min(1, 'Required'),
  workEmail: z.string().email('Enter a valid email').optional().or(z.literal('')),
  dateOfJoining: z.string().min(1, 'Required'),
});
type FormValues = z.infer<typeof schema>;

export default function EmployeesPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['employees', page, search],
    queryFn: () =>
      unwrap<PaginatedResult<Employee>>(
        api.get('/employees', { params: { page, limit: 10, search: search || undefined } }),
      ),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const createEmployee = useMutation({
    mutationFn: (values: FormValues) => api.post('/employees', values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      reset();
      setShowForm(false);
    },
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="ledger-tab font-serif text-2xl font-semibold text-ink">Employees</h1>
        <Button onClick={() => setShowForm((v) => !v)}>
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? 'Cancel' : 'Add employee'}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardContent className="pt-5">
            <form
              onSubmit={handleSubmit((values) => createEmployee.mutate(values))}
              className="grid grid-cols-1 gap-4 sm:grid-cols-2"
            >
              <div>
                <Label htmlFor="employeeCode">Employee code</Label>
                <Input id="employeeCode" placeholder="EMP-0042" {...register('employeeCode')} />
                <FieldError message={errors.employeeCode?.message} />
              </div>
              <div>
                <Label htmlFor="dateOfJoining">Date of joining</Label>
                <Input id="dateOfJoining" type="date" {...register('dateOfJoining')} />
                <FieldError message={errors.dateOfJoining?.message} />
              </div>
              <div>
                <Label htmlFor="firstName">First name</Label>
                <Input id="firstName" {...register('firstName')} />
                <FieldError message={errors.firstName?.message} />
              </div>
              <div>
                <Label htmlFor="lastName">Last name</Label>
                <Input id="lastName" {...register('lastName')} />
                <FieldError message={errors.lastName?.message} />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="workEmail">Work email</Label>
                <Input id="workEmail" type="email" placeholder="jane@company.com" {...register('workEmail')} />
                <FieldError message={errors.workEmail?.message} />
              </div>

              {createEmployee.isError && (
                <p className="sm:col-span-2 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
                  {(createEmployee.error as any)?.response?.data?.message || 'Could not create employee.'}
                </p>
              )}

              <div className="sm:col-span-2">
                <Button type="submit" isLoading={createEmployee.isPending}>
                  Save employee
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-5">
          <Input
            placeholder="Search by name, code, or email…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="mb-4 max-w-sm"
          />

          {isLoading && <p className="text-sm text-ink-faint">Loading employees…</p>}

          {data && (
            <>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wide text-ink-faint">
                    <th className="py-2 pr-4">Employee</th>
                    <th className="py-2 pr-4">Code</th>
                    <th className="py-2 pr-4">Department</th>
                    <th className="py-2 pr-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((emp) => (
                    <tr key={emp.id} className="border-b border-border last:border-0">
                      <td className="py-3 pr-4">
                        <p className="font-medium text-ink">
                          {emp.firstName} {emp.lastName}
                        </p>
                        <p className="text-xs text-ink-faint">{emp.workEmail || '—'}</p>
                      </td>
                      <td className="py-3 pr-4">
                        <span className="record-code">{emp.employeeCode}</span>
                      </td>
                      <td className="py-3 pr-4 text-ink-soft">{emp.department?.name || '—'}</td>
                      <td className="py-3 pr-4">
                        <Badge tone={statusTone(emp.status)}>{emp.status}</Badge>
                      </td>
                    </tr>
                  ))}
                  {data.items.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-ink-faint">
                        No employees found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              <div className="mt-4 flex items-center justify-between text-sm text-ink-faint">
                <span>
                  Page {data.meta.page} of {Math.max(data.meta.totalPages, 1)} · {data.meta.total} total
                </span>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    Previous
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page >= data.meta.totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
