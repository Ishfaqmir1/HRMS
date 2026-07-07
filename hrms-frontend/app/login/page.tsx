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
  companySlug: z.string().min(1, 'Enter your company workspace').optional().or(z.literal('')),
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Enter your password'),
});
type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
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
      const { data } = await api.post('/auth/login', {
        email: values.email,
        password: values.password,
        companySlug: values.companySlug || undefined,
      });
      const { accessToken, refreshToken } = data.data;
      saveSession({ accessToken, refreshToken });
      router.push('/dashboard');
    } catch (err: any) {
      setServerError(err?.response?.data?.message || 'Login failed. Check your credentials.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="ledger-tab justify-center font-serif text-2xl font-semibold text-ink">HRMS</p>
          <p className="mt-2 text-sm text-ink-faint">Sign in to your workspace</p>
        </div>

        <Card>
          <CardContent className="pt-5">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <Label htmlFor="companySlug">Company workspace</Label>
                <Input
                  id="companySlug"
                  placeholder="acme-corp (leave blank for Super Admin)"
                  {...register('companySlug')}
                />
                <FieldError message={errors.companySlug?.message} />
              </div>

              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="you@company.com" {...register('email')} />
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
                Sign in
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-sm text-ink-faint">
          New company?{' '}
          <Link href="/register" className="font-medium text-accent hover:underline">
            Create a workspace
          </Link>
        </p>
      </div>
    </div>
  );
}
