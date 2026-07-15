'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle2, XCircle, Clock, Building2, Users, Timer,
  CalendarDays, ShieldCheck, Palette, HardDrive, Loader2, Sparkles,
} from 'lucide-react';

interface SetupStatus {
  setupCompleted: boolean;
  setupSkipped: boolean;
  skippedAt: string | null;
  isActive: boolean;
  status: string;
  setupRequired: boolean;
}

const SETUP_STEPS = [
  { id: 'branch', label: 'Head Office Branch', icon: Building2, description: 'Default primary branch' },
  { id: 'department', label: 'General Department', icon: Users, description: 'Default department for employees' },
  { id: 'shift', label: 'General Shift', icon: Timer, description: 'Mon-Fri 9:00 AM - 6:00 PM' },
  { id: 'leave_types', label: 'Leave Types', icon: CalendarDays, description: 'Annual, Sick & Personal Leave' },
  { id: 'policy', label: 'Attendance Policy', icon: Clock, description: 'Default attendance rules' },
  { id: 'security', label: 'Security Config', icon: ShieldCheck, description: 'Attendance security defaults' },
  { id: 'compliance', label: 'Compliance Config', icon: HardDrive, description: 'PF, ESI, PT, TDS defaults' },
  { id: 'branding', label: 'Branding', icon: Palette, description: 'Default company branding' },
];

export default function SetupWizardPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(-1);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [skipping, setSkipping] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Fetch setup status
  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ['setup-status'],
    queryFn: () => unwrap<SetupStatus>(api.get('/setup/status')),
  });

  const runMutation = useMutation({
    mutationFn: () => api.post('/setup/run'),
    onSuccess: () => {
      setCurrentStep(SETUP_STEPS.length); // mark all complete
    },
    onError: (err: any) => {
      setError(err?.response?.data?.message || 'Setup failed. Please try again.');
    },
  });

  const skipMutation = useMutation({
    mutationFn: () => api.post('/setup/skip'),
    onSuccess: () => {
      setSkipping(true);
      setTimeout(() => router.push('/dashboard'), 1000);
    },
  });

  // Animate through steps when running
  useEffect(() => {
    if (runMutation.isPending && currentStep < SETUP_STEPS.length - 1) {
      const timer = setTimeout(() => {
        const nextStep = currentStep + 1;
        setCurrentStep(nextStep);
        setCompletedSteps((prev) => {
          const next = new Set(prev);
          next.add(SETUP_STEPS[nextStep - 1]?.id);
          return next;
        });
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [runMutation.isPending, currentStep]);

  // Start animation when mutation begins
  useEffect(() => {
    if (runMutation.isPending && currentStep === -1) {
      setCurrentStep(0);
      setError(null);
    }
  }, [runMutation.isPending, currentStep]);

  // Redirect if not required
  useEffect(() => {
    if (!statusLoading && status && !status.setupRequired && !dismissed) {
      const timer = setTimeout(() => router.push('/dashboard'), 2000);
      return () => clearTimeout(timer);
    }
  }, [status, statusLoading, dismissed, router]);

  if (statusLoading) {
    return (
      <div className="mx-auto max-w-2xl py-12">
        <div className="flex items-center justify-center py-16">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-accent" />
        </div>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="mx-auto max-w-2xl py-12">
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center">
            <XCircle size={40} className="mb-3 text-danger" />
            <p className="text-sm text-ink-faint">Could not load setup status.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!status.setupRequired && !runMutation.isSuccess) {
    return (
      <div className="mx-auto max-w-2xl py-12">
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center">
            <CheckCircle2 size={40} className="mb-3 text-accent" />
            <p className="text-lg font-medium text-ink">
              {status.setupCompleted ? 'Setup already completed' : 'Setup not required'}
            </p>
            <p className="mt-1 text-sm text-ink-faint">Your workspace is ready to use.</p>
            <Button className="mt-6" onClick={() => { setDismissed(true); router.push('/dashboard'); }}>
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isRunning = runMutation.isPending;
  const isComplete = runMutation.isSuccess;
  const allStepsDone = completedSteps.size >= SETUP_STEPS.length;

  return (
    <div className="mx-auto max-w-2xl py-8">
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10 shadow-sm">
          <Sparkles size={28} className="text-accent" />
        </div>
        <h1 className="font-serif text-2xl font-semibold text-ink">
          {isComplete ? 'Setup Complete!' : 'Welcome to Your Workspace'}
        </h1>
        <p className="mt-1.5 text-sm text-ink-faint max-w-md mx-auto">
          {isComplete
            ? 'Your workspace has been configured with default settings. You can customize everything later.'
            : 'Let\'s get your workspace ready. We\'ll create the default structure so you can start right away.'
          }
        </p>
      </div>

      {/* Error message */}
      {error && (
        <div className="mb-6 rounded-xl border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      {/* Setup Steps */}
      <Card className="overflow-hidden">
        <div className="divide-y divide-border">
          {SETUP_STEPS.map((step, index) => {
            const isActive = currentStep === index && isRunning;
            const isDone = completedSteps.has(step.id) || (isRunning && index < currentStep);
            const isCompleteAll = isComplete && !isRunning;

            return (
              <div
                key={step.id}
                className={`flex items-center gap-4 px-6 py-4 transition-colors ${
                  isActive ? 'bg-accent/5' : ''
                } ${isDone || isCompleteAll ? 'opacity-80' : ''}`}
              >
                {/* Status icon */}
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full">
                  {(isDone || isCompleteAll) ? (
                    <CheckCircle2 size={20} className="text-accent" />
                  ) : isActive ? (
                    <Loader2 size={18} className="animate-spin text-accent" />
                  ) : (
                    <div className="h-5 w-5 rounded-full border-2 border-border" />
                  )}
                </div>

                {/* Step content */}
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-medium ${isDone || isCompleteAll ? 'text-ink' : isActive ? 'text-accent' : 'text-ink-faint'}`}>
                    {step.label}
                  </p>
                  <p className="text-xs text-ink-faint mt-0.5">{step.description}</p>
                </div>

                {/* Icon */}
                <step.icon
                  size={16}
                  className={`flex-shrink-0 ${
                    isDone || isCompleteAll ? 'text-ink-faint/60' : 'text-ink-faint/30'
                  }`}
                />
              </div>
            );
          })}
        </div>
      </Card>

      {/* Actions */}
      {!isRunning && !isComplete && (
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button
            size="lg"
            className="sm:min-w-[200px]"
            onClick={() => runMutation.mutate()}
            isLoading={runMutation.isPending}
          >
            <Sparkles size={16} className="mr-2" />
            Run Setup Wizard
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={() => {
              setSkipping(true);
              skipMutation.mutate();
            }}
            isLoading={skipMutation.isPending}
          >
            Skip for Now
          </Button>
        </div>
      )}

      {/* Success actions */}
      {isComplete && (
        <div className="mt-6 flex flex-col items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-accent">
            <CheckCircle2 size={16} />
            All default entities created successfully
          </div>
          <div className="flex gap-3">
            <Button onClick={() => router.push('/dashboard')}>
              Go to Dashboard
            </Button>
            <Button variant="outline" onClick={() => router.push('/dashboard')}>
              Go to Dashboard
            </Button>
          </div>
        </div>
      )}

      {/* Skipping indicator */}
      {skipping && (
        <div className="mt-6 text-center text-sm text-ink-faint">
          Redirecting to dashboard...
        </div>
      )}
    </div>
  );
}
