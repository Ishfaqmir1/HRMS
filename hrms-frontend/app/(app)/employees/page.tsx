'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, X, Copy, Check } from 'lucide-react';
import { api, unwrap } from '@/lib/api-client';
import { Employee, PaginatedResult } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Label, FieldError } from '@/components/ui/input';
import { Badge, statusTone } from '@/components/ui/badge';

const ROLE_OPTIONS = [
  { value: 'employee', label: 'Employee' },
  { value: 'hr', label: 'HR' },
  { value: 'hr-manager', label: 'HR Manager' },
  { value: 'payroll-manager', label: 'Payroll Manager' },
  { value: 'recruiter', label: 'Recruiter' },
  { value: 'finance', label: 'Finance' },
  { value: 'department-head', label: 'Department Head' },
  { value: 'team-lead', label: 'Team Lead' },
  { value: 'auditor', label: 'Auditor' },
] as const;

const schema = z.object({
  employeeCode: z.string().min(1, 'Required'),
  firstName: z.string().min(1, 'Required'),
  lastName: z.string().min(1, 'Required'),
  workEmail: z.string().email('Enter a valid email').optional().or(z.literal('')),
  dateOfJoining: z.string().min(1, 'Required'),
  createLoginAccount: z.boolean().optional(),
  roleSlug: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

export default function EmployeesPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
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
    watch,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const createLoginAccount = watch('createLoginAccount');

  const createEmployee = useMutation({
    mutationFn: (values: FormValues) => api.post('/employees', values),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      const tempPw = res.data?.data?.temporaryPassword;
      if (tempPw) {
        setTempPassword(tempPw);
      } else {
        setTempPassword(null);
        reset();
        setShowForm(false);
      }
    },
  });

  function handleCreateDone() {
    setTempPassword(null);
    setCopied(false);
    reset();
    setShowForm(false);
  }

  async function copyPassword() {
    if (tempPassword) {
      await navigator.clipboard.writeText(tempPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

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
            {tempPassword ? (
              <div className="space-y-4">
                <div className="rounded-lg border border-success/30 bg-success/5 p-4">
                  <p className="mb-2 text-sm font-medium text-success">Employee created with login account!</p>
                  <p className="mb-1 text-xs text-ink-faint">Temporary password</p>
                  <div className="flex items-center gap-2">
                    <code className="rounded-md bg-ink-faint/10 px-3 py-1.5 font-mono text-sm text-ink">
                      {tempPassword}
                    </code>
                    <button
                      onClick={copyPassword}
                      className="rounded-md p-1.5 text-ink-faint transition-colors hover:bg-ink-faint/10 hover:text-ink"
                      title="Copy password"
                    >
                      {copied ? <Check size={16} className="text-success" /> : <Copy size={16} />}
                    </button>
                  </div>
                  <p className="mt-3 text-xs text-ink-faint">
                    The employee can sign in with their work email and this temporary password. They'll be prompted to
                    change it on first login.
                  </p>
                </div>
                <Button onClick={handleCreateDone} variant="secondary">
                  Done — back to list
                </Button>
              </div>
            ) : (
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
                  <Input
                    id="workEmail"
                    type="email"
                    placeholder="jane@company.com"
                    {...register('workEmail')}
                  />
                  <FieldError message={errors.workEmail?.message} />
                </div>

                {/* Login account section */}
                <div className="sm:col-span-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-border text-accent focus:ring-accent"
                      {...register('createLoginAccount')}
                    />
                    <span className="text-sm font-medium text-ink">Create login account</span>
                  </label>
                  <p className="mt-1 text-xs text-ink-faint">
                    Creates a user account with a temporary password so the employee can sign in.
                  </p>
                </div>

                {createLoginAccount && (
                  <div className="sm:col-span-2">
                    <Label htmlFor="roleSlug">Role</Label>
                    <select
                      id="roleSlug"
                      className="mt-1 block w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-ink shadow-sm transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                      {...register('roleSlug')}
                    >
                      {ROLE_OPTIONS.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                    <FieldError message={errors.roleSlug?.message} />
                  </div>
                )}

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
            )}
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
