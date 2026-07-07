'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api-client';
import { saveSession } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input, Label, FieldError } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';

const schema = z.object({
  companyName: z.string().min(2, 'Enter your company name'),
  companySlug: z
    .string()
    .min(2, 'Enter a workspace slug')
    .regex(/^[a-z0-9-]+$/, 'Lowercase letters, numbers, and hyphens only'),
  firstName: z.string().min(1, 'Required'),
  lastName: z.string().min(1, 'Required'),
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'At least 8 characters'),
});
type FormValues = z.infer<typeof schema>;

export default function RegisterPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    setServerError(null);
    setSubmitting(true);
    try {
      const { data } = await api.post('/auth/register', values);
      const { accessToken, refreshToken } = data.data;
      saveSession({ accessToken, refreshToken });
      router.push('/dashboard');
    } catch (err: any) {
      setServerError(err?.response?.data?.message || 'Could not create your workspace.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <p className="ledger-tab justify-center font-serif text-2xl font-semibold text-ink">HRMS</p>
          <p className="mt-2 text-sm text-ink-faint">Create your company workspace</p>
        </div>

        <Card>
          <CardContent className="pt-5">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
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
              </div>

              <div>
                <Label htmlFor="companyName">Company name</Label>
                <Input id="companyName" placeholder="Acme Corporation" {...register('companyName')} />
                <FieldError message={errors.companyName?.message} />
              </div>

              <div>
                <Label htmlFor="companySlug">Workspace slug</Label>
                <Input id="companySlug" placeholder="acme-corp" {...register('companySlug')} />
                <FieldError message={errors.companySlug?.message} />
              </div>

              <div>
                <Label htmlFor="email">Work email</Label>
                <Input id="email" type="email" placeholder="you@acme.com" {...register('email')} />
                <FieldError message={errors.email?.message} />
              </div>

              <div>
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" placeholder="••••••••" {...register('password')} />
                <FieldError message={errors.password?.message} />
              </div>

              {serverError && (
                <p className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{serverError}</p>
              )}

              <Button type="submit" className="w-full" isLoading={submitting}>
                Create workspace
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-sm text-ink-faint">
          Already have a workspace?{' '}
          <Link href="/login" className="font-medium text-accent hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
