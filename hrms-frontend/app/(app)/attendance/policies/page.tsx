'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Shield, Clock, AlertTriangle, Bell,
  Timer, DollarSign, Globe, CalendarDays,
  Save, RefreshCw, CheckCircle, XCircle, ChevronDown, ChevronUp,
} from 'lucide-react';
import { api } from '@/lib/api-client';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

// ──────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────

interface AttendancePolicy {
  id: string;
  companyId: string;
  name: string;
  timezone: string;
  workingDays: number[];
  defaultStartTime: string;
  defaultEndTime: string;
  dailyWorkingHours: number;
  breakDurationMinutes: number;
  gracePeriodMinutes: number;
  lateThresholdMinutes: number;
  veryLateThresholdMinutes: number;
  halfDayThresholdMinutes: number;
  minimumWorkingMinutes: number;
  maximumWorkingMinutes: number;
  enableOvertime: boolean;
  overtimeStartsAfterMinutes: number;
  maxOvertimeMinutes: number;
  enableAutoLateDetection: boolean;
  enableAutoHalfDay: boolean;
  enableAutoAbsent: boolean;
  enableAutoCheckout: boolean;
  autoCheckoutTime: string;
  enableRemoteWork: boolean;
  enableFlexibleShift: boolean;
  enableMultiplePunch: boolean;
  crossMidnightShift: boolean;
}

const WEEKDAYS = [
  { value: 0, label: 'Sun', full: 'Sunday' },
  { value: 1, label: 'Mon', full: 'Monday' },
  { value: 2, label: 'Tue', full: 'Tuesday' },
  { value: 3, label: 'Wed', full: 'Wednesday' },
  { value: 4, label: 'Thu', full: 'Thursday' },
  { value: 5, label: 'Fri', full: 'Friday' },
  { value: 6, label: 'Sat', full: 'Saturday' },
];

// ──────────────────────────────────────────────────────────
// Toggle Component (greytHR-style switch)
// ──────────────────────────────────────────────────────────

function ToggleSwitch({
  checked, onChange, label, description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-white p-4 transition-colors hover:bg-ink-soft/5">
      <div className="relative mt-0.5 shrink-0">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="sr-only peer" />
        <div className={`h-6 w-10 rounded-full transition-colors ${checked ? 'bg-accent' : 'bg-ink-faint/20'}`} />
        <div className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-4' : ''}`} />
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-ink">{label}</p>
        {description && <p className="text-xs text-ink-faint mt-0.5">{description}</p>}
      </div>
    </label>
  );
}

// ──────────────────────────────────────────────────────────
// Policy Number Input
// ──────────────────────────────────────────────────────────

function PolicyInput({
  label, value, onChange, suffix, min, max, step,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-ink-soft">{label}</span>
      <div className="flex items-center gap-1.5">
        <Input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value) || 0)}
          className="h-8 w-20 text-right text-sm tabular-nums"
        />
        {suffix && <span className="text-xs text-ink-faint min-w-[32px]">{suffix}</span>}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// Main Page
// ──────────────────────────────────────────────────────────

export default function AttendancePoliciesPage() {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    general: true,
    late: true,
    overtime: true,
    auto: true,
    advanced: false,
  });

  // Fetch current policy
  const { data: policy, isLoading, isError } = useQuery<AttendancePolicy>({
    queryKey: ['attendance-policy'],
    queryFn: async () => {
      const res = await api.get('/attendance-policy');
      return res.data?.data || res.data;
    },
  });

  // Local form state
  const [form, setForm] = useState<AttendancePolicy | null>(null);

  useEffect(() => {
    if (policy && !form) setForm(policy);
  }, [policy, form]);

  // Update mutation
  const updatePolicy = useMutation({
    mutationFn: async (data: Partial<AttendancePolicy>) => {
      const res = await api.patch('/attendance-policy', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-policy'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
    onSettled: () => setSaving(false),
  });

  function handleSave() {
    if (!form) return;
    setSaving(true);
    setSaved(false);
    updatePolicy.mutate(form);
  }

  function toggleDay(day: number) {
    if (!form) return;
    const days = form.workingDays.includes(day)
      ? form.workingDays.filter((d) => d !== day)
      : [...form.workingDays, day];
    setForm({ ...form, workingDays: days.sort() });
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <h1 className="font-serif text-2xl font-semibold text-ink">Attendance Policies</h1>
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bento-card"><div className="skeleton h-20" /></div>
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <h1 className="font-serif text-2xl font-semibold text-ink">Attendance Policies</h1>
        <Card>
          <CardContent className="py-12 text-center">
            <XCircle size={32} className="mx-auto mb-3 text-danger" />
            <p className="text-sm text-ink-soft">Failed to load policy configuration.</p>
            <Button variant="secondary" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ['attendance-policy'] })} className="mt-3">
              <RefreshCw size={12} className="mr-1" /> Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const f = form || policy;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* ─── Header ─── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-ink">Attendance Policies</h1>
          <p className="mt-0.5 text-sm text-ink-soft">
            Configure company-wide attendance rules, grace periods, overtime, and automation
          </p>
        </div>
        <div className="flex items-center gap-3">
          {saved && (
            <Badge tone="success" className="animate-fade-in">
              <CheckCircle size={10} className="mr-1" /> Saved
            </Badge>
          )}
          {f && (
            <Badge tone="default" className="text-xs bg-ink-soft/10">
              {f.name}
            </Badge>
          )}
          <Button onClick={handleSave} isLoading={saving} disabled={!form}>
            <Save size={14} className="mr-1.5" /> Save Changes
          </Button>
        </div>
      </div>

      {/* ─── Section: General Working Hours ─── */}
      <SectionCard
        title="Working Hours & Days"
        icon={CalendarDays}
        expanded={expandedSections.general}
        onToggle={() => setExpandedSections((s) => ({ ...s, general: !s.general }))}
      >
        {/* Working Days */}
        <div className="mb-5">
          <p className="mb-2 text-sm font-medium text-ink">Working Days</p>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((wd) => (
              <button
                key={wd.value}
                onClick={() => toggleDay(wd.value)}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  f?.workingDays.includes(wd.value)
                    ? 'border-accent bg-accent-soft text-accent'
                    : 'border-border text-ink-faint hover:border-ink-faint/30'
                }`}
                title={wd.full}
              >
                {wd.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink-soft">Default Start Time</label>
            <Input
              type="time"
              value={f?.defaultStartTime || '09:00'}
              onChange={(e) => setForm((p) => p ? { ...p, defaultStartTime: e.target.value } : p)}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink-soft">Default End Time</label>
            <Input
              type="time"
              value={f?.defaultEndTime || '18:00'}
              onChange={(e) => setForm((p) => p ? { ...p, defaultEndTime: e.target.value } : p)}
            />
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <PolicyInput
            label="Daily Working Hours"
            value={f?.dailyWorkingHours || 9}
            onChange={(v) => setForm((p) => p ? { ...p, dailyWorkingHours: v } : p)}
            suffix="hrs" min={1} max={24} step={0.5}
          />
          <PolicyInput
            label="Break Duration"
            value={f?.breakDurationMinutes || 60}
            onChange={(v) => setForm((p) => p ? { ...p, breakDurationMinutes: v } : p)}
            suffix="min" min={0} max={480}
          />
          <PolicyInput
            label="Minimum Working Hours"
            value={(f?.minimumWorkingMinutes || 480) / 60}
            onChange={(v) => setForm((p) => p ? { ...p, minimumWorkingMinutes: v * 60 } : p)}
            suffix="hrs" min={1} max={12}
          />
          <PolicyInput
            label="Maximum Working Hours"
            value={(f?.maximumWorkingMinutes || 720) / 60}
            onChange={(v) => setForm((p) => p ? { ...p, maximumWorkingMinutes: v * 60 } : p)}
            suffix="hrs" min={1} max={24}
          />
        </div>

        <div className="mt-4">
          <label className="mb-1.5 block text-sm font-medium text-ink-soft">Timezone</label>
          <Input
            value={f?.timezone || 'UTC'}
            onChange={(e) => setForm((p) => p ? { ...p, timezone: e.target.value } : p)}
            className="text-sm"
          />
        </div>
      </SectionCard>

      {/* ─── Section: Late & Grace Rules ─── */}
      <SectionCard
        title="Late Arrival & Grace Rules"
        icon={Timer}
        expanded={expandedSections.late}
        onToggle={() => setExpandedSections((s) => ({ ...s, late: !s.late }))}
      >
        <p className="mb-4 text-xs text-ink-faint">
          When an employee clocks in after their scheduled start time, the system checks these rules to determine if they are late and what status to apply.
        </p>

        <div className="space-y-3">
          <PolicyInput
            label="Grace Period"
            value={f?.gracePeriodMinutes || 15}
            onChange={(v) => setForm((p) => p ? { ...p, gracePeriodMinutes: v } : p)}
            suffix="min" min={0} max={120}
          />
          <PolicyInput
            label="Late Threshold"
            value={f?.lateThresholdMinutes || 30}
            onChange={(v) => setForm((p) => p ? { ...p, lateThresholdMinutes: v } : p)}
            suffix="min" min={0} max={240}
          />
          <PolicyInput
            label="Very Late Threshold"
            value={f?.veryLateThresholdMinutes || 60}
            onChange={(v) => setForm((p) => p ? { ...p, veryLateThresholdMinutes: v } : p)}
            suffix="min" min={0} max={480}
          />
          <PolicyInput
            label="Half-Day Threshold"
            value={f?.halfDayThresholdMinutes || 240}
            onChange={(v) => setForm((p) => p ? { ...p, halfDayThresholdMinutes: v } : p)}
            suffix="min" min={0} max={480}
          />
        </div>

        <div className="mt-5 rounded-lg bg-accent-soft/50 p-4">
          <p className="text-xs font-medium text-accent mb-1">How it works</p>
          <p className="text-xs text-ink-soft leading-relaxed">
            Clock in within grace period → <Badge tone="success" className="text-[10px]">PRESENT</Badge>{' '}
            · Past grace but within late threshold → <Badge tone="warning" className="text-[10px]">LATE</Badge>{' '}
            · Past very late threshold → <Badge tone="warning" className="text-[10px]">LATE</Badge>{' '}
            · Worked less than half-day → <Badge tone="warning" className="text-[10px]">HALF_DAY</Badge>
          </p>
        </div>
      </SectionCard>

      {/* ─── Section: Overtime ─── */}
      <SectionCard
        title="Overtime Rules"
        icon={DollarSign}
        expanded={expandedSections.overtime}
        onToggle={() => setExpandedSections((s) => ({ ...s, overtime: !s.overtime }))}
      >
        <ToggleSwitch
          checked={f?.enableOvertime ?? true}
          onChange={(v) => setForm((p) => p ? { ...p, enableOvertime: v } : p)}
          label="Enable Overtime Tracking"
          description="Automatically calculate overtime when employees work beyond their scheduled hours"
        />

        {(f?.enableOvertime ?? true) && (
          <div className="mt-4 space-y-3 pl-1">
            <PolicyInput
              label="Overtime Starts After"
              value={(f?.overtimeStartsAfterMinutes || 540) / 60}
              onChange={(v) => setForm((p) => p ? { ...p, overtimeStartsAfterMinutes: v * 60 } : p)}
              suffix="hrs" min={1} max={24}
            />
            <PolicyInput
              label="Maximum Overtime"
              value={(f?.maxOvertimeMinutes || 240) / 60}
              onChange={(v) => setForm((p) => p ? { ...p, maxOvertimeMinutes: v * 60 } : p)}
              suffix="hrs" min={0} max={12}
            />
          </div>
        )}
      </SectionCard>

      {/* ─── Section: Auto-Detection ─── */}
      <SectionCard
        title="Auto-Detection & Automation"
        icon={Bell}
        expanded={expandedSections.auto}
        onToggle={() => setExpandedSections((s) => ({ ...s, auto: !s.auto }))}
      >
        <div className="space-y-2">
          <ToggleSwitch
            checked={f?.enableAutoLateDetection ?? true}
            onChange={(v) => setForm((p) => p ? { ...p, enableAutoLateDetection: v } : p)}
            label="Auto-Detect Late Arrivals"
            description="Compare clock-in time against shift start time and automatically mark late arrivals"
          />
          <ToggleSwitch
            checked={f?.enableAutoHalfDay ?? true}
            onChange={(v) => setForm((p) => p ? { ...p, enableAutoHalfDay: v } : p)}
            label="Auto-Detect Half Days"
            description="Mark as half-day when worked minutes fall below the threshold"
          />
          <ToggleSwitch
            checked={f?.enableAutoAbsent ?? true}
            onChange={(v) => setForm((p) => p ? { ...p, enableAutoAbsent: v } : p)}
            label="Auto-Mark Absent"
            description="Mark employees as absent when they have no clock-in record for the day"
          />
          <ToggleSwitch
            checked={f?.enableAutoCheckout ?? true}
            onChange={(v) => setForm((p) => p ? { ...p, enableAutoCheckout: v } : p)}
            label="Auto Checkout"
            description="Automatically clock out employees at the configured checkout time if they forget"
          />
        </div>

        {(f?.enableAutoCheckout ?? true) && (
          <div className="mt-4">
            <label className="mb-1.5 block text-sm font-medium text-ink-soft">Auto Checkout Time</label>
            <Input
              type="time"
              value={f?.autoCheckoutTime || '23:59'}
              onChange={(e) => setForm((p) => p ? { ...p, autoCheckoutTime: e.target.value } : p)}
              className="w-32"
            />
          </div>
        )}
      </SectionCard>

      {/* ─── Section: Advanced ─── */}
      <SectionCard
        title="Advanced Settings"
        icon={Globe}
        expanded={expandedSections.advanced}
        onToggle={() => setExpandedSections((s) => ({ ...s, advanced: !s.advanced }))}
      >
        <div className="space-y-2">
          <ToggleSwitch
            checked={f?.enableRemoteWork ?? false}
            onChange={(v) => setForm((p) => p ? { ...p, enableRemoteWork: v } : p)}
            label="Enable Remote Work"
            description="Allow employees to mark attendance from outside the office (remote tracking)"
          />
          <ToggleSwitch
            checked={f?.enableFlexibleShift ?? false}
            onChange={(v) => setForm((p) => p ? { ...p, enableFlexibleShift: v } : p)}
            label="Flexible Shift"
            description="Allow employees to clock in/out within a flexible window rather than fixed times"
          />
          <ToggleSwitch
            checked={f?.enableMultiplePunch ?? false}
            onChange={(v) => setForm((p) => p ? { ...p, enableMultiplePunch: v } : p)}
            label="Multiple Punches"
            description="Allow employees to clock in and out multiple times per day"
          />
          <ToggleSwitch
            checked={f?.crossMidnightShift ?? false}
            onChange={(v) => setForm((p) => p ? { ...p, crossMidnightShift: v } : p)}
            label="Cross-Midnight Shift"
            description="Enable night shifts that span across midnight (e.g., 22:00 to 06:00)"
          />
        </div>
      </SectionCard>

      {/* ─── Floating Save Bar ─── */}
      {form && JSON.stringify(form) !== JSON.stringify(policy) && (
        <div className="sticky bottom-6 z-10 flex items-center justify-between rounded-2xl bg-ink px-6 py-4 shadow-xl">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-300" />
            <span className="text-sm text-white/90">You have unsaved changes</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" className="text-white/70 hover:text-white" onClick={() => setForm(policy!)}>
              Reset
            </Button>
            <Button size="sm" onClick={handleSave} isLoading={saving}>
              <Save size={14} className="mr-1.5" /> Save Changes
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// Section Card Sub-Component
// ──────────────────────────────────────────────────────────

function SectionCard({
  title, icon: Icon, children, expanded, onToggle,
}: {
  title: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  children: React.ReactNode;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <Card className="overflow-hidden">
      <button onClick={onToggle} className="flex w-full items-center justify-between px-6 py-4 transition-colors hover:bg-ink-soft/5">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-soft">
            <Icon size={16} className="text-accent" />
          </div>
          <CardTitle className="text-sm">{title}</CardTitle>
        </div>
        {expanded ? <ChevronUp size={16} className="text-ink-soft" /> : <ChevronDown size={16} className="text-ink-soft" />}
      </button>
      {expanded && <CardContent className="px-6 pb-6 pt-0">{children}</CardContent>}
    </Card>
  );
}
