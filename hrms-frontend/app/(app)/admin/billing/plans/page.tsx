'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api-client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Plus, Pencil, Trash2, Check, X, Eye, EyeOff,
  CreditCard, Sparkles, Star, Users, Database, Globe, Shield,
  BarChart3, Settings, ToggleLeft, ToggleRight, ArrowUpRight,
} from 'lucide-react';

// ──────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────

interface BillingPlan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  minMonthlyFee: number;
  pricePerEmployee: number;
  includedEmployees: number;
  maxEmployees: number;
  maxStorageGB: number;
  annualDiscountPercent: number;
  currency: string;
  features: string[] | null;
  isActive: boolean;
  sortOrder: number;
  yearlyPrice: number;
  apiLimit: number;
  prioritySupport: string;
  visibility: string;
  createdAt: string;
}

interface PlanFeature {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: string;
  icon: string | null;
  isActive: boolean;
  sortOrder: number;
  isEnabled?: boolean;
  mappingId?: string | null;
}

interface PlanWithFeatures extends BillingPlan {
  featureMappings?: PlanFeature[];
}

const CATEGORIES = [
  { key: 'core', label: 'Core', color: 'bg-blue-100 text-blue-700' },
  { key: 'attendance', label: 'Attendance', color: 'bg-emerald-100 text-emerald-700' },
  { key: 'leave', label: 'Leave', color: 'bg-amber-100 text-amber-700' },
  { key: 'payroll', label: 'Payroll', color: 'bg-purple-100 text-purple-700' },
  { key: 'hr', label: 'HR', color: 'bg-rose-100 text-rose-700' },
  { key: 'ess', label: 'ESS', color: 'bg-cyan-100 text-cyan-700' },
  { key: 'analytics', label: 'Analytics', color: 'bg-indigo-100 text-indigo-700' },
  { key: 'security', label: 'Security', color: 'bg-orange-100 text-orange-700' },
  { key: 'integrations', label: 'Integrations', color: 'bg-slate-100 text-slate-700' },
];

const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map(c => [c.key, c]));

function fmt(v: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);
}

const SUPPORT_LABELS: Record<string, string> = {
  none: 'None',
  email: 'Email',
  priority: 'Priority',
  dedicated: 'Dedicated',
  '24/7': '24/7 Support',
};

// ──────────────────────────────────────────────────────────────────
// Plan Form
// ──────────────────────────────────────────────────────────────────

function PlanFormDialog({
  open, onOpenChange, plan, onSave, saving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan?: BillingPlan | null;
  onSave: (data: any) => void;
  saving: boolean;
}) {
  const isEdit = !!plan;
  const [form, setForm] = useState({
    name: plan?.name || '',
    slug: plan?.slug || '',
    description: plan?.description || '',
    minMonthlyFee: plan?.minMonthlyFee || 0,
    pricePerEmployee: plan?.pricePerEmployee || 0,
    includedEmployees: plan?.includedEmployees || 25,
    maxEmployees: plan?.maxEmployees || 25,
    maxStorageGB: plan?.maxStorageGB || 5,
    annualDiscountPercent: plan?.annualDiscountPercent || 0,
    yearlyPrice: plan?.yearlyPrice || 0,
    apiLimit: plan?.apiLimit || 0,
    prioritySupport: plan?.prioritySupport || 'none',
    visibility: plan?.visibility || 'PUBLIC',
    currency: plan?.currency || 'USD',
    sortOrder: plan?.sortOrder || 0,
    isActive: plan?.isActive ?? true,
  });

  // Reset form when plan changes
  if (plan && !form.name && plan.name !== form.name) {
    // Only reset on explicit open
    if (open) {
      setForm({
        name: plan.name,
        slug: plan.slug,
        description: plan.description || '',
        minMonthlyFee: plan.minMonthlyFee,
        pricePerEmployee: plan.pricePerEmployee,
        includedEmployees: plan.includedEmployees,
        maxEmployees: plan.maxEmployees,
        maxStorageGB: plan.maxStorageGB,
        annualDiscountPercent: plan.annualDiscountPercent,
        yearlyPrice: plan.yearlyPrice,
        apiLimit: plan.apiLimit,
        prioritySupport: plan.prioritySupport,
        visibility: plan.visibility,
        currency: plan.currency,
        sortOrder: plan.sortOrder,
        isActive: plan.isActive,
      });
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave({
      ...form,
      description: form.description || undefined,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit ${plan.name}` : 'Create New Plan'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Update plan details and pricing.' : 'Add a new subscription plan.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 sm:col-span-1">
              <Label>Plan Name</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Professional" required />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <Label>Slug</Label>
              <Input value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} placeholder="professional" required />
            </div>
            <div className="col-span-2">
              <Label>Description</Label>
              <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Best for growing teams..." />
            </div>
          </div>

          {/* Pricing */}
          <div>
            <p className="text-xs font-semibold text-ink-faint uppercase tracking-wider mb-2">Pricing</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <Label>Monthly Fee</Label>
                <Input type="number" value={form.minMonthlyFee} onChange={e => setForm({ ...form, minMonthlyFee: +e.target.value })} />
              </div>
              <div>
                <Label>Per Employee</Label>
                <Input type="number" value={form.pricePerEmployee} onChange={e => setForm({ ...form, pricePerEmployee: +e.target.value })} />
              </div>
              <div>
                <Label>Yearly Price</Label>
                <Input type="number" value={form.yearlyPrice} onChange={e => setForm({ ...form, yearlyPrice: +e.target.value })} />
              </div>
              <div>
                <Label>Currency</Label>
                <Input value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })} />
              </div>
            </div>
          </div>

          {/* Limits */}
          <div>
            <p className="text-xs font-semibold text-ink-faint uppercase tracking-wider mb-2">Limits</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <Label>Included Emps</Label>
                <Input type="number" value={form.includedEmployees} onChange={e => setForm({ ...form, includedEmployees: +e.target.value })} />
              </div>
              <div>
                <Label>Max Employees</Label>
                <Input type="number" value={form.maxEmployees} onChange={e => setForm({ ...form, maxEmployees: +e.target.value })} />
              </div>
              <div>
                <Label>Storage (GB)</Label>
                <Input type="number" value={form.maxStorageGB} onChange={e => setForm({ ...form, maxStorageGB: +e.target.value })} />
              </div>
              <div>
                <Label>API Limit</Label>
                <Input type="number" value={form.apiLimit} onChange={e => setForm({ ...form, apiLimit: +e.target.value })} placeholder="Requests/day" />
              </div>
            </div>
          </div>

          {/* Advanced */}
          <div>
            <p className="text-xs font-semibold text-ink-faint uppercase tracking-wider mb-2">Advanced</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <Label>Annual Discount %</Label>
                <Input type="number" value={form.annualDiscountPercent} onChange={e => setForm({ ...form, annualDiscountPercent: +e.target.value })} />
              </div>
              <div>
                <Label>Sort Order</Label>
                <Input type="number" value={form.sortOrder} onChange={e => setForm({ ...form, sortOrder: +e.target.value })} />
              </div>
              <div>
                <Label>Support Level</Label>
                <select
                  className="flex h-10 w-full rounded-xl border border-input bg-white px-3.5 py-2 text-sm text-ink"
                  value={form.prioritySupport}
                  onChange={e => setForm({ ...form, prioritySupport: e.target.value })}
                >
                  <option value="none">None</option>
                  <option value="email">Email Support</option>
                  <option value="priority">Priority Support</option>
                  <option value="dedicated">Dedicated Support</option>
                  <option value="24/7">24/7 Support</option>
                </select>
              </div>
              <div>
                <Label>Visibility</Label>
                <select
                  className="flex h-10 w-full rounded-xl border border-input bg-white px-3.5 py-2 text-sm text-ink"
                  value={form.visibility}
                  onChange={e => setForm({ ...form, visibility: e.target.value })}
                >
                  <option value="PUBLIC">Public</option>
                  <option value="PRIVATE">Private</option>
                </select>
              </div>
            </div>
          </div>

          {/* Status toggle */}
          <div className="flex items-center gap-3">
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                className="peer sr-only"
                checked={form.isActive}
                onChange={e => setForm({ ...form, isActive: e.target.checked })}
              />
              <div className="h-6 w-11 rounded-full border border-border bg-paper after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-accent peer-checked:after:translate-x-full peer-checked:after:border-white" />
            </label>
            <span className="text-sm text-ink-soft">Active plan</span>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" isLoading={saving}>{isEdit ? 'Update Plan' : 'Create Plan'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ──────────────────────────────────────────────────────────────────
// Feature Form Dialog
// ──────────────────────────────────────────────────────────────────

function FeatureFormDialog({
  open, onOpenChange, feature, onSave, saving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feature?: PlanFeature | null;
  onSave: (data: any) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState({
    code: feature?.code || '',
    name: feature?.name || '',
    description: feature?.description || '',
    category: feature?.category || 'core',
    sortOrder: feature?.sortOrder || 0,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{feature ? `Edit ${feature.name}` : 'New Feature'}</DialogTitle>
          <DialogDescription>Add or edit a feature in the catalog.</DialogDescription>
        </DialogHeader>
        <form onSubmit={e => { e.preventDefault(); onSave(form); }} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 sm:col-span-1">
              <Label>Code</Label>
              <Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="face_recognition" required disabled={!!feature} />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <Label>Name</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Face Recognition" required />
            </div>
          </div>
          <div>
            <Label>Description</Label>
            <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Optional description" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Category</Label>
              <select
                className="flex h-10 w-full rounded-xl border border-input bg-white px-3.5 py-2 text-sm text-ink"
                value={form.category}
                onChange={e => setForm({ ...form, category: e.target.value })}
              >
                {CATEGORIES.map(c => (
                  <option key={c.key} value={c.key}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Sort Order</Label>
              <Input type="number" value={form.sortOrder} onChange={e => setForm({ ...form, sortOrder: +e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" isLoading={saving}>{feature ? 'Update' : 'Create'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ──────────────────────────────────────────────────────────────────
// Main Page
// ──────────────────────────────────────────────────────────────────

export default function AdminBillingPlansPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('plans');
  const [planFormOpen, setPlanFormOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<BillingPlan | null>(null);
  const [featureFormOpen, setFeatureFormOpen] = useState(false);
  const [editingFeature, setEditingFeature] = useState<PlanFeature | null>(null);

  // ── Queries ──

  const { data: plans = [], isLoading: plansLoading } = useQuery({
    queryKey: ['admin', 'billing-plans'],
    queryFn: () => unwrap<BillingPlan[]>(api.get('/billing/plans')),
    staleTime: 30_000,
  });

  const { data: features = [], isLoading: featuresLoading } = useQuery({
    queryKey: ['admin', 'features-catalog'],
    queryFn: () => unwrap<PlanFeature[]>(api.get('/billing/features-catalog')),
    staleTime: 30_000,
  });

  // ── Mutations ──

  const createPlanMut = useMutation({
    mutationFn: (data: any) => api.post('/billing/plans', data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin', 'billing-plans'] }); setPlanFormOpen(false); setEditingPlan(null); },
  });

  const updatePlanMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.patch(`/billing/plans/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin', 'billing-plans'] }); setPlanFormOpen(false); setEditingPlan(null); },
  });

  const deletePlanMut = useMutation({
    mutationFn: (id: string) => api.delete(`/billing/plans/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'billing-plans'] }),
  });

  const createFeatureMut = useMutation({
    mutationFn: (data: any) => api.post('/billing/features-catalog', data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin', 'features-catalog'] }); setFeatureFormOpen(false); setEditingFeature(null); },
  });

  const updateFeatureMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.patch(`/billing/features-catalog/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin', 'features-catalog'] }); setFeatureFormOpen(false); setEditingFeature(null); },
  });

  const deleteFeatureMut = useMutation({
    mutationFn: (id: string) => api.delete(`/billing/features-catalog/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'features-catalog'] }),
  });

  const toggleMappingMut = useMutation({
    mutationFn: ({ planId, featureId, isEnabled }: { planId: string; featureId: string; isEnabled: boolean }) =>
      api.patch(`/billing/plans/${planId}/features/${featureId}`, { isEnabled }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'plan-features'] }),
  });

  // Create a new plan with full data
  function handleCreatePlan(formData: any) {
    createPlanMut.mutate(formData);
  }

  function handleUpdatePlan(formData: any) {
    if (!editingPlan) return;
    updatePlanMut.mutate({ id: editingPlan.id, data: formData });
  }

  function openEditPlan(plan: BillingPlan) {
    setEditingPlan(plan);
    setPlanFormOpen(true);
  }

  function openCreatePlan() {
    setEditingPlan(null);
    setPlanFormOpen(true);
  }

  // ── Render ──

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-ink">Plan Management</h1>
          <p className="text-sm text-ink-faint">Manage subscription plans, feature catalog, and plan-feature mappings</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="plans" className="flex items-center gap-1.5">
            <CreditCard size={14} /> Plans
          </TabsTrigger>
          <TabsTrigger value="features" className="flex items-center gap-1.5">
            <BarChart3 size={14} /> Feature Catalog
          </TabsTrigger>
          <TabsTrigger value="mappings" className="flex items-center gap-1.5">
            <Settings size={14} /> Feature Mapping
          </TabsTrigger>
        </TabsList>

        {/* ════════════════════════════════════════════════ */}
        {/* TAB 1: Plans CRUD */}
        {/* ════════════════════════════════════════════════ */}
        <TabsContent value="plans" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-ink-faint">{plans.length} plan(s)</p>
            <Button onClick={openCreatePlan} size="sm">
              <Plus size={14} className="mr-1.5" /> New Plan
            </Button>
          </div>

          {plansLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-accent" />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {plans.map(plan => {
                const supportColor = plan.prioritySupport === '24/7' ? 'text-emerald-600' : plan.prioritySupport === 'dedicated' ? 'text-blue-600' : plan.prioritySupport === 'priority' ? 'text-amber-600' : 'text-ink-faint';
                return (
                  <div
                    key={plan.id}
                    className={`group relative rounded-2xl border-2 transition-all duration-200 ${
                      plan.isActive ? 'border-border/60 hover:border-accent/30 hover:shadow-md' : 'border-border/30 bg-paper/50 opacity-70'
                    }`}
                  >
                    {/* Status dot */}
                    <div className="absolute right-3 top-3 flex items-center gap-1.5">
                      <div className={`h-2 w-2 rounded-full ${plan.isActive ? 'bg-accent' : 'bg-ink-faint'}`} />
                      <span className="text-[10px] text-ink-faint">{plan.isActive ? 'Active' : 'Inactive'}</span>
                    </div>

                    <div className="p-5 pb-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-serif text-lg font-semibold text-ink">{plan.name}</h3>
                          <span className="text-[10px] font-mono text-ink-faint">{plan.slug}</span>
                        </div>
                        <div className="text-right">
                          {plan.minMonthlyFee > 0 ? (
                            <p className="font-serif text-xl font-bold text-ink">{fmt(plan.minMonthlyFee)}<span className="text-xs font-normal text-ink-faint">/mo</span></p>
                          ) : (
                            <p className="font-serif text-xl font-bold text-ink">{fmt(plan.pricePerEmployee)}<span className="text-xs font-normal text-ink-faint">/emp/mo</span></p>
                          )}
                        </div>
                      </div>
                      {plan.description && (
                        <p className="mt-1.5 text-xs text-ink-faint line-clamp-2">{plan.description}</p>
                      )}
                    </div>

                    {/* Stats row */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border/40 px-5 py-2.5 text-[11px] text-ink-faint">
                      <span><Users size={11} className="inline mr-0.5" /> Up to {plan.maxEmployees.toLocaleString()}</span>
                      <span><Database size={11} className="inline mr-0.5" /> {plan.maxStorageGB}GB</span>
                      {plan.yearlyPrice > 0 && <span className="text-accent">Annual: {fmt(plan.yearlyPrice)}</span>}
                    </div>

                    {/* Support + API */}
                    <div className="flex items-center justify-between border-t border-border/40 px-5 py-2.5">
                      <span className={`text-[11px] font-medium ${supportColor}`}>
                        {SUPPORT_LABELS[plan.prioritySupport] || plan.prioritySupport}
                      </span>
                      <span className="text-[11px] text-ink-faint">{plan.apiLimit.toLocaleString()} API req/d</span>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-1.5 border-t border-border/40 px-5 py-2.5">
                      <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => openEditPlan(plan)}>
                        <Pencil size={12} className="mr-1" /> Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-xs text-danger hover:text-danger"
                        onClick={() => {
                          if (confirm(`Deactivate "${plan.name}"?`)) deletePlanMut.mutate(plan.id);
                        }}
                        isLoading={deletePlanMut.isPending && deletePlanMut.variables === plan.id}
                      >
                        <Trash2 size={12} className="mr-1" /> Deactivate
                      </Button>
                    </div>
                  </div>
                );
              })}
              {plans.length === 0 && (
                <div className="col-span-full flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border/60 py-16 text-center">
                  <CreditCard size={32} className="mb-3 text-ink-faint/40" />
                  <p className="text-sm font-medium text-ink-soft">No plans yet</p>
                  <p className="text-xs text-ink-faint">Create your first billing plan</p>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* ════════════════════════════════════════════════ */}
        {/* TAB 2: Feature Catalog */}
        {/* ════════════════════════════════════════════════ */}
        <TabsContent value="features" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-ink-faint">{features.length} features</p>
            <Button onClick={() => { setEditingFeature(null); setFeatureFormOpen(true); }} size="sm">
              <Plus size={14} className="mr-1.5" /> Add Feature
            </Button>
          </div>

          {featuresLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-accent" />
            </div>
          ) : (
            <div className="space-y-6">
              {CATEGORIES.map(cat => {
                const catFeatures = features.filter(f => f.category === cat.key);
                if (catFeatures.length === 0) return null;
                return (
                  <Card key={cat.key}>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-sm">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${cat.color}`}>
                          {cat.label}
                        </span>
                        <span className="text-xs text-ink-faint">{catFeatures.length} feature(s)</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Code</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Order</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {catFeatures.map(f => (
                            <TableRow key={f.id}>
                              <TableCell className="font-mono text-xs text-ink-faint">{f.code}</TableCell>
                              <TableCell className="font-medium text-ink">{f.name}</TableCell>
                              <TableCell className="text-xs text-ink-faint max-w-[200px] truncate">{f.description || '—'}</TableCell>
                              <TableCell className="text-xs text-ink-faint">{f.sortOrder}</TableCell>
                              <TableCell>
                                <Badge tone={f.isActive ? 'success' : 'default'}>{f.isActive ? 'Active' : 'Inactive'}</Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Button variant="outline" size="sm" onClick={() => { setEditingFeature(f); setFeatureFormOpen(true); }}>
                                    <Pencil size={12} />
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-danger"
                                    onClick={() => {
                                      if (confirm(`Remove "${f.name}" feature?`)) deleteFeatureMut.mutate(f.id);
                                    }}
                                    isLoading={deleteFeatureMut.isPending && deleteFeatureMut.variables === f.id}
                                  >
                                    <Trash2 size={12} />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ════════════════════════════════════════════════ */}
        {/* TAB 3: Feature Mapping Matrix */}
        {/* ════════════════════════════════════════════════ */}
        <TabsContent value="mappings" className="space-y-4">
          <p className="text-sm text-ink-faint">Toggle features on/off for each plan</p>

          {plansLoading || featuresLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-accent" />
            </div>
          ) : (
            <div className="space-y-6">
              {plans.filter(p => p.isActive).map(plan => (
                <PlanFeatureMatrix
                  key={plan.id}
                  plan={plan}
                  allFeatures={features}
                  onToggle={(featureId, isEnabled) => {
                    toggleMappingMut.mutate({ planId: plan.id, featureId, isEnabled });
                  }}
                  isToggling={toggleMappingMut.isPending}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Dialogs ── */}
      <PlanFormDialog
        open={planFormOpen}
        onOpenChange={o => { setPlanFormOpen(o); if (!o) setEditingPlan(null); }}
        plan={editingPlan}
        onSave={editingPlan ? handleUpdatePlan : handleCreatePlan}
        saving={createPlanMut.isPending || updatePlanMut.isPending}
      />

      <FeatureFormDialog
        open={featureFormOpen}
        onOpenChange={o => { setFeatureFormOpen(o); if (!o) setEditingFeature(null); }}
        feature={editingFeature}
        onSave={(data) => {
          if (editingFeature) {
            updateFeatureMut.mutate({ id: editingFeature.id, data });
          } else {
            createFeatureMut.mutate(data);
          }
        }}
        saving={createFeatureMut.isPending || updateFeatureMut.isPending}
      />
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Plan Feature Matrix Component
// ──────────────────────────────────────────────────────────────────

function PlanFeatureMatrix({
  plan,
  allFeatures,
  onToggle,
  isToggling,
}: {
  plan: BillingPlan;
  allFeatures: PlanFeature[];
  onToggle: (featureId: string, isEnabled: boolean) => void;
  isToggling: boolean;
}) {
  // Fetch the enabled features for this plan
  const { data: planFeatures, isLoading } = useQuery({
    queryKey: ['admin', 'plan-features', plan.id],
    queryFn: () => unwrap<PlanFeature[]>(api.get(`/billing/plans/${plan.id}/features`)),
    staleTime: 30_000,
  });

  const enabledSet = new Set(
    (planFeatures || []).filter(f => f.isEnabled).map(f => f.id)
  );

  // Group features by category
  const grouped = CATEGORIES.map(cat => ({
    ...cat,
    features: allFeatures.filter(f => f.category === cat.key && f.isActive),
  })).filter(g => g.features.length > 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard size={16} className="text-accent" />
            {plan.name}
          </CardTitle>
          <div className="flex items-center gap-2 text-xs text-ink-faint">
            <span className="flex items-center gap-1">
              <div className="h-2 w-2 rounded-full bg-accent" />
              {enabledSet.size} enabled
            </span>
            <span className="flex items-center gap-1">
              <div className="h-2 w-2 rounded-full bg-paper border border-border" />
              {allFeatures.length - enabledSet.size} disabled
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-accent" />
          </div>
        ) : (
          <div className="divide-y divide-border">
            {grouped.map(group => (
              <div key={group.key}>
                <div className="flex items-center gap-2 bg-paper/50 px-5 py-2">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${group.color}`}>
                    {group.label}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-px bg-border/30">
                  {group.features.map(f => {
                    const enabled = enabledSet.has(f.id);
                    return (
                      <button
                        key={f.id}
                        onClick={() => {
                          if (!isToggling) onToggle(f.id, !enabled);
                        }}
                        disabled={isToggling}
                        className={`flex items-center gap-2 px-4 py-2.5 text-xs transition-all duration-150 ${
                          enabled
                            ? 'bg-accent/5 hover:bg-accent/10 text-ink'
                            : 'bg-white hover:bg-paper text-ink-faint'
                        } ${isToggling ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                      >
                        {enabled
                          ? <Check size={12} className="flex-shrink-0 text-accent" />
                          : <X size={12} className="flex-shrink-0 text-ink-faint/40" />
                        }
                        <span className="truncate">{f.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
