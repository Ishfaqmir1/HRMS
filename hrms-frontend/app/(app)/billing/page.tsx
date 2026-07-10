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
import { useForm } from 'react-hook-form';
import { Check, CreditCard, Palette, Shield } from 'lucide-react';

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
}

interface Subscription {
  id: string;
  name: string;
  status: string;
  subscriptionPlan: string;
  billingPlan: BillingPlan | null;
  trialEndsAt: string | null;
  billingEmail: string | null;
  employeeCount: number;
  maxEmployees: number | null;
  branding: any;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  description: string | null;
  amount: number;
  currency: string;
  status: string;
  dueDate: string | null;
  paidAt: string | null;
  createdAt: string;
}

interface FeatureFlag {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isEnabled: boolean;
}

function fmt(v: number) { return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v); }

const STATUS_TONES: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
  ACTIVE: 'success', TRIAL: 'warning', TRIAL_EXPIRED: 'danger', SUSPENDED: 'danger', CANCELLED: 'danger',
  PAID: 'success', DRAFT: 'default', SENT: 'warning', OVERDUE: 'danger',
};

export default function BillingPage() {
  const queryClient = useQueryClient();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [showPlanPicker, setShowPlanPicker] = useState(false);

  // Consolidate 6 separate API calls into 1 to reduce page load time
  const { data: allData, isLoading: subLoading } = useQuery({
    queryKey: ['billing', 'all'],
    queryFn: async () => {
      const [subscription, plans, invoices, features, branding, trial] = await Promise.all([
        unwrap<Subscription>(api.get('/billing/subscription')).catch(() => null),
        unwrap<BillingPlan[]>(api.get('/billing/plans')).catch(() => []),
        unwrap<Invoice[]>(api.get('/billing/invoices')).catch(() => []),
        unwrap<FeatureFlag[]>(api.get('/billing/features')).catch(() => []),
        unwrap<any>(api.get('/billing/branding')).catch(() => null),
        unwrap<any>(api.get('/billing/trial')).catch(() => null),
      ]);
      return { subscription, plans, invoices, features, branding, trial };
    },
  });

  const subscription = allData?.subscription;
  const plans = allData?.plans;
  const invoices = allData?.invoices;
  const features = allData?.features;
  const branding = allData?.branding;
  const trial = allData?.trial;

  const updateSubMut = useMutation({
    mutationFn: (billingPlanId: string) => api.patch('/billing/subscription', { billingPlanId, billingCycle: 'MONTHLY' }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['billing'] }); setShowPlanPicker(false); },
  });

  const toggleFlagMut = useMutation({
    mutationFn: ({ id, isEnabled }: { id: string; isEnabled: boolean }) => api.post(`/billing/feature-flags/${id}/toggle`, { isEnabled }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['billing'] }),
  });

  if (subLoading) return <p className="text-sm text-ink-faint">Loading billing info…</p>;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <h1 className="ledger-tab font-serif text-2xl font-semibold text-ink">Billing & Subscription</h1>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="plans">Plans</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="branding">Branding</TabsTrigger>
          <TabsTrigger value="features">Features</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {subscription && (
            <>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Current Plan</CardTitle>
                    <p className="text-sm text-ink-faint">{subscription.name}</p>
                  </div>
                  <Badge tone={STATUS_TONES[subscription.status]}>{subscription.status}</Badge>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
                    <div>
                      <p className="text-xs text-ink-faint">Plan</p>
                      <p className="font-medium text-ink">{subscription.billingPlan?.name || subscription.subscriptionPlan}</p>
                    </div>
                    <div>
                      <p className="text-xs text-ink-faint">Employees</p>
                      <p className="font-medium text-ink">{subscription.employeeCount} / {subscription.maxEmployees || '∞'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-ink-faint">Status</p>
                      <p className="font-medium text-ink">{subscription.status}</p>
                    </div>
                    <div>
                      <p className="text-xs text-ink-faint">Email</p>
                      <p className="font-medium text-ink">{subscription.billingEmail || 'Not set'}</p>
                    </div>
                  </div>
                  <Button className="mt-4" onClick={() => setShowPlanPicker(true)}>Change Plan</Button>
                </CardContent>
              </Card>

              {trial && trial.isTrial && (
                <Card>
                  <CardHeader><CardTitle>Trial Period</CardTitle></CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-ink-soft">
                            {trial.expired ? 'Your trial has expired.' : `${trial.daysRemaining} day(s) remaining`}
                          </span>
                          <span className="font-medium text-ink">
                            {trial.expired ? 'Expired' : `${trial.daysRemaining}d left`}
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-paper">
                          <div
                            className={`h-full rounded-full transition-all ${trial.expired ? 'bg-danger' : trial.daysRemaining <= 3 ? 'bg-amber' : 'bg-accent'}`}
                            style={{ width: trial.expired ? '100%' : `${Math.max(100 - trial.daysRemaining * 7, 10)}%` }}
                          />
                        </div>
                      </div>
                      {trial.expired && (
                        <Button onClick={() => setShowPlanPicker(true)}>Choose a Plan</Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="plans" className="space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {(plans || []).map((plan) => {
              const isCurrent = subscription?.billingPlan?.id === plan.id;
              const exampleCost50 = plan.minMonthlyFee > 0
                ? plan.minMonthlyFee
                : plan.pricePerEmployee * 50;
              const exampleCost100 = plan.minMonthlyFee > 0
                ? plan.minMonthlyFee
                : plan.pricePerEmployee * 100;
              return (
                <Card key={plan.id} className={`relative flex flex-col ${isCurrent ? 'ring-2 ring-accent' : ''}`}>
                  {isCurrent && (
                    <span className="absolute -top-2 -right-2 flex h-6 items-center rounded-full bg-accent px-2 text-[10px] font-medium text-white">
                      Current
                    </span>
                  )}
                  <CardHeader>
                    <CardTitle>{plan.name}</CardTitle>
                    {plan.minMonthlyFee > 0 ? (
                      <>
                        <p className="text-3xl font-serif font-semibold text-ink">{fmt(plan.minMonthlyFee)}<span className="text-sm font-normal text-ink-faint">/mo</span></p>
                        <p className="text-xs text-ink-faint">Flat rate for up to {plan.includedEmployees} employees</p>
                      </>
                    ) : (
                      <>
                        <p className="text-3xl font-serif font-semibold text-ink">{fmt(plan.pricePerEmployee)}<span className="text-sm font-normal text-ink-faint">/emp/mo</span></p>
                        <p className="text-xs text-ink-faint">Per employee per month</p>
                      </>
                    )}
                    {plan.annualDiscountPercent > 0 && (
                      <p className="text-xs text-accent font-medium">Save {plan.annualDiscountPercent}% with annual billing</p>
                    )}
                    <p className="text-sm text-ink-faint">{plan.description}</p>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col space-y-3">
                    <div className="flex items-center gap-2 text-sm"><Check size={14} className="text-accent" /> Up to {plan.maxEmployees.toLocaleString()} employees</div>
                    <div className="flex items-center gap-2 text-sm"><Check size={14} className="text-accent" /> {plan.maxStorageGB}GB storage</div>
                    {plan.features && Array.isArray(plan.features) && plan.features.map((f: string, i: number) => (
                      <div key={i} className="flex items-center gap-2 text-sm"><Check size={14} className="text-accent" /> {f}</div>
                    ))}
                    <div className="mt-auto pt-4">
                      {plan.minMonthlyFee === 0 && (
                        <p className="mb-2 text-xs text-ink-faint">
                          e.g. 50 emp: {fmt(exampleCost50)}/mo · 100 emp: {fmt(exampleCost100)}/mo
                        </p>
                      )}
                      {!isCurrent && (
                        <Button className="w-full" onClick={() => updateSubMut.mutate(plan.id)}>
                          {plan.minMonthlyFee === 0 ? 'Start at ' + fmt(plan.pricePerEmployee) + '/emp' : 'Select ' + plan.name}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="invoices" className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Invoice History</CardTitle></CardHeader>
            <CardContent>
              {invoices && invoices.length === 0 && (
                <p className="py-8 text-center text-sm text-ink-faint">No invoices yet.</p>
              )}
              {invoices && invoices.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Due Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell className="font-mono text-xs text-ink">{inv.invoiceNumber}</TableCell>
                        <TableCell className="text-ink-soft">{inv.description || '—'}</TableCell>
                        <TableCell className="font-medium text-ink">{fmt(inv.amount)}</TableCell>
                        <TableCell><Badge tone={STATUS_TONES[inv.status]}>{inv.status}</Badge></TableCell>
                        <TableCell className="text-ink-faint">{new Date(inv.createdAt).toLocaleDateString()}</TableCell>
                        <TableCell className="text-ink-faint">{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="branding" className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Custom Branding</CardTitle></CardHeader>
            <CardContent>
              {branding && branding.enabled ? (
                <div className="space-y-4">
                  <div className="flex gap-4">
                    <div className="h-16 w-16 rounded-lg" style={{ backgroundColor: branding.primaryColor }} />
                    <div className="h-16 w-16 rounded-lg" style={{ backgroundColor: branding.secondaryColor }} />
                    <div className="h-16 w-16 rounded-lg" style={{ backgroundColor: branding.accentColor }} />
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><span className="text-ink-faint">Primary:</span> {branding.primaryColor}</div>
                    <div><span className="text-ink-faint">Secondary:</span> {branding.secondaryColor}</div>
                    <div><span className="text-ink-faint">Accent:</span> {branding.accentColor}</div>
                    {branding.companyName && <div><span className="text-ink-faint">Company Name:</span> {branding.companyName}</div>}
                    {branding.customDomain && <div><span className="text-ink-faint">Custom Domain:</span> {branding.customDomain}</div>}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-ink-faint">Custom branding is not enabled on your current plan.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Update Branding</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-ink-faint">Custom branding requires the Professional plan or higher.</p>
              {(!subscription?.billingPlan || (subscription.billingPlan.slug !== 'professional' && subscription.billingPlan.slug !== 'enterprise')) && (
                <Button className="mt-3" variant="outline" onClick={() => setShowPlanPicker(true)}>Upgrade Plan</Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="features" className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Feature Access</CardTitle></CardHeader>
            <CardContent>
              {features && features.length === 0 && (
                <p className="text-sm text-ink-faint">No feature flags configured.</p>
              )}
              {features && features.length > 0 && (
                <div className="space-y-3">
                  {features.map((ff) => (
                    <div key={ff.id} className="flex items-center justify-between rounded-md border border-border p-3">
                      <div>
                        <p className="font-medium text-ink">{ff.name}</p>
                        <p className="text-xs text-ink-faint">{ff.description || ff.code}</p>
                      </div>
                      <Badge tone={ff.isEnabled ? 'success' : 'default'}>{ff.isEnabled ? 'Enabled' : 'Disabled'}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showPlanPicker} onOpenChange={o => !o && setShowPlanPicker(false)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Change Plan</DialogTitle>
            <DialogDescription>Select a new subscription plan for your company.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {(plans || []).map((plan) => (
              <div
                key={plan.id}
                className={`flex items-center justify-between rounded-md border p-4 cursor-pointer transition-colors hover:bg-paper ${selectedPlan === plan.id ? 'border-accent bg-accent-soft' : ''}`}
                onClick={() => setSelectedPlan(plan.id)}
              >
                <div>
                  <p className="font-medium text-ink">{plan.name}</p>
                  <p className="text-sm text-ink-soft">{plan.description}</p>
                  <p className="text-xs text-ink-faint">Up to {plan.maxEmployees.toLocaleString()} employees · {plan.maxStorageGB}GB storage</p>
                </div>
                <div className="text-right">
                  {plan.minMonthlyFee > 0 ? (
                    <>
                      <p className="font-serif text-lg font-semibold text-ink">{fmt(plan.minMonthlyFee)}</p>
                      <p className="text-xs text-ink-faint">flat/mo (up to {plan.includedEmployees} emp)</p>
                    </>
                  ) : (
                    <>
                      <p className="font-serif text-lg font-semibold text-ink">{fmt(plan.pricePerEmployee)}</p>
                      <p className="text-xs text-ink-faint">per employee/mo</p>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPlanPicker(false)}>Cancel</Button>
            <Button onClick={() => selectedPlan && updateSubMut.mutate(selectedPlan)} isLoading={updateSubMut.isPending} disabled={!selectedPlan}>
              Confirm Change
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
