'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api-client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Save, Palette, Shield, Settings, Globe, Clock, DollarSign,
  Wifi, WifiOff, Image, CheckCircle2, XCircle, AlertTriangle,
} from 'lucide-react';

// ──────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────

interface PlatformSettings {
  id: string;
  platformName: string;
  platformLogoUrl: string | null;
  platformFaviconUrl: string | null;
  platformPrimaryColor: string;
  platformSecondaryColor: string;
  platformAccentColor: string;
  maintenanceMode: boolean;
  maintenanceMessage: string | null;
  emailFooter: string | null;
  defaultTimezone: string;
  defaultLocale: string;
  defaultCurrency: string;
  createdAt: string;
  updatedAt: string;
}

// ──────────────────────────────────────────────────────────────────
// Color Picker Field
// ──────────────────────────────────────────────────────────────────

function ColorField({ label, value, onChange }: {
  label: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-ink-faint">{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-9 cursor-pointer rounded-lg border border-border bg-white p-0.5"
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#000000"
          className="font-mono text-xs flex-1"
        />
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Main Page
// ──────────────────────────────────────────────────────────────────

export default function AdminPlatformSettingsPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<PlatformSettings | null>(null);
  const [formInitialized, setFormInitialized] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Fetch settings
  const { data: settings, isLoading, refetch } = useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: () => unwrap<PlatformSettings>(api.get('/admin/settings')),
    staleTime: 30_000,
  });

  // Initialize form when data loads
  useEffect(() => {
    if (settings && !formInitialized) {
      setForm(settings);
      setFormInitialized(true);
    }
  }, [settings, formInitialized]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: (data: Partial<PlatformSettings>) => api.patch('/admin/settings', data),
    onSuccess: () => {
      setSaveSuccess(true);
      refetch();
      queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] });
      setTimeout(() => setSaveSuccess(false), 3000);
    },
  });

  // Toggle maintenance mode
  const maintMutation = useMutation({
    mutationFn: (data: { enabled: boolean; message?: string }) =>
      api.post('/admin/settings/maintenance', data),
    onSuccess: () => {
      refetch();
      queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] });
    },
  });

  function updateField<K extends keyof PlatformSettings>(key: K, value: PlatformSettings[K]) {
    if (!form) return;
    setForm({ ...form, [key]: value });
    setSaveSuccess(false);
  }

  function handleSave() {
    if (!form) return;
    saveMutation.mutate({
      platformName: form.platformName,
      platformLogoUrl: form.platformLogoUrl || undefined,
      platformFaviconUrl: form.platformFaviconUrl || undefined,
      platformPrimaryColor: form.platformPrimaryColor,
      platformSecondaryColor: form.platformSecondaryColor,
      platformAccentColor: form.platformAccentColor,
      maintenanceMessage: form.maintenanceMessage || undefined,
      emailFooter: form.emailFooter || undefined,
      defaultTimezone: form.defaultTimezone,
      defaultLocale: form.defaultLocale,
      defaultCurrency: form.defaultCurrency,
    });
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl py-12">
        <div className="flex items-center justify-center py-16">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-accent" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Settings size={16} className="text-accent" />
            <span className="text-xs font-medium text-accent uppercase tracking-wider">Platform Configuration</span>
          </div>
          <h1 className="font-serif text-2xl font-semibold text-ink">Platform Settings</h1>
          <p className="mt-1 text-sm text-ink-faint">
            Configure platform-wide branding, maintenance mode, and default company settings
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" isLoading={saveMutation.isPending} onClick={handleSave}>
            <Save size={14} className="mr-1.5" />
            Save All Changes
          </Button>
          {saveSuccess && (
            <span className="flex items-center gap-1 text-xs text-accent">
              <CheckCircle2 size={12} /> Saved
            </span>
          )}
        </div>
      </div>

      {!form && (
        <div className="rounded-xl border border-danger/20 bg-danger/5 p-6 text-center">
          <AlertTriangle size={24} className="mx-auto mb-2 text-danger/60" />
          <p className="text-sm text-danger">Could not load platform settings.</p>
        </div>
      )}

      {/* ── Branding ─────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Palette size={16} className="text-accent" />
            <CardTitle className="text-base">Platform Branding</CardTitle>
          </div>
          <p className="text-xs text-ink-faint">
            These settings apply to the platform header, login page, and all outbound communications.
            This is separate from per-company branding.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Brand Name */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Platform Name</Label>
              <Input
                value={form?.platformName || ''}
                onChange={(e) => updateField('platformName', e.target.value)}
                placeholder="HRMS"
              />
            </div>
          </div>

          {/* Colors */}
          <div>
            <p className="text-xs font-semibold text-ink-faint uppercase tracking-wider mb-3">Brand Colors</p>
            <div className="grid gap-4 sm:grid-cols-3">
              <ColorField label="Primary Color" value={form?.platformPrimaryColor || '#0B6E63'} onChange={(v) => updateField('platformPrimaryColor', v)} />
              <ColorField label="Secondary Color" value={form?.platformSecondaryColor || '#10192B'} onChange={(v) => updateField('platformSecondaryColor', v)} />
              <ColorField label="Accent Color" value={form?.platformAccentColor || '#4DB6A8'} onChange={(v) => updateField('platformAccentColor', v)} />
            </div>
            {/* Color Preview */}
            <div className="mt-3 flex items-center gap-3">
              <div className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-white font-medium" style={{ backgroundColor: form?.platformPrimaryColor || '#0B6E63' }}>
                Primary
              </div>
              <div className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-white font-medium" style={{ backgroundColor: form?.platformSecondaryColor || '#10192B' }}>
                Secondary
              </div>
              <div className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-white font-medium" style={{ backgroundColor: form?.platformAccentColor || '#4DB6A8' }}>
                Accent
              </div>
            </div>
          </div>

          {/* Image URLs */}
          <div>
            <p className="text-xs font-semibold text-ink-faint uppercase tracking-wider mb-3">Images</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Platform Logo URL</Label>
                <Input
                  value={form?.platformLogoUrl || ''}
                  onChange={(e) => updateField('platformLogoUrl', e.target.value)}
                  placeholder="https://cdn.example.com/logo.png"
                />
                {form?.platformLogoUrl && (
                  <div className="mt-2 flex items-center gap-2">
                    <img src={form.platformLogoUrl} alt="Logo preview" className="h-8 w-8 rounded object-contain border border-border" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    <span className="text-[10px] text-ink-faint">Preview</span>
                  </div>
                )}
              </div>
              <div>
                <Label>Favicon URL</Label>
                <Input
                  value={form?.platformFaviconUrl || ''}
                  onChange={(e) => updateField('platformFaviconUrl', e.target.value)}
                  placeholder="https://cdn.example.com/favicon.ico"
                />
              </div>
            </div>
          </div>

          {/* Email Footer */}
          <div>
            <Label>Email Footer (HTML)</Label>
            <textarea
              className="flex min-h-[80px] w-full rounded-xl border border-input bg-white px-3.5 py-2 text-sm text-ink ring-offset-background placeholder:text-ink-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:border-accent/40 transition-all duration-200 font-mono text-xs"
              value={form?.emailFooter || ''}
              onChange={(e) => updateField('emailFooter', e.target.value)}
              placeholder="<p>Powered by HRMS - Enterprise Platform</p>"
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Maintenance Mode ─────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-accent" />
            <CardTitle className="text-base">Maintenance Mode</CardTitle>
          </div>
          <p className="text-xs text-ink-faint">
            When enabled, all users will see a maintenance page and cannot access the platform.
            Super admins can still log in.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-xl border border-border p-4">
            <div className="flex items-center gap-3">
              {form?.maintenanceMode ? (
                <WifiOff size={20} className="text-danger" />
              ) : (
                <Wifi size={20} className="text-accent" />
              )}
              <div>
                <p className="text-sm font-medium text-ink">
                  Maintenance Mode is {form?.maintenanceMode ? 'ACTIVE' : 'INACTIVE'}
                </p>
                <p className="text-xs text-ink-faint">
                  {form?.maintenanceMode
                    ? 'All users (except super admins) are blocked from accessing the platform.'
                    : 'The platform is fully accessible to all users.'}
                </p>
              </div>
            </div>
            <Button
              variant={form?.maintenanceMode ? 'destructive' : 'default'}
              size="sm"
              isLoading={maintMutation.isPending}
              onClick={() => maintMutation.mutate({ enabled: !form?.maintenanceMode, message: form?.maintenanceMessage || undefined })}
            >
              {form?.maintenanceMode ? (
                <><XCircle size={14} className="mr-1" /> Disable</>
              ) : (
                <><Shield size={14} className="mr-1" /> Enable</>
              )}
            </Button>
          </div>

          {form?.maintenanceMode && (
            <div>
              <Label>Maintenance Message</Label>
              <textarea
                className="flex min-h-[80px] w-full rounded-xl border border-input bg-white px-3.5 py-2 text-sm text-ink ring-offset-background placeholder:text-ink-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:border-accent/40 transition-all duration-200"
                value={form?.maintenanceMessage || ''}
                onChange={(e) => updateField('maintenanceMessage', e.target.value)}
                placeholder="We are performing scheduled maintenance. Please check back shortly."
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Default Company Settings ─────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Globe size={16} className="text-accent" />
            <CardTitle className="text-base">Default Company Settings</CardTitle>
          </div>
          <p className="text-xs text-ink-faint">
            These defaults are applied when a new company registers. They can be overridden per company.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label className="flex items-center gap-1.5">
                <Globe size={12} className="text-ink-faint" /> Default Timezone
              </Label>
              <Input
                value={form?.defaultTimezone || 'UTC'}
                onChange={(e) => updateField('defaultTimezone', e.target.value)}
                placeholder="UTC"
              />
            </div>
            <div>
              <Label className="flex items-center gap-1.5">
                <Clock size={12} className="text-ink-faint" /> Default Locale
              </Label>
              <Input
                value={form?.defaultLocale || 'en'}
                onChange={(e) => updateField('defaultLocale', e.target.value)}
                placeholder="en"
              />
            </div>
            <div>
              <Label className="flex items-center gap-1.5">
                <DollarSign size={12} className="text-ink-faint" /> Default Currency
              </Label>
              <Input
                value={form?.defaultCurrency || 'USD'}
                onChange={(e) => updateField('defaultCurrency', e.target.value)}
                placeholder="USD"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
