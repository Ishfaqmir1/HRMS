'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api-client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Save, Upload, Palette, Image, FileSignature, MapPin, Building2, Eye, Loader2 } from 'lucide-react';

interface BrandingData {
  id?: string;
  enabled: boolean;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  companyName: string | null;
  companyAddress: string | null;
  companyCity: string | null;
  companyState: string | null;
  companyPostalCode: string | null;
  signatureImageUrl: string | null;
  signatureEnabled: boolean;
  signatureTitle: string | null;
  customDomain: string | null;
  emailFooter: string | null;
}

const DEFAULTS: BrandingData = {
  enabled: false,
  primaryColor: '#0B6E63',
  secondaryColor: '#10192B',
  accentColor: '#4DB6A8',
  logoUrl: null,
  faviconUrl: null,
  companyName: null,
  companyAddress: null,
  companyCity: null,
  companyState: null,
  companyPostalCode: null,
  signatureImageUrl: null,
  signatureEnabled: false,
  signatureTitle: null,
  customDomain: null,
  emailFooter: null,
};

/** Upload a file to /upload/branding and return the URL */
async function uploadFile(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await api.post('/upload/branding', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data.data.url;
}

export default function BrandingSettingsPage() {
  const queryClient = useQueryClient();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const sigInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<BrandingData>(DEFAULTS);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingSig, setUploadingSig] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['billing', 'branding'],
    queryFn: () => unwrap<BrandingData | null>(api.get('/billing/branding')).catch(() => null),
  });

  useEffect(() => {
    if (data) {
      setForm({ ...DEFAULTS, ...data });
    }
  }, [data]);

  const saveMut = useMutation({
    mutationFn: (payload: Partial<BrandingData>) => api.patch('/billing/branding', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing'] });
    },
  });

  const update = <K extends keyof BrandingData>(key: K, value: BrandingData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const url = await uploadFile(file);
      update('logoUrl', url);
      update('enabled', true);
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSignatureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingSig(true);
    try {
      const url = await uploadFile(file);
      update('signatureImageUrl', url);
      update('signatureEnabled', true);
      update('enabled', true);
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setUploadingSig(false);
    }
  };

  const handleSave = () => {
    saveMut.mutate(form);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={24} className="animate-spin text-ink-faint" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-ink">Branding Settings</h1>
          <p className="mt-1 text-sm text-ink-faint">
            Customize your company brand — logo, colors, signature, and address for documents &amp; payslips
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowPreview(!showPreview)}>
            <Eye size={14} /> {showPreview ? 'Hide Preview' : 'Show Preview'}
          </Button>
          <Button size="sm" onClick={handleSave} isLoading={saveMut.isPending}>
            <Save size={14} /> Save Branding
          </Button>
        </div>
      </div>

      {saveMut.isSuccess && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Branding settings saved successfully! Documents and payslips will now use your custom branding.
        </div>
      )}
      {saveMut.isError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Failed to save branding settings. Please try again.
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main settings column */}
        <div className="space-y-6 lg:col-span-2">
          {/* Company Identity */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 size={16} className="text-accent" /> Company Identity
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label>Company Name (on documents)</Label>
                  <Input
                    value={form.companyName || ''}
                    onChange={(e) => update('companyName', e.target.value || null)}
                    placeholder="Your Company Name"
                  />
                  <p className="mt-1 text-[11px] text-ink-faint">Appears on payslips, offer letters, etc.</p>
                </div>
                <div>
                  <Label>Custom Domain</Label>
                  <Input
                    value={form.customDomain || ''}
                    onChange={(e) => update('customDomain', e.target.value || null)}
                    placeholder="hrms.yourcompany.com"
                  />
                </div>
              </div>

              {/* Logo Upload */}
              <div>
                <Label>Company Logo</Label>
                <div className="flex items-center gap-4">
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/gif,image/svg+xml"
                    className="hidden"
                    onChange={handleLogoUpload}
                  />
                  <div
                    className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl border-2 border-dashed border-border bg-paper overflow-hidden cursor-pointer hover:border-accent/40 transition-colors"
                    onClick={() => logoInputRef.current?.click()}
                  >
                    {form.logoUrl ? (
                      <img src={form.logoUrl} alt="Logo" className="max-h-full max-w-full object-contain p-1" />
                    ) : (
                      <Image size={24} className="text-ink-faint" />
                    )}
                  </div>
                  <div className="flex-1">
                    <Button variant="outline" size="sm" onClick={() => logoInputRef.current?.click()} isLoading={uploadingLogo}>
                      <Upload size={12} /> {form.logoUrl ? 'Change Logo' : 'Upload Logo'}
                    </Button>
                    {form.logoUrl && (
                      <Button variant="ghost" size="sm" className="ml-2 text-danger" onClick={() => update('logoUrl', null)}>
                        Remove
                      </Button>
                    )}
                    <p className="mt-1 text-[11px] text-ink-faint">PNG, JPG, GIF or SVG. Max 2MB.</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Brand Colors */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette size={16} className="text-accent" /> Brand Colors
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-sm text-ink-faint">
                These colors are used on payslip PDFs, document letterheads, and other company-branded outputs.
              </p>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                {([
                  { key: 'primaryColor', label: 'Primary', default: '#0B6E63', desc: 'Headers, section titles, net pay box' },
                  { key: 'secondaryColor', label: 'Secondary', default: '#10192B', desc: 'Gradients, footer accents' },
                  { key: 'accentColor', label: 'Accent', default: '#4DB6A8', desc: 'Highlights, badges' },
                ] as const).map(({ key, label, default: def, desc }) => (
                  <div key={key}>
                    <Label>{label} Color</Label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={form[key] || def}
                        onChange={(e) => update(key, e.target.value)}
                        className="h-10 w-10 cursor-pointer rounded-lg border border-border bg-white p-0.5"
                      />
                      <Input
                        value={form[key] || def}
                        onChange={(e) => update(key, e.target.value)}
                        className="font-mono text-xs"
                        placeholder={def}
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-ink-faint">{desc}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Digital Signature */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSignature size={16} className="text-accent" /> Digital Signature
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-ink-faint">
                Upload a signature image that appears on generated documents and payslips.
              </p>

              <input
                ref={sigInputRef}
                type="file"
                accept="image/png,image/jpeg,image/gif"
                className="hidden"
                onChange={handleSignatureUpload}
              />

              <div className="flex items-start gap-4">
                <div
                  className="flex h-16 w-32 shrink-0 items-center justify-center rounded-lg border-2 border-dashed border-border bg-paper overflow-hidden cursor-pointer hover:border-accent/40 transition-colors"
                  onClick={() => sigInputRef.current?.click()}
                >
                  {form.signatureImageUrl ? (
                    <img src={form.signatureImageUrl} alt="Signature" className="max-h-full max-w-full object-contain p-1" />
                  ) : (
                    <span className="text-[10px] text-ink-faint text-center px-1">Click to upload</span>
                  )}
                </div>
                <div className="flex-1 space-y-3">
                  <Button variant="outline" size="sm" onClick={() => sigInputRef.current?.click()} isLoading={uploadingSig}>
                    <Upload size={12} /> {form.signatureImageUrl ? 'Change Signature' : 'Upload Signature'}
                  </Button>
                  {form.signatureImageUrl && (
                    <Button variant="ghost" size="sm" className="ml-2 text-danger" onClick={() => { update('signatureImageUrl', null); update('signatureEnabled', false); }}>
                      Remove
                    </Button>
                  )}
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="sigEnabled"
                      checked={form.signatureEnabled}
                      onChange={(e) => update('signatureEnabled', e.target.checked)}
                      className="h-4 w-4 rounded border-border text-accent focus:ring-accent"
                    />
                    <Label className="!mb-0 cursor-pointer">Show signature on documents</Label>
                  </div>
                  <div>
                    <Label>Signature Title</Label>
                    <Input
                      value={form.signatureTitle || ''}
                      onChange={(e) => update('signatureTitle', e.target.value || null)}
                      placeholder="e.g. Authorized Signatory, HR Manager"
                      className="max-w-xs"
                    />
                  </div>
                  <p className="text-[11px] text-ink-faint">PNG or JPG. Max 2MB. Transparent backgrounds work best.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Company Address */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin size={16} className="text-accent" /> Company Address
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-ink-faint">
                Your company address shown on official documents and letters.
              </p>
              <div>
                <Label>Street Address</Label>
                <Input
                  value={form.companyAddress || ''}
                  onChange={(e) => update('companyAddress', e.target.value || null)}
                  placeholder="123 Business Park, Suite 100"
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>City</Label>
                  <Input
                    value={form.companyCity || ''}
                    onChange={(e) => update('companyCity', e.target.value || null)}
                    placeholder="New York"
                  />
                </div>
                <div>
                  <Label>State</Label>
                  <Input
                    value={form.companyState || ''}
                    onChange={(e) => update('companyState', e.target.value || null)}
                    placeholder="NY"
                  />
                </div>
                <div>
                  <Label>Postal Code</Label>
                  <Input
                    value={form.companyPostalCode || ''}
                    onChange={(e) => update('companyPostalCode', e.target.value || null)}
                    placeholder="10001"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Live Preview sidebar */}
        {showPreview && (
          <div className="space-y-4 lg:col-span-1">
            <div className="sticky top-24">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Eye size={14} /> Live Preview
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Logo Preview */}
                  <div>
                    <p className="mb-1 text-[10px] uppercase tracking-wide text-ink-faint font-medium">Logo</p>
                    <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-border bg-paper overflow-hidden">
                      {form.logoUrl ? (
                        <img src={form.logoUrl} alt="Logo" className="max-h-full max-w-full object-contain p-0.5" />
                      ) : (
                        <Palette size={18} className="text-ink-faint" />
                      )}
                    </div>
                  </div>

                  {/* Color Swatches */}
                  <div>
                    <p className="mb-1 text-[10px] uppercase tracking-wide text-ink-faint font-medium">Colors</p>
                    <div className="flex gap-2">
                      <div className="h-8 w-8 rounded-lg" style={{ backgroundColor: form.primaryColor }} title={`Primary: ${form.primaryColor}`} />
                      <div className="h-8 w-8 rounded-lg" style={{ backgroundColor: form.secondaryColor }} title={`Secondary: ${form.secondaryColor}`} />
                      <div className="h-8 w-8 rounded-lg" style={{ backgroundColor: form.accentColor }} title={`Accent: ${form.accentColor}`} />
                    </div>
                    <div className="mt-1.5 space-y-0.5 text-[10px] font-mono text-ink-faint">
                      <div>{form.primaryColor}</div>
                      <div>{form.secondaryColor}</div>
                      <div>{form.accentColor}</div>
                    </div>
                  </div>

                  {/* Signature Preview */}
                  {form.signatureEnabled && form.signatureImageUrl && (
                    <div>
                      <p className="mb-1 text-[10px] uppercase tracking-wide text-ink-faint font-medium">Signature</p>
                      <img src={form.signatureImageUrl} alt="Signature" className="h-10 object-contain" />
                      {form.signatureTitle && (
                        <p className="text-xs text-ink-soft mt-0.5">{form.signatureTitle}</p>
                      )}
                    </div>
                  )}

                  {/* Address Preview */}
                  {form.companyAddress && (
                    <div>
                      <p className="mb-1 text-[10px] uppercase tracking-wide text-ink-faint font-medium">Address</p>
                      <p className="text-xs text-ink-soft">{form.companyAddress}</p>
                      {form.companyCity && (
                        <p className="text-xs text-ink-soft">
                          {[form.companyCity, form.companyState, form.companyPostalCode].filter(Boolean).join(', ')}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Company Name */}
                  {form.companyName && (
                    <div>
                      <p className="mb-1 text-[10px] uppercase tracking-wide text-ink-faint font-medium">Display Name</p>
                      <p className="text-sm font-semibold text-ink">{form.companyName}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
