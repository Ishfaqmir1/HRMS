'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api-client';
import { Company, CompanyDetail, ImpersonateResult } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { saveSession } from '@/lib/auth';
import {
  Building2, ArrowLeft, Save, CheckCircle2, XCircle, Clock,
  Globe, Upload, ShieldCheck, FileText, Users, HardDrive, Package,
  Edit3, LogIn, ExternalLink, Shield,
} from 'lucide-react';

// ──────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const STATUS_BADGE: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
  ACTIVE: 'success',
  TRIAL: 'warning',
  TRIAL_EXPIRED: 'danger',
  SUSPENDED: 'danger',
  CANCELLED: 'danger',
  PENDING_EMAIL_VERIFICATION: 'default',
  PENDING_APPROVAL: 'warning',
  REJECTED: 'danger',
};

// ──────────────────────────────────────────────────────────────────
// Editable Field
// ──────────────────────────────────────────────────────────────────

function EditableField({
  label, value, onChange, placeholder, type = 'text', className,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  type?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label className="text-xs text-ink-faint">{label}</Label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || label}
        className="mt-0.5"
      />
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Document Upload Card
// ──────────────────────────────────────────────────────────────────

function DocumentUploadCard({
  title, description, documentUrl, documentType, companyId, onUploaded,
}: {
  title: string;
  description: string;
  documentUrl: string | null | undefined;
  documentType: string;
  companyId: string;
  onUploaded: () => void;
}) {
  const [uploading, setUploading] = useState(false);

  const mutation = useMutation({
    mutationFn: (fileUrl: string) =>
      api.post(`/companies/${companyId}/verification-document`, { documentType, fileUrl }),
    onSuccess: () => { onUploaded(); setUploading(false); },
    onError: () => setUploading(false),
  });

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);

    // Upload via the upload endpoint, then save the URL
    const formData = new FormData();
    formData.append('file', file);
    try {
      const { data } = await api.post('/upload/company-document', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      mutation.mutate(data.data?.url || data.url);
    } catch (err) {
      setUploading(false);
      alert('Failed to upload file. Please try again.');
    }
  }

  return (
    <div className="rounded-xl border border-border p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink">{title}</p>
          <p className="text-xs text-ink-faint mt-0.5">{description}</p>
          {documentUrl && (
            <a
              href={documentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1.5 text-xs text-accent hover:text-accent-hover transition-colors"
            >
              <FileText size={12} />
              View uploaded document
            </a>
          )}
        </div>
        <div className="flex-shrink-0">
          <label className="cursor-pointer">
            <input type="file" className="hidden" onChange={handleFileChange} accept=".pdf,.png,.jpg,.jpeg" />
            <Button variant="outline" size="sm" isLoading={uploading} type="button">
              <span className="flex items-center gap-1.5">
                <Upload size={14} />
                {documentUrl ? 'Replace' : 'Upload'}
              </span>
            </Button>
          </label>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Impersonate Button
// ──────────────────────────────────────────────────────────────────

function ImpersonateButton({ companyId, companyName }: { companyId: string; companyName: string }) {
  const router = useRouter();
  const [impersonating, setImpersonating] = useState(false);

  const impersonateMut = useMutation({
    mutationFn: (id: string) => api.post(`/companies/${id}/impersonate`),
    onSuccess: (res) => {
      const data = res.data as ImpersonateResult;
      if (data.accessToken) {
        saveSession({ accessToken: data.accessToken, refreshToken: '' });
        // Redirect to the impersonated company's dashboard
        router.push('/dashboard');
      }
    },
    onError: () => {
      setImpersonating(false);
      alert('Failed to impersonate. Please try again.');
    },
  });

  return (
    <Button
      variant="outline"
      size="sm"
      className="border-accent/30 text-accent hover:bg-accent/5"
      onClick={() => {
        setImpersonating(true);
        impersonateMut.mutate(companyId);
      }}
      isLoading={impersonating || impersonateMut.isPending}
    >
      <LogIn size={14} className="mr-1.5" />
      Login as {companyName}
    </Button>
  );
}

// ──────────────────────────────────────────────────────────────────
// Main Company Profile Page
// ──────────────────────────────────────────────────────────────────

export default function CompanyProfilePage() {
  const params = useParams();
  const router = useRouter();
  const companyId = params.id as string;

  // Fetch company detail
  const { data: company, isLoading, refetch } = useQuery({
    queryKey: ['company', companyId],
    queryFn: () => unwrap<CompanyDetail>(api.get(`/companies/${companyId}`)),
    enabled: !!companyId,
  });

  // Editable form state (initialized once data loads)
  const [form, setForm] = useState<Record<string, string>>({});
  const [formInitialized, setFormInitialized] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [tab, setTab] = useState<'profile' | 'documents' | 'users'>('profile');

  // Initialize form when company data loads
  useEffect(() => {
    if (company && !formInitialized) {
      setForm({
        name: company.name || '',
        industry: company.industry || '',
        size: company.size || '',
        timezone: company.timezone || '',
        locale: company.locale || '',
        currency: company.currency || '',
        country: company.country || '',
        domain: company.domain || '',
        phone: company.phone || '',
        gstNumber: company.gstNumber || '',
        panNumber: company.panNumber || '',
        addressLine1: company.addressLine1 || '',
        addressLine2: company.addressLine2 || '',
        city: company.city || '',
        state: company.state || '',
        postalCode: company.postalCode || '',
      });
      setFormInitialized(true);
    }
  }, [company, formInitialized]);

  function updateField(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaveSuccess(false);
  }

  async function handleSave() {
    setSaving(true);
    setSaveSuccess(false);
    try {
      await api.patch(`/companies/${companyId}/profile`, form);
      setSaveSuccess(true);
      refetch();
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to save:', err);
    } finally {
      setSaving(false);
    }
  }

  // Users fetch
  const { data: users } = useQuery({
    queryKey: ['company-users', companyId],
    queryFn: () => unwrap<any[]>(api.get(`/companies/${companyId}/users`)),
    enabled: tab === 'users' && !!companyId,
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl py-12">
        <div className="flex items-center justify-center py-16">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-accent" />
        </div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="mx-auto max-w-5xl py-12">
        <div className="flex flex-col items-center justify-center py-16">
          <Building2 size={48} className="mb-4 text-ink-faint/40" />
          <p className="text-lg font-medium text-ink-faint">Company not found</p>
          <Button variant="outline" className="mt-4" onClick={() => router.push('/companies')}>
            Back to Companies
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="h-9 w-9 flex-shrink-0" onClick={() => router.push('/companies')}>
            <ArrowLeft size={18} />
          </Button>
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-accent/10">
            {company.logoUrl ? (
              <img src={company.logoUrl} alt={company.name} className="h-10 w-10 rounded-lg object-contain" />
            ) : (
              <Building2 size={24} className="text-accent" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-serif text-2xl font-semibold text-ink">{company.name}</h1>
              <Badge tone={STATUS_BADGE[company.status] || 'default'}>{company.status}</Badge>
              {company.status === 'ACTIVE' && company.verifiedAt && (
                <Badge tone="success" className="flex items-center gap-1">
                  <ShieldCheck size={12} /> Verified
                </Badge>
              )}
            </div>
            <p className="mt-0.5 text-sm text-ink-faint">
              {company.slug} · {company.billingPlan?.name || company.subscriptionPlan || 'No plan'}
              {company.trialEndsAt && ` · Trial ends ${fmtDate(company.trialEndsAt)}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => router.push('/companies')}>
            <ArrowLeft size={14} /> Back
          </Button>
          {company.status === 'ACTIVE' && (
            <ImpersonateButton companyId={company.id} companyName={company.name} />
          )}
          <Button size="sm" isLoading={saving} onClick={handleSave}>
            <Save size={14} className="mr-1.5" />
            Save Changes
          </Button>
          {saveSuccess && (
            <span className="flex items-center gap-1 text-xs text-accent">
              <CheckCircle2 size={12} /> Saved
            </span>
          )}
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 rounded-xl bg-paper p-1">
        {[
          { key: 'profile', label: 'Company Profile' },
          { key: 'documents', label: 'Verification Documents' },
          { key: 'users', label: 'Users' },
        ].map((t) => (
          <button
            key={t.key}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.key ? 'bg-white text-ink shadow-sm' : 'text-ink-faint hover:text-ink'
            }`}
            onClick={() => setTab(t.key as any)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Profile Tab ──────────────────────────────────────── */}
      {tab === 'profile' && (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left column — editable fields */}
          <div className="space-y-6 lg:col-span-2">
            {/* Owner Info (read-only) */}
            {company.owner && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-ink">Owner</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-ink-faint">Name: </span>
                    <span className="text-ink">
                      {company.owner.firstName || company.owner.lastName
                        ? `${company.owner.firstName || ''} ${company.owner.lastName || ''}`.trim()
                        : '—'}
                    </span>
                  </div>
                  <div><span className="text-ink-faint">Email: </span>{company.owner.email}</div>
                  <div><span className="text-ink-faint">Phone: </span>{company.owner.phone || '—'}</div>
                  <div><span className="text-ink-faint">Last Login: </span>{fmtDateTime(company.owner.lastLoginAt)}</div>
                </CardContent>
              </Card>
            )}

            {/* Editable Company Info */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium text-ink">Company Information</CardTitle>
                <Edit3 size={14} className="text-ink-faint" />
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2">
                  <EditableField label="Company Name" value={form.name || ''} onChange={(v) => updateField('name', v)} />
                  <EditableField label="Industry" value={form.industry || ''} onChange={(v) => updateField('industry', v)} />
                  <EditableField label="Company Size" value={form.size || ''} onChange={(v) => updateField('size', v)} placeholder="e.g. 11-50" />
                  <EditableField label="Timezone" value={form.timezone || ''} onChange={(v) => updateField('timezone', v)} placeholder="UTC" />
                  <EditableField label="Locale" value={form.locale || ''} onChange={(v) => updateField('locale', v)} placeholder="en" />
                  <EditableField label="Currency" value={form.currency || ''} onChange={(v) => updateField('currency', v)} placeholder="USD" />
                  <EditableField label="Country" value={form.country || ''} onChange={(v) => updateField('country', v)} placeholder="US" />
                  <EditableField label="Domain" value={form.domain || ''} onChange={(v) => updateField('domain', v)} placeholder="acme.com" />
                  <EditableField label="Phone" value={form.phone || ''} onChange={(v) => updateField('phone', v)} placeholder="+1-555-0100" />
                </div>
              </CardContent>
            </Card>

            {/* Editable Tax & Address */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium text-ink">Tax &amp; Address</CardTitle>
                <FileText size={14} className="text-ink-faint" />
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <EditableField label="GST Number" value={form.gstNumber || ''} onChange={(v) => updateField('gstNumber', v)} placeholder="22AAAAA0000A1Z5" />
                  <EditableField label="PAN Number" value={form.panNumber || ''} onChange={(v) => updateField('panNumber', v)} placeholder="ABCDE1234F" />
                </div>
                <EditableField label="Address Line 1" value={form.addressLine1 || ''} onChange={(v) => updateField('addressLine1', v)} placeholder="123 Main St" />
                <EditableField label="Address Line 2" value={form.addressLine2 || ''} onChange={(v) => updateField('addressLine2', v)} placeholder="Suite 100" />
                <div className="grid gap-4 sm:grid-cols-3">
                  <EditableField label="City" value={form.city || ''} onChange={(v) => updateField('city', v)} placeholder="New York" />
                  <EditableField label="State" value={form.state || ''} onChange={(v) => updateField('state', v)} placeholder="NY" />
                  <EditableField label="Postal Code" value={form.postalCode || ''} onChange={(v) => updateField('postalCode', v)} placeholder="10001" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right column — stats & meta */}
          <div className="space-y-4">
            {/* Status Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-ink">Status &amp; Plan</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-ink-faint">Status</span>
                  <Badge tone={STATUS_BADGE[company.status] || 'default'}>{company.status}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-ink-faint">Plan</span>
                  <span className="font-medium text-ink">{company.billingPlan?.name || company.subscriptionPlan || '—'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-ink-faint">Billing Cycle</span>
                  <span className="text-ink">{company.billingCycle}</span>
                </div>
                {company.trialEndsAt && (
                  <div className="flex items-center justify-between">
                    <span className="text-ink-faint">Trial Ends</span>
                    <span className="text-warning">{fmtDate(company.trialEndsAt)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-ink-faint">Created</span>
                  <span className="text-ink">{fmtDate(company.createdAt)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Stats Grid */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-ink">Stats</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                {[
                  { icon: Users, label: 'Employees', value: company._count.employees },
                  { icon: Users, label: 'Users', value: company._count.users },
                  { icon: Globe, label: 'Branches', value: company._count.branches },
                  { icon: Building2, label: 'Departments', value: company._count.departments },
                  { icon: Package, label: 'Assets', value: company._count.assets },
                  { icon: HardDrive, label: 'Payroll Runs', value: company._count.payrollRuns },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-lg border border-border p-3 text-center">
                    <stat.icon size={14} className="mx-auto mb-1 text-ink-faint" />
                    <p className="text-lg font-semibold text-ink">{stat.value}</p>
                    <p className="text-[10px] text-ink-faint">{stat.label}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Verification Status */}
            {(company.status === 'PENDING_APPROVAL' || company.status === 'REJECTED' || company.verifiedAt) && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-ink">Verification</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {company.verifiedAt ? (
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={14} className="text-accent" />
                      <span>Verified on {fmtDate(company.verifiedAt)}</span>
                    </div>
                  ) : company.status === 'REJECTED' ? (
                    <div className="flex items-start gap-2">
                      <XCircle size={14} className="mt-0.5 text-danger flex-shrink-0" />
                      <div>
                        <p className="font-medium text-danger">Rejected</p>
                        {company.rejectionReason && <p className="text-ink-faint mt-0.5">{company.rejectionReason}</p>}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Clock size={14} className="text-warning" />
                      <span className="text-ink-soft">Awaiting super admin approval</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* ── Documents Tab ──────────────────────────────────────── */}
      {tab === 'documents' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-ink">Enterprise Verification Documents</CardTitle>
              <p className="text-xs text-ink-faint">
                Upload verification documents for enterprise verification. Accepted formats: PDF, PNG, JPG.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <DocumentUploadCard
                title="Registration Certificate"
                description="Company registration certificate issued by the registrar of companies"
                documentUrl={company.registrationCert}
                documentType="registration_cert"
                companyId={companyId}
                onUploaded={refetch}
              />
              <DocumentUploadCard
                title="Address Proof"
                description="Utility bill or bank statement showing company address (less than 3 months old)"
                documentUrl={company.addressProof}
                documentType="address_proof"
                companyId={companyId}
                onUploaded={refetch}
              />
              <DocumentUploadCard
                title="Owner ID Document"
                description="Government-issued ID of the company owner (Passport, Driver's License, or National ID)"
                documentUrl={company.ownerIdDoc}
                documentType="owner_id"
                companyId={companyId}
                onUploaded={refetch}
              />
            </CardContent>
          </Card>
          {company.registrationCert || company.addressProof || company.ownerIdDoc ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-ink">Verification Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { label: 'Registration Certificate', done: !!company.registrationCert },
                    { label: 'Address Proof', done: !!company.addressProof },
                    { label: 'Owner ID', done: !!company.ownerIdDoc },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-3">
                      {item.done ? (
                        <CheckCircle2 size={16} className="text-accent" />
                      ) : (
                        <XCircle size={16} className="text-ink-faint/40" />
                      )}
                      <span className={`text-sm ${item.done ? 'text-ink' : 'text-ink-faint'}`}>{item.label}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>
      )}

      {/* ── Users Tab ──────────────────────────────────────────── */}
      {tab === 'users' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-ink">Users ({company._count.users})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {users && users.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Login</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user: any) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium text-ink">
                        {user.employee
                          ? `${user.employee.firstName || ''} ${user.employee.lastName || ''}`.trim() || '—'
                          : '—'}
                      </TableCell>
                      <TableCell className="text-ink-soft">{user.email}</TableCell>
                      <TableCell>
                        {user.userRoles?.map((ur: any) => (
                          <Badge key={ur.role.id} tone="default" className="mr-1">
                            {ur.role.name}
                          </Badge>
                        )) || '—'}
                      </TableCell>
                      <TableCell>
                        <Badge tone={user.status === 'ACTIVE' ? 'success' : 'default'}>{user.status}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-ink-faint">{fmtDateTime(user.lastLoginAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="flex items-center justify-center py-12">
                <p className="text-sm text-ink-faint">No users found</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
