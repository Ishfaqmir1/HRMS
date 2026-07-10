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
import { Lock, Mail, Building2, User } from 'lucide-react';

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
    } catch (err: unknown) {
      const message = (err as any)?.response?.data?.message || (err instanceof Error ? err.message : 'Could not create your workspace.');
      setServerError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page-bg flex min-h-screen items-center justify-center px-4 py-10">
      <div className="auth-card-enter w-full max-w-md">
        {/* Brand Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10 shadow-sm shadow-accent/10">
            <span className="font-serif text-2xl font-bold text-accent">H</span>
          </div>
          <h1 className="font-serif text-2xl font-semibold tracking-tight text-ink">
            Create your workspace
          </h1>
          <p className="mt-1.5 text-sm text-ink-faint">Set up your company in minutes</p>
        </div>

        <Card className="shadow-lg shadow-ink/[0.04]">
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName">First name</Label>
                  <div className="relative">
                    <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
                    <Input id="firstName" placeholder="John" className="pl-10" {...register('firstName')} />
                  </div>
                  <FieldError message={errors.firstName?.message} />
                </div>
                <div>
                  <Label htmlFor="lastName">Last name</Label>
                  <Input id="lastName" placeholder="Doe" {...register('lastName')} />
                  <FieldError message={errors.lastName?.message} />
                </div>
              </div>

              <div>
                <Label htmlFor="companyName">Company name</Label>
                <div className="relative">
                  <Building2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
                  <Input id="companyName" placeholder="Acme Corporation" className="pl-10" {...register('companyName')} />
                </div>
                <FieldError message={errors.companyName?.message} />
              </div>

              <div>
                <Label htmlFor="companySlug">Workspace slug</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-faint">/</span>
                  <Input id="companySlug" placeholder="acme-corp" className="pl-8" {...register('companySlug')} />
                </div>
                <FieldError message={errors.companySlug?.message} />
              </div>

              <div>
                <Label htmlFor="email">Work email</Label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
                  <Input id="email" type="email" placeholder="you@acme.com" className="pl-10" {...register('email')} />
                </div>
                <FieldError message={errors.email?.message} />
              </div>

              <div>
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
                  <Input id="password" type="password" placeholder="••••••••" className="pl-10" {...register('password')} />
                </div>
                <FieldError message={errors.password?.message} />
              </div>

              {serverError && (
                <div className="rounded-xl border border-danger/20 bg-danger/5 px-3.5 py-2.5">
                  <p className="text-sm font-medium text-danger">{serverError}</p>
                </div>
              )}

              <Button type="submit" className="w-full" size="lg" isLoading={submitting}>
                Create workspace
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-sm text-ink-faint">
          Already have a workspace?{' '}
          <Link href="/login" className="font-medium text-accent transition-colors hover:text-accent-hover">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
