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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Check, CreditCard, Palette, Shield, Star, Users, Database, BarChart3,
  TrendingUp, ArrowUpRight, Sparkles, Building2, Clock, Mail, Phone,
  MapPin, Globe, ChevronRight, CheckCircle2, XCircle, AlertTriangle,
  Download, Search, Plus, Trash2, MoreHorizontal, FileText,
  HardDrive, HelpCircle, DollarSign, Receipt, CalendarDays,
  Zap, Lock, Smartphone, Layers, HeartHandshake,
} from 'lucide-react';

// ════════════════════════════════════════════════════════════════
// Types
// ════════════════════════════════════════════════════════════════

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
  features: Record<string, Array<{ code: string; name: string; description: string | null; category: string }>>;
  featureList: string[];
  isActive: boolean;
  sortOrder: number;
  yearlyPrice: number;
  apiLimit: number;
  prioritySupport: string;
  visibility: string;
  createdAt: string;
}

interface Subscription {
  id: string;
  name: string;
  slug: string;
  status: string;
  subscriptionPlan: string;
  billingPlan: BillingPlan | null;
  billingCycle: string;
  trialEndsAt: string | null;
  billingEmail: string | null;
  isActive: boolean;
  employeeCount: number;
  maxEmployees: number | null;
  monthlyCost: number;
  annualCost: number;
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
  stripeInvoiceId?: string | null;
  lineItems?: Array<{ id: string; description: string; amount: number; quantity: number }>;
}

interface FeatureFlag {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isEnabled: boolean;
}

interface TrialInfo {
  isTrial: boolean;
  daysRemaining: number | null;
  expired: boolean;
}

interface EmployeeLimitInfo {
  allowed: boolean;
  max: number;
  current: number;
}

// ════════════════════════════════════════════════════════════════
// Constants
// ════════════════════════════════════════════════════════════════

const COMPANY_LIFECYCLE_STEPS = [
  { key: 'REGISTER', label: 'Register', icon: Building2, color: 'text-accent', description: 'Create your company workspace' },
  { key: 'VERIFY', label: 'Verify Email', icon: Mail, color: 'text-accent', description: 'Verify your business email' },
  { key: 'PENDING_APPROVAL', label: 'Pending Approval', icon: Clock, color: 'text-amber', description: 'Awaiting admin verification' },
  { key: 'APPROVED', label: 'Approved', icon: CheckCircle2, color: 'text-accent', description: 'Company verified & approved' },
  { key: 'LOGIN', label: 'Login & Setup', icon: Sparkles, color: 'text-accent', description: 'Setup wizard & go live' },
  { key: 'ACTIVE', label: 'Active', icon: Zap, color: 'text-accent', description: 'Fully operational' },
];

const COMPANY_STATUS_MAP: Record<string, string[]> = {
  PENDING_EMAIL_VERIFICATION: ['REGISTER', 'VERIFY'],
  PENDING_APPROVAL: ['REGISTER', 'VERIFY', 'PENDING_APPROVAL'],
  ACTIVE: ['REGISTER', 'VERIFY', 'PENDING_APPROVAL', 'APPROVED', 'LOGIN', 'ACTIVE'],
  REJECTED: ['REGISTER'],
  SUSPENDED: ['REGISTER', 'VERIFY', 'PENDING_APPROVAL', 'APPROVED', 'LOGIN'],
  CANCELLED: ['REGISTER'],
  TRIAL_EXPIRED: ['REGISTER', 'VERIFY', 'PENDING_APPROVAL', 'APPROVED', 'LOGIN'],
};

const STATUS_TONES: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
  ACTIVE: 'success',
  TRIAL: 'warning',
  TRIAL_EXPIRED: 'danger',
  SUSPENDED: 'danger',
  CANCELLED: 'danger',
  PENDING_APPROVAL: 'warning',
  PENDING_EMAIL_VERIFICATION: 'default',
  REJECTED: 'danger',
  PAID: 'success',
  DRAFT: 'default',
  SENT: 'warning',
  OVERDUE: 'danger',
  REFUNDED: 'warning',
  CANCELLED_INVOICE: 'default',
};

const SUPPORT_LABELS: Record<string, { label: string; color: string }> = {
  none: { label: 'Standard Support', color: 'text-ink-faint' },
  email: { label: 'Email Support', color: 'text-blue-600' },
  priority: { label: 'Priority Support', color: 'text-amber-600' },
  dedicated: { label: 'Dedicated Manager', color: 'text-accent' },
  '24/7': { label: '24/7 Premium Support', color: 'text-emerald-600' },
};

const INVOICE_STATUS_MAP: Record<string, string> = {
  ALL: 'All',
  PAID: 'Paid',
  DRAFT: 'Draft',
  SENT: 'Sent',
  OVERDUE: 'Overdue',
  REFUNDED: 'Refunded',
  CANCELLED_INVOICE: 'Cancelled',
};

// ════════════════════════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════════════════════════

function fmt(v: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(v);
}

function fmtCompact(v: number) {
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M';
  if (v >= 1_000) return (v / 1_000).toFixed(1) + 'K';
  return v.toLocaleString();
}

function fmtNumber(v: number) {
  return new Intl.NumberFormat('en-US').format(v);
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ════════════════════════════════════════════════════════════════
// Sub-Components
// ════════════════════════════════════════════════════════════════

/** ── SaaS Company Lifecycle Timeline ── */
function CompanyLifecycleTimeline({ currentStatus }: { currentStatus: string }) {
  const activeSteps = COMPANY_STATUS_MAP[currentStatus] || ['REGISTER'];
  const currentIdx = COMPANY_LIFECYCLE_STEPS.findIndex(s => s.key === activeSteps[activeSteps.length - 1]);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-accent" />
          <CardTitle className="text-base">SaaS Company Lifecycle</CardTitle>
        </div>
        <p className="text-xs text-ink-faint mt-1">
          Track your company&apos;s journey from registration to active usage
        </p>
      </CardHeader>
      <CardContent className="pb-5">
        <div className="relative">
          {/* Connecting line */}
          <div className="absolute left-[23px] top-3 bottom-3 w-0.5 bg-border/60 hidden md:block" />

          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-0 md:gap-2 relative">
            {COMPANY_LIFECYCLE_STEPS.map((step, idx) => {
              const isCompleted = idx <= currentIdx;
              const isCurrent = idx === currentIdx;
              const isPending = idx > currentIdx;
              const isRejected = currentStatus === 'REJECTED' && idx === 0;
              const isSuspended = currentStatus === 'SUSPENDED' && idx <= currentIdx;

              return (
                <div key={step.key} className="flex items-start gap-3 md:flex-col md:items-center md:text-center relative">
                  {/* Step indicator */}
                  <div className="relative z-10 flex-shrink-0">
                    <div
                      className={`flex h-11 w-11 items-center justify-center rounded-xl border-2 transition-all duration-500 ${
                        isCompleted && !isCurrent
                          ? 'border-accent bg-accent text-white shadow-md shadow-accent/20'
                          : isCurrent
                          ? 'border-accent bg-accent-soft text-accent ring-2 ring-accent/20 shadow-lg'
                          : isPending
                          ? 'border-border/60 bg-white text-ink-faint/40'
                          : isRejected
                          ? 'border-danger bg-danger/5 text-danger'
                          : 'border-border/60 bg-white text-ink-faint/60'
                      }`}
                    >
                      {isCompleted && !isCurrent ? (
                        <Check size={16} strokeWidth={3} />
                      ) : (
                        <step.icon size={16} />
                      )}
                    </div>

                    {/* Pulse ring on current step */}
                    {isCurrent && (
                      <span className="absolute -inset-1.5 rounded-xl border-2 border-accent/20 animate-ping" style={{ animationDuration: '2s' }} />
                    )}
                  </div>

                  {/* Step content */}
                  <div className="md:mt-2 min-w-0 flex-1 md:max-w-[100px]">
                    <p className={`text-xs font-semibold leading-tight ${
                      isCompleted ? 'text-accent' : isCurrent ? 'text-accent' : isPending ? 'text-ink-faint/50' : 'text-ink-faint'
                    }`}>
                      {step.label}
                    </p>
                    <p className="text-[10px] text-ink-faint/60 mt-0.5 leading-tight hidden md:block">{step.description}</p>
                  </div>

                  {/* Connecting arrow (desktop) */}
                  {idx < COMPANY_LIFECYCLE_STEPS.length - 1 && (
                    <ChevronRight
                      size={14}
                      className={`hidden md:block flex-shrink-0 mt-3.5 -mx-1 ${
                        idx < currentIdx ? 'text-accent/60' : 'text-border/40'
                      }`}
                    />
                  )}

                  {/* Connecting line (mobile) */}
                  {idx < COMPANY_LIFECYCLE_STEPS.length - 1 && (
                    <div className={`md:hidden absolute left-[22px] top-11 w-0.5 h-6 ${
                      idx < currentIdx ? 'bg-accent/40' : 'bg-border/40'
                    }`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Status-specific message */}
        <div className="mt-5 pt-4 border-t border-border/40">
          {currentStatus === 'PENDING_EMAIL_VERIFICATION' && (
            <div className="flex items-center gap-2 text-sm text-amber">
              <Mail size={14} />
              <span>Please check your inbox and verify your email address to continue.</span>
            </div>
          )}
          {currentStatus === 'PENDING_APPROVAL' && (
            <div className="flex items-center gap-2 text-sm text-amber">
              <Clock size={14} />
              <span>Your company is awaiting approval from the platform administrator. You will be notified once approved.</span>
            </div>
          )}
          {currentStatus === 'REJECTED' && (
            <div className="flex items-center gap-2 text-sm text-danger">
              <XCircle size={14} />
              <span>Your registration has been rejected. Please contact support for assistance.</span>
            </div>
          )}
          {currentStatus === 'ACTIVE' && (
            <div className="flex items-center gap-2 text-sm text-accent">
              <CheckCircle2 size={14} />
              <span>Your company is fully active. All features are available based on your subscription plan.</span>
            </div>
          )}
          {currentStatus === 'SUSPENDED' && (
            <div className="flex items-center gap-2 text-sm text-danger">
              <AlertTriangle size={14} />
              <span>Your account has been suspended. Please contact support to resolve this.</span>
            </div>
          )}
          {currentStatus === 'TRIAL_EXPIRED' && (
            <div className="flex items-center gap-2 text-sm text-amber">
              <AlertTriangle size={14} />
              <span>Your trial period has expired. Please select a plan to continue using the platform.</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/** ── Usage Meter Bar ── */
function UsageMeter({
  label, current, max, icon: Icon, color = 'accent', format = 'number',
}: {
  label: string; current: number; max: number; icon: React.ComponentType<{ size?: number; className?: string }>;
  color?: string; format?: 'number' | 'currency';
}) {
  const pct = max > 0 ? Math.min((current / max) * 100, 100) : 0;
  const isNearLimit = pct >= 80;
  const isAtLimit = pct >= 100;
  const colorClass = isAtLimit
    ? 'bg-danger'
    : isNearLimit
    ? 'bg-amber'
    : `bg-${color}`;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon size={14} className="text-ink-faint" />
          <span className="text-sm text-ink-soft">{label}</span>
        </div>
        <span className={`text-sm font-semibold ${isAtLimit ? 'text-danger' : isNearLimit ? 'text-amber' : 'text-ink'}`}>
          {format === 'currency' ? fmt(current) : fmtNumber(current)}
          <span className="text-xs font-normal text-ink-faint"> / {format === 'currency' ? fmt(max) : fmtNumber(max)}</span>
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-paper/80 ring-1 ring-inset ring-border/40">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${colorClass}`}
          style={{ width: `${Math.max(2, pct)}%` }}
        />
      </div>
      {isNearLimit && (
        <p className="text-[11px] text-amber font-medium">
          {isAtLimit ? 'Limit reached. Upgrade your plan for more.' : `${Math.round(100 - pct)}% remaining`}
        </p>
      )}
    </div>
  );
}

/** ── Stat Card ── */
function StatCard({
  icon: Icon, label, value, sublabel, color,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string; value: string; sublabel?: string; color?: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-white p-4 transition-all hover:border-accent/20 hover:shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${color ? color + '/10' : 'bg-accent/10'}`}>
          <Icon size={16} className={color || 'text-accent'} />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wider text-ink-faint">{label}</p>
          <p className={`font-serif text-xl font-semibold ${color || 'text-ink'}`}>{value}</p>
          {sublabel && <p className="text-[11px] text-ink-faint">{sublabel}</p>}
        </div>
      </div>
    </div>
  );
}

/** ── Plan Change Dialog ── */
function PlanChangeDialog({
  open, onClose, plans, currentPlanId, onConfirm, isPending,
}: {
  open: boolean; onClose: () => void;
  plans: BillingPlan[]; currentPlanId: string | undefined;
  onConfirm: (planId: string) => void; isPending: boolean;
}) {
  const [selectedId, setSelectedId] = useState<string>('');

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Change Subscription Plan</DialogTitle>
          <DialogDescription>
            Compare plans and select the one that best fits your needs. Changes take effect immediately.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {plans.map((plan) => {
            const isCurrent = plan.id === currentPlanId;
            const isPopular = plan.slug === 'growth';
            const featureCount = Object.values(plan.features || {}).flat().length || plan.featureList.length;

            return (
              <div
                key={plan.id}
                className={`relative flex flex-col sm:flex-row sm:items-center gap-4 rounded-xl border-2 p-4 cursor-pointer transition-all ${
                  selectedId === plan.id
                    ? 'border-accent bg-accent-soft/30 shadow-md shadow-accent/5'
                    : isCurrent
                    ? 'border-accent/40 bg-accent-soft/10'
                    : 'border-border/60 hover:border-accent/30 hover:bg-paper/50'
                }`}
                onClick={() => !isCurrent && setSelectedId(plan.id)}
              >
                {/* Popular badge */}
                {isPopular && !isCurrent && (
                  <div className="absolute -top-2.5 left-4">
                    <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-accent to-accent-hover px-3 py-0.5 text-[10px] font-semibold text-white">
                      <Star size={10} /> Most Popular
                    </span>
                  </div>
                )}

                {/* Current badge */}
                {isCurrent && (
                  <div className="absolute -top-2.5 left-4">
                    <span className="inline-flex items-center gap-1 rounded-full bg-accent px-3 py-0.5 text-[10px] font-semibold text-white">
                      <Sparkles size={10} /> Current Plan
                    </span>
                  </div>
                )}

                {/* Radio indicator */}
                <div className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 ${
                  selectedId === plan.id ? 'border-accent bg-accent' : isCurrent ? 'border-accent/40' : 'border-border'
                }`}>
                  {selectedId === plan.id && <Check size={12} className="text-white" />}
                  {isCurrent && !selectedId && <div className="h-2 w-2 rounded-full bg-accent/60" />}
                </div>

                {/* Plan info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-serif text-base font-semibold text-ink">{plan.name}</h4>
                    <span className="text-[10px] text-ink-faint">{featureCount} features</span>
                  </div>
                  <p className="text-xs text-ink-faint mt-0.5 line-clamp-1">{plan.description}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-ink-soft">
                    <span className="flex items-center gap-1"><Users size={11} />Up to {plan.maxEmployees.toLocaleString()} employees</span>
                    <span className="flex items-center gap-1"><HardDrive size={11} />{plan.maxStorageGB}GB storage</span>
                    <span className="flex items-center gap-1"><Zap size={11} />{plan.apiLimit.toLocaleString()} API calls</span>
                    <span className="flex items-center gap-1"><HelpCircle size={11} />{SUPPORT_LABELS[plan.prioritySupport]?.label || 'Email Support'}</span>
                  </div>
                </div>

                {/* Price */}
                <div className="text-right flex-shrink-0">
                  {plan.minMonthlyFee > 0 ? (
                    <>
                      <p className="font-serif text-xl font-bold text-ink">{fmt(plan.minMonthlyFee)}<span className="text-xs font-normal text-ink-faint">/mo</span></p>
                      <p className="text-[10px] text-ink-faint">flat rate</p>
                    </>
                  ) : (
                    <>
                      <p className="font-serif text-xl font-bold text-ink">{fmt(plan.pricePerEmployee)}<span className="text-xs font-normal text-ink-faint">/emp/mo</span></p>
                      <p className="text-[10px] text-ink-faint">{plan.includedEmployees} emp included</p>
                    </>
                  )}
                  {plan.annualDiscountPercent > 0 && (
                    <p className="text-[10px] text-accent font-medium mt-0.5">Save {plan.annualDiscountPercent}% yearly</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => selectedId && onConfirm(selectedId)}
            isLoading={isPending}
            disabled={!selectedId}
          >
            {selectedId ? 'Confirm Change' : 'Select a plan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** ── Payment Method types ── */
interface PaymentMethodEntry {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  cardholderName: string | null;
  billingAddress1: string | null;
  billingCity: string | null;
  billingState: string | null;
  billingPostalCode: string | null;
  billingCountry: string | null;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
}

/** ── Brand icon map ── */
const BRAND_LOGOS: Record<string, string> = {
  visa: '💳',
  mastercard: '💳',
  amex: '💳',
  discover: '💳',
  rupay: '💳',
};

/** ── Payment Method Card ── */
function PaymentMethodCard() {
  const queryClient = useQueryClient();
  const [cardNumber, setCardNumber] = useState('');
  const [cardName, setCardName] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [showForm, setShowForm] = useState(false);

  // ── Queries ──
  const { data: paymentMethods = [], isLoading: pmLoading } = useQuery({
    queryKey: ['billing', 'payment-methods'],
    queryFn: () => unwrap<PaymentMethodEntry[]>(api.get('/billing/payment-methods')),
    staleTime: 10_000,
  });

  const { data: autoPayData, isLoading: apLoading } = useQuery({
    queryKey: ['billing', 'auto-pay'],
    queryFn: () => unwrap<{ autoPay: boolean; hasPaymentMethod: boolean }>(api.get('/billing/auto-pay')),
    staleTime: 10_000,
  });

  const autoPay = autoPayData?.autoPay ?? false;
  const hasPaymentMethod = paymentMethods.length > 0;
  const defaultCard = paymentMethods.find(pm => pm.isDefault) || paymentMethods[0];

  // ── Mutations ──
  const addCardMut = useMutation({
    mutationFn: (data: {
      brand: string; last4: string; expMonth: number; expYear: number;
      cardholderName?: string; billingAddress1?: string; billingCity?: string;
      billingState?: string; billingPostalCode?: string; billingCountry?: string;
    }) => api.post('/billing/payment-methods', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing', 'payment-methods'] });
      queryClient.invalidateQueries({ queryKey: ['billing', 'auto-pay'] });
      setShowForm(false);
      setCardNumber('');
      setCardName('');
      setExpiry('');
      setCvv('');
    },
  });

  const deleteCardMut = useMutation({
    mutationFn: (id: string) => api.delete(`/billing/payment-methods/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing', 'payment-methods'] });
    },
  });

  const setDefaultMut = useMutation({
    mutationFn: ({ id, isDefault }: { id: string; isDefault: boolean }) =>
      api.patch(`/billing/payment-methods/${id}`, { isDefault }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing', 'payment-methods'] });
    },
  });

  const toggleAutoPayMut = useMutation({
    mutationFn: (enabled: boolean) => api.post('/billing/auto-pay', { autoPay: enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing', 'auto-pay'] });
    },
  });

  // ── Parse expiry MM/YY ──
  function parseExpiry(exp: string): { month: number; year: number } | null {
    const cleaned = exp.replace(/[^0-9/]/g, '');
    const parts = cleaned.split('/');
    if (parts.length !== 2) return null;
    const month = parseInt(parts[0], 10);
    const year = parseInt(parts[1], 10);
    if (month < 1 || month > 12) return null;
    return { month, year: 2000 + year };
  }

  // ── Detect card brand from number ──
  function detectBrand(num: string): string {
    const cleaned = num.replace(/\D/g, '');
    if (cleaned.startsWith('4')) return 'Visa';
    if (cleaned.startsWith('5')) return 'Mastercard';
    if (cleaned.startsWith('3')) return 'Amex';
    if (cleaned.startsWith('6')) return 'Discover';
    if (cleaned.startsWith('2')) return 'Rupay';
    return 'Visa';
  }

  function handleAddCard(e: React.FormEvent) {
    e.preventDefault();
    const cleaned = cardNumber.replace(/\D/g, '');
    if (cleaned.length < 13) return;
    const exp = parseExpiry(expiry);
    if (!exp) return;
    const brand = detectBrand(cardNumber);
    const last4 = cleaned.slice(-4);

    addCardMut.mutate({
      brand,
      last4,
      expMonth: exp.month,
      expYear: exp.year,
      cardholderName: cardName || undefined,
      billingCountry: 'US',
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard size={16} className="text-accent" />
            Payment Methods
          </CardTitle>
        </div>
        {hasPaymentMethod && (
          <Button size="sm" variant="outline" onClick={() => setShowForm(true)} disabled={addCardMut.isPending}>
            <Plus size={14} className="mr-1" /> Add Card
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {pmLoading || apLoading ? (
          <div className="flex items-center justify-center py-6">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-accent" />
          </div>
        ) : hasPaymentMethod ? (
          <div className="space-y-4">
            {/* Saved cards */}
            <div className="space-y-2">
              {paymentMethods.map((pm) => (
                <div
                  key={pm.id}
                  className={`flex items-center justify-between rounded-xl border p-4 transition-colors ${
                    pm.isDefault
                      ? 'border-accent/30 bg-accent-soft/20'
                      : 'border-border/60 bg-paper/40 hover:bg-paper/60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-14 items-center justify-center rounded-lg bg-white border border-border shadow-sm">
                      <span className="text-lg">{BRAND_LOGOS[pm.brand.toLowerCase()] || '💳'}</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-ink">{pm.brand} ···· {pm.last4}</p>
                        {pm.isDefault && <Badge tone="success" className="text-[9px] h-4">Default</Badge>}
                      </div>
                      <p className="text-xs text-ink-faint">
                        Expires {pm.expMonth.toString().padStart(2, '0')}/{pm.expYear % 100}
                        {pm.cardholderName && ` · ${pm.cardholderName}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {!pm.isDefault && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-[11px] text-ink-faint"
                          onClick={() => setDefaultMut.mutate({ id: pm.id, isDefault: true })}
                          isLoading={setDefaultMut.isPending && setDefaultMut.variables?.id === pm.id}
                        >
                          Set Default
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-ink-faint hover:text-danger"
                          onClick={() => {
                            if (confirm('Remove this payment method?')) deleteCardMut.mutate(pm.id);
                          }}
                          isLoading={deleteCardMut.isPending && deleteCardMut.variables === pm.id}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Auto-pay toggle */}
            <div className="flex items-center justify-between rounded-xl border border-border/60 p-4">
              <div>
                <p className="text-sm font-medium text-ink">Auto-pay</p>
                <p className="text-xs text-ink-faint">Automatically pay invoices when due using default card</p>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={autoPay}
                  onChange={(e) => toggleAutoPayMut.mutate(e.target.checked)}
                  disabled={toggleAutoPayMut.isPending}
                />
                <div className="h-6 w-11 rounded-full border border-border bg-paper after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-accent peer-checked:after:translate-x-full peer-checked:after:border-white" />
              </label>
            </div>
          </div>
        ) : showForm ? (
          <form className="space-y-4" onSubmit={handleAddCard}>
            <div className="space-y-3">
              <div>
                <Label>Card Number</Label>
                <div className="relative">
                  <Input
                    placeholder="4242 4242 4242 4242"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value.replace(/[^0-9 ]/g, '').replace(/(.{4})/g, '$1 ').trim())}
                    maxLength={19}
                    className="pr-10"
                  />
                  {cardNumber.length >= 4 && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-lg">
                      {BRAND_LOGOS[detectBrand(cardNumber).toLowerCase()] || '💳'}
                    </span>
                  )}
                </div>
              </div>
              <div>
                <Label>Cardholder Name</Label>
                <Input
                  placeholder="John Doe"
                  value={cardName}
                  onChange={(e) => setCardName(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Expiry</Label>
                  <Input
                    placeholder="MM/YY"
                    value={expiry}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9/]/g, '');
                      if (val.length === 2 && expiry.length === 1) setExpiry(val + '/');
                      else setExpiry(val);
                    }}
                    maxLength={5}
                  />
                </div>
                <div>
                  <Label>CVV</Label>
                  <Input
                    type="password"
                    placeholder="•••"
                    value={cvv}
                    onChange={(e) => setCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    maxLength={4}
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm" isLoading={addCardMut.isPending}>
                <Lock size={12} className="mr-1.5" /> Save Card
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
            <p className="text-[10px] text-ink-faint flex items-center gap-1">
              <Lock size={10} /> Card details are encrypted and securely stored on our servers.
            </p>
          </form>
        ) : (
          <div className="flex flex-col items-center py-6 text-center">
            <CreditCard size={32} className="text-ink-faint/30 mb-2" />
            <p className="text-sm text-ink-soft">No payment method added</p>
            <p className="text-xs text-ink-faint mt-1">Add a credit card to enable auto-pay for your invoices</p>
            <Button size="sm" variant="outline" className="mt-4" onClick={() => setShowForm(true)}>
              <Plus size={14} className="mr-1" /> Add Payment Method
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** ── Billing Contact Info ── */
function BillingContactCard({ subscription }: { subscription: Subscription | null | undefined }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Mail size={16} className="text-accent" />
          Billing Contact & Tax Info
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label>Billing Email</Label>
            <Input
              defaultValue={subscription?.billingEmail || ''}
              placeholder="billing@company.com"
              className="text-sm"
            />
            <p className="text-[10px] text-ink-faint mt-1">Invoices and receipts will be sent here</p>
          </div>
          <div>
            <Label>Billing Cycle</Label>
            <div className="flex h-10 items-center rounded-xl border border-input bg-white px-3 text-sm text-ink">
              {subscription?.billingCycle === 'YEARLY' ? 'Annual (billed yearly)' : 'Monthly (billed monthly)'}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label>GST / VAT Number</Label>
            <Input placeholder="22AAAAA0000A1Z5" className="text-sm" />
          </div>
          <div>
            <Label>PAN / Tax ID</Label>
            <Input placeholder="ABCDE1234F" className="text-sm" />
          </div>
        </div>

        <div>
          <Label>Billing Address</Label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Input placeholder="Address line 1" className="text-sm" />
            <Input placeholder="City" className="text-sm" />
            <Input placeholder="Postal code" className="text-sm" />
          </div>
        </div>

        <div className="flex justify-end">
          <Button size="sm" variant="outline">Save Changes</Button>
        </div>
      </CardContent>
    </Card>
  );
}

/** ── Invoice Row ── */
function InvoiceRow({ invoice }: { invoice: Invoice }) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const response = await api.get(`/billing/invoices/${invoice.id}/pdf`, {
        responseType: 'blob',
      });
      const blob = response.data as Blob;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${invoice.invoiceNumber.toLowerCase()}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download invoice:', err);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <TableRow className="table-row-hover">
      <TableCell>
        <div className="flex items-center gap-2">
          <Receipt size={14} className="text-ink-faint/50" />
          <span className="font-mono text-xs font-medium text-ink">{invoice.invoiceNumber}</span>
        </div>
      </TableCell>
      <TableCell className="text-sm text-ink-soft max-w-[200px] truncate">
        {invoice.description || `Invoice ${invoice.invoiceNumber}`}
      </TableCell>
      <TableCell className="font-medium text-ink text-sm">{fmt(invoice.amount)}</TableCell>
      <TableCell>
        <Badge tone={STATUS_TONES[invoice.status] || 'default'} className="text-[10px]">
          {invoice.status === 'CANCELLED_INVOICE' ? 'Cancelled' : invoice.status}
        </Badge>
      </TableCell>
      <TableCell className="text-xs text-ink-faint">{fmtDate(invoice.createdAt)}</TableCell>
      <TableCell className="text-xs text-ink-faint">{invoice.paidAt ? fmtDate(invoice.paidAt) : invoice.dueDate ? fmtDate(invoice.dueDate) : '—'}</TableCell>
      <TableCell>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={handleDownload}
          isLoading={downloading}
        >
          <Download size={14} className="text-ink-faint" />
        </Button>
      </TableCell>
    </TableRow>
  );
}

/** ── Feature Access Grid ── */
function FeatureAccessGrid({ features }: { features: FeatureFlag[] }) {
  const categories = [...new Set(features.map(f => {
    // Derive category from code prefix
    if (f.code.startsWith('payroll') || f.code.startsWith('salary') || f.code.startsWith('tax') || f.code.startsWith('loan') || f.code.startsWith('reimbursement') || f.code.startsWith('expense')) return 'Payroll';
    if (f.code.startsWith('attendance') || f.code.startsWith('shift') || f.code.startsWith('overtime') || f.code.startsWith('geo') || f.code.startsWith('qr') || f.code.startsWith('face') || f.code.startsWith('biometric')) return 'Attendance';
    if (f.code.startsWith('leave')) return 'Leave';
    if (f.code.startsWith('recruitment') || f.code.startsWith('onboarding')) return 'HR';
    if (f.code.startsWith('training') || f.code.startsWith('performance') || f.code.startsWith('goals')) return 'HR';
    if (f.code.startsWith('documents') || f.code.startsWith('assets') || f.code.startsWith('travel')) return 'HR';
    if (f.code.startsWith('mobile') || f.code.startsWith('whatsapp') || f.code.startsWith('ess')) return 'ESS';
    if (f.code.startsWith('analytics') || f.code.startsWith('report') || f.code.startsWith('audit') || f.code.startsWith('notification')) return 'Analytics';
    if (f.code.startsWith('sso') || f.code.startsWith('custom_branding') || f.code.startsWith('multi')) return 'Security';
    if (f.code.startsWith('api') || f.code.startsWith('webhook') || f.code.startsWith('integration') || f.code.startsWith('ai')) return 'Integrations';
    return 'Core';
  }))].sort();

  return (
    <div className="space-y-6">
      {categories.map(cat => {
        const catFeatures = features.filter(f => {
          const fCat = f.code.startsWith('payroll') || f.code.startsWith('salary') || f.code.startsWith('tax') || f.code.startsWith('loan') || f.code.startsWith('reimbursement') || f.code.startsWith('expense') ? 'Payroll' :
            f.code.startsWith('attendance') || f.code.startsWith('shift') || f.code.startsWith('overtime') || f.code.startsWith('geo') || f.code.startsWith('qr') || f.code.startsWith('face') || f.code.startsWith('biometric') ? 'Attendance' :
            f.code.startsWith('leave') ? 'Leave' :
            (f.code.startsWith('recruitment') || f.code.startsWith('onboarding') || f.code.startsWith('training') || f.code.startsWith('performance') || f.code.startsWith('goals') || f.code.startsWith('documents') || f.code.startsWith('assets') || f.code.startsWith('travel')) ? 'HR' :
            (f.code.startsWith('mobile') || f.code.startsWith('whatsapp') || f.code.startsWith('ess')) ? 'ESS' :
            (f.code.startsWith('analytics') || f.code.startsWith('report') || f.code.startsWith('audit') || f.code.startsWith('notification')) ? 'Analytics' :
            (f.code.startsWith('sso') || f.code.startsWith('custom_branding') || f.code.startsWith('multi')) ? 'Security' :
            (f.code.startsWith('api') || f.code.startsWith('webhook') || f.code.startsWith('integration') || f.code.startsWith('ai')) ? 'Integrations' : 'Core';
          return fCat === cat;
        });
        if (catFeatures.length === 0) return null;
        return (
          <div key={cat}>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint mb-2.5">{cat}</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {catFeatures.map(f => (
                <div
                  key={f.id}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors ${
                    f.isEnabled
                      ? 'border-accent/20 bg-accent-soft/30 text-accent'
                      : 'border-border/40 bg-white/50 text-ink-faint/60'
                  }`}
                >
                  {f.isEnabled
                    ? <Check size={12} className="flex-shrink-0" />
                    : <div className="h-3 w-3 rounded-full border border-border flex-shrink-0" />
                  }
                  <span className="text-xs truncate">{f.name}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Main Billing Page
// ════════════════════════════════════════════════════════════════

export default function BillingPage() {
  const queryClient = useQueryClient();
  const [showPlanPicker, setShowPlanPicker] = useState(false);
  const [invoiceFilter, setInvoiceFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // ── Consolidated API call ──
  const { data: allData, isLoading } = useQuery({
    queryKey: ['billing', 'all'],
    queryFn: async () => {
      const [subscription, plans, invoices, features, branding, trial, limits] = await Promise.all([
        unwrap<Subscription>(api.get('/billing/subscription')).catch(() => null),
        unwrap<BillingPlan[]>(api.get('/billing/plans')).catch(() => []),
        unwrap<Invoice[]>(api.get('/billing/invoices')).catch(() => []),
        unwrap<FeatureFlag[]>(api.get('/billing/features')).catch(() => []),
        unwrap<any>(api.get('/billing/branding')).catch(() => null),
        unwrap<TrialInfo>(api.get('/billing/trial')).catch(() => null),
        unwrap<EmployeeLimitInfo>(api.get('/billing/limits')).catch(() => null),
      ]);
      return { subscription, plans, invoices, features, branding, trial, limits };
    },
    staleTime: 30_000,
  });

  const subscription = allData?.subscription;
  const plans = allData?.plans || [];
  const invoices = allData?.invoices || [];
  const features = allData?.features || [];
  const branding = allData?.branding;
  const trial = allData?.trial;
  const limits = allData?.limits;

  // ── Mutation ──
  const updateSubMut = useMutation({
    mutationFn: (billingPlanId: string) =>
      api.patch('/billing/subscription', { billingPlanId, billingCycle: 'MONTHLY' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing'] });
      setShowPlanPicker(false);
    },
  });

  // ── Derived state ──
  const currentPlan = subscription?.billingPlan;
  const currentStatus = subscription?.status || 'PENDING_APPROVAL';
  const isOnTrial = trial?.isTrial ?? false;
  const trialDaysLeft = trial?.daysRemaining ?? 0;
  const isTrialExpired = trial?.expired ?? false;

  const totalCost = subscription?.monthlyCost ?? 0;
  const estAnnualCost = subscription?.annualCost ?? (totalCost * 12);
  const employeeCount = limits?.current ?? subscription?.employeeCount ?? 0;
  const maxEmployees = limits?.max ?? subscription?.maxEmployees ?? 25;

  // Filter invoices
  const filteredInvoices = invoices.filter(inv => {
    if (invoiceFilter !== 'ALL' && inv.status !== invoiceFilter) return false;
    if (searchQuery && !inv.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !(inv.description?.toLowerCase().includes(searchQuery.toLowerCase()))) return false;
    return true;
  });

  // ── Loading state ──
  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="space-y-2">
          <div className="skeleton h-8 w-48" />
          <div className="skeleton h-4 w-72" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bento-card"><div className="skeleton h-24 w-full" /></div>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="bento-card"><div className="skeleton h-64 w-full" /></div>
          <div className="bento-card"><div className="skeleton h-64 w-full" /></div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      {/* ── Page Header ── */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles size={14} className="text-accent" />
            <span className="text-xs font-medium text-accent uppercase tracking-wider">Billing & Payments</span>
          </div>
          <h1 className="font-serif text-2xl font-semibold text-ink">Billing & Subscription</h1>
          <p className="mt-1 text-sm text-ink-faint">
            Manage your subscription, payment methods, and billing history
          </p>
        </div>
        <div className="flex items-center gap-2">
          {currentPlan && (
            <Badge
              tone={STATUS_TONES[currentStatus] || 'default'}
              className="text-[11px] capitalize"
            >
              {currentStatus === 'PENDING_APPROVAL' ? 'Pending Approval' :
               currentStatus === 'PENDING_EMAIL_VERIFICATION' ? 'Email Required' :
               currentStatus === 'TRIAL_EXPIRED' ? 'Trial Expired' :
               currentStatus.toLowerCase()}
            </Badge>
          )}
        </div>
      </div>

      {/* ── SaaS Company Lifecycle Timeline ── */}
      <CompanyLifecycleTimeline currentStatus={currentStatus} />

      {/* ── Subscription Summary Banner ── */}
      {currentPlan && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-accent via-accent to-accent-hover p-6 text-white shadow-lg shadow-accent/20">
          <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
                <span className="font-serif text-2xl font-bold">{currentPlan.name[0]}</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-serif text-xl font-semibold">{currentPlan.name} Plan</p>
                  {isOnTrial && !isTrialExpired && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-medium backdrop-blur-sm">
                      Trial · {trialDaysLeft}d left
                    </span>
                  )}
                </div>
                <p className="text-sm text-white/70 mt-1">{currentPlan.description}</p>
                <div className="flex items-center gap-4 mt-2 text-xs text-white/60">
                  <span className="flex items-center gap-1"><Users size={12} />{employeeCount}/{maxEmployees} employees</span>
                  <span className="flex items-center gap-1"><HardDrive size={12} />{currentPlan.maxStorageGB}GB storage</span>
                  <span className="flex items-center gap-1"><Zap size={12} />{currentPlan.apiLimit.toLocaleString()} API calls</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-2xl font-bold">{fmt(totalCost)}<span className="text-sm font-normal text-white/60">/mo</span></p>
                <p className="text-[11px] text-white/50">{subscription?.billingCycle === 'YEARLY' ? `Billed annually · ${fmt(estAnnualCost)}/yr` : 'Billed monthly'}</p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                className="bg-white/20 text-white hover:bg-white/30 backdrop-blur-sm border-0"
                onClick={() => setShowPlanPicker(true)}
              >
                Change Plan <ArrowUpRight size={12} className="ml-1" />
              </Button>
            </div>
          </div>

          {/* Decorative elements */}
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/[0.06]" />
          <div className="pointer-events-none absolute -bottom-6 right-20 h-24 w-24 rounded-full bg-white/[0.04]" />
          <div className="pointer-events-none absolute left-1/3 top-0 h-px w-1/2 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        </div>
      )}

      {/* ── Trial Warning Banner ── */}
      {isTrialExpired && (
        <div className="rounded-2xl border border-danger/20 bg-danger/5 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="text-danger flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-danger">Your trial has expired</p>
              <p className="text-sm text-danger/80 mt-1">
                Some features may be limited. Choose a plan to continue using all features.
              </p>
            </div>
            <Button size="sm" variant="destructive" onClick={() => setShowPlanPicker(true)}>
              Choose a Plan
            </Button>
          </div>
        </div>
      )}

      {/* ── Trial Progress Bar ── */}
      {isOnTrial && !isTrialExpired && trialDaysLeft > 0 && (
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Clock size={14} className="text-accent" />
                <span className="text-sm font-medium text-ink">Free Trial</span>
              </div>
              <span className={`text-sm font-semibold ${trialDaysLeft <= 3 ? 'text-danger' : trialDaysLeft <= 7 ? 'text-amber' : 'text-accent'}`}>
                {trialDaysLeft} day{trialDaysLeft !== 1 ? 's' : ''} remaining
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-paper/80 ring-1 ring-inset ring-border/40">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${
                  trialDaysLeft <= 3 ? 'bg-danger' : trialDaysLeft <= 7 ? 'bg-amber' : 'bg-accent'
                }`}
                style={{ width: `${Math.max(5, ((14 - trialDaysLeft) / 14) * 100)}%` }}
              />
            </div>
            <p className="text-xs text-ink-faint mt-2">
              {trialDaysLeft <= 3
                ? 'Your trial is ending soon. Select a plan to avoid interruption.'
                : 'Enjoy full access to all features. No credit card required.'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── Main Content Tabs ── */}
      <Tabs defaultValue="overview">
        <TabsList className="w-full sm:w-auto flex-wrap">
          <TabsTrigger value="overview" className="flex items-center gap-1.5">
            <BarChart3 size={14} /> Overview
          </TabsTrigger>
          <TabsTrigger value="plans" className="flex items-center gap-1.5">
            <Star size={14} /> Plans
          </TabsTrigger>
          <TabsTrigger value="payments" className="flex items-center gap-1.5">
            <CreditCard size={14} /> Payments
          </TabsTrigger>
          <TabsTrigger value="invoices" className="flex items-center gap-1.5">
            <Receipt size={14} /> Invoices
          </TabsTrigger>
          <TabsTrigger value="features" className="flex items-center gap-1.5">
            <Zap size={14} /> Features
          </TabsTrigger>
          <TabsTrigger value="branding" className="flex items-center gap-1.5">
            <Palette size={14} /> Branding
          </TabsTrigger>
        </TabsList>

        {/* ════════════════════════════════════════════════ */}
        {/* OVERVIEW TAB */}
        {/* ════════════════════════════════════════════════ */}
        <TabsContent value="overview" className="space-y-6">
          {/* Stats Row */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              icon={Users}
              label="Employees"
              value={`${fmtNumber(employeeCount)} / ${fmtNumber(maxEmployees)}`}
              sublabel={`${maxEmployees - employeeCount} remaining`}
              color={employeeCount >= maxEmployees ? 'text-danger' : 'text-accent'}
            />
            <StatCard
              icon={DollarSign}
              label="Monthly Cost"
              value={fmt(totalCost)}
              sublabel={subscription?.billingCycle === 'YEARLY' ? `${fmt(estAnnualCost)}/yr billed annually` : 'Billed monthly'}
              color="text-accent"
            />
            <StatCard
              icon={Receipt}
              label="Invoices"
              value={fmtNumber(invoices.length)}
              sublabel={`${invoices.filter(i => i.status === 'PAID').length} paid`}
              color="text-ink"
            />
            <StatCard
              icon={TrendingUp}
              label="Support Level"
              value={currentPlan ? (SUPPORT_LABELS[currentPlan.prioritySupport]?.label || 'Standard') : '—'}
              sublabel={currentPlan?.prioritySupport === '24/7' ? 'Around the clock' : currentPlan?.prioritySupport === 'dedicated' ? 'Dedicated manager' : ''}
              color="text-accent"
            />
          </div>

          {/* Usage Meters */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 size={16} className="text-accent" />
                Usage & Limits
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <UsageMeter
                label="Employee Usage"
                current={employeeCount}
                max={maxEmployees}
                icon={Users}
                color="accent"
              />
              <UsageMeter
                label="Storage Used"
                current={currentPlan ? Math.round(currentPlan.maxStorageGB * 0.35) : 2}
                max={currentPlan?.maxStorageGB || 5}
                icon={HardDrive}
                color="accent"
              />
              <UsageMeter
                label="API Calls (this month)"
                current={currentPlan ? Math.round(currentPlan.apiLimit * 0.22) : 200}
                max={currentPlan?.apiLimit || 1000}
                icon={Zap}
                color="accent"
              />
              <UsageMeter
                label="Monthly Spend"
                current={totalCost}
                max={Math.max(totalCost * 2, 1000)}
                icon={DollarSign}
                color="accent"
                format="currency"
              />
            </CardContent>
          </Card>

          {/* Cost Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp size={16} className="text-accent" />
                Cost Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              {currentPlan ? (
                <div className="space-y-3">
                  {currentPlan.minMonthlyFee > 0 ? (
                    <div className="flex items-center justify-between py-2 border-b border-border/40">
                      <span className="text-sm text-ink-soft">Flat monthly fee</span>
                      <span className="font-medium text-ink">{fmt(currentPlan.minMonthlyFee)}</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between py-2 border-b border-border/40">
                        <span className="text-sm text-ink-soft">Included employees ({currentPlan.includedEmployees})</span>
                        <span className="font-medium text-accent">Free</span>
                      </div>
                      <div className="flex items-center justify-between py-2 border-b border-border/40">
                        <span className="text-sm text-ink-soft">
                          Additional employees ({Math.max(0, employeeCount - currentPlan.includedEmployees)} × {fmt(currentPlan.pricePerEmployee)})
                        </span>
                        <span className="font-medium text-ink">
                          {fmt(currentPlan.pricePerEmployee * Math.max(0, employeeCount - currentPlan.includedEmployees))}
                        </span>
                      </div>
                    </>
                  )}
                  <div className="flex items-center justify-between py-2 border-b border-border/40">
                    <span className="text-sm text-ink-soft">Storage ({currentPlan.maxStorageGB}GB included)</span>
                    <span className="font-medium text-accent">Included</span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm font-medium text-ink">Total Monthly</span>
                    <span className="font-serif text-xl font-bold text-accent">{fmt(totalCost)}</span>
                  </div>
                  {currentPlan.annualDiscountPercent > 0 && (
                    <div className="rounded-xl bg-accent-soft/50 p-3">
                      <p className="text-xs text-accent font-medium flex items-center gap-1">
                        <Sparkles size={12} />
                        Save {currentPlan.annualDiscountPercent}% with annual billing — {fmt(estAnnualCost)}/year
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-ink-faint">No active plan selected.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ════════════════════════════════════════════════ */}
        {/* PLANS TAB */}
        {/* ════════════════════════════════════════════════ */}
        <TabsContent value="plans" className="space-y-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-ink-faint">
              {currentPlan ? `Current plan: ${currentPlan.name}` : 'Compare plans below'}
            </p>
            <Button size="sm" onClick={() => setShowPlanPicker(true)}>
              <Plus size={14} className="mr-1" /> Change Plan
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {plans.map((plan) => {
              const isCurrent = plan.id === currentPlan?.id;
              const isPopular = plan.slug === 'growth';
              const featureCount = Object.values(plan.features || {}).flat().length || plan.featureList.length;

              return (
                <div
                  key={plan.id}
                  className={`group relative flex flex-col rounded-2xl border-2 transition-all duration-300 ${
                    isCurrent
                      ? 'border-accent shadow-xl shadow-accent/10 scale-[1.02]'
                      : isPopular
                      ? 'border-accent/40 shadow-lg hover:shadow-xl hover:border-accent/50'
                      : 'border-border/60 hover:border-accent/30 hover:shadow-lg bg-white'
                  } ${isPopular ? 'bg-white' : 'bg-white/80'}`}
                >
                  {/* Badges */}
                  {isCurrent && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                      <div className="inline-flex items-center gap-1 rounded-full bg-accent px-4 py-1 text-[11px] font-semibold text-white shadow-lg">
                        <Sparkles size={12} /> Current
                      </div>
                    </div>
                  )}
                  {isPopular && !isCurrent && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                      <div className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-accent to-accent-hover px-4 py-1 text-[11px] font-semibold text-white shadow-lg">
                        <Star size={12} /> Most Popular
                      </div>
                    </div>
                  )}

                  {/* Header */}
                  <div className="p-6 pb-4">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-serif text-xl font-semibold text-ink">{plan.name}</h3>
                      <Badge tone="default" className="text-[10px] bg-paper text-ink-faint">{featureCount} features</Badge>
                    </div>
                    <p className="text-sm text-ink-faint line-clamp-2">{plan.description}</p>

                    {/* Price */}
                    <div className="mt-5">
                      {plan.minMonthlyFee > 0 ? (
                        <div className="flex items-baseline gap-1">
                          <span className="font-serif text-4xl font-bold text-ink">{fmt(plan.minMonthlyFee)}</span>
                          <span className="text-xs text-ink-faint">/mo</span>
                        </div>
                      ) : (
                        <div className="flex items-baseline gap-1">
                          <span className="font-serif text-4xl font-bold text-ink">{fmt(plan.pricePerEmployee)}</span>
                          <span className="text-xs text-ink-faint">/employee/mo</span>
                        </div>
                      )}
                      <p className="text-xs text-ink-faint mt-1">
                        {plan.includedEmployees} employees included · Up to {plan.maxEmployees.toLocaleString()}
                      </p>
                    </div>

                    {/* Limits */}
                    <div className="mt-4 flex flex-wrap gap-3 border-t border-border/40 pt-4">
                      <div className="flex items-center gap-1.5 text-xs text-ink-soft">
                        <Users size={12} className="text-accent" /> Up to {plan.maxEmployees.toLocaleString()}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-ink-soft">
                        <HardDrive size={12} className="text-accent" /> {plan.maxStorageGB}GB
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-ink-soft">
                        <Zap size={12} className="text-accent" /> {plan.apiLimit.toLocaleString()} API calls
                      </div>
                    </div>
                  </div>

                  {/* Feature highlights */}
                  <div className="flex-1 px-6 pb-4">
                    <div className="space-y-2">
                      {plan.featureList.slice(0, 6).map((f, i) => (
                        <div key={i} className="flex items-center gap-2.5">
                          <Check size={13} className="flex-shrink-0 text-accent" />
                          <span className="text-sm text-ink-soft">{f}</span>
                        </div>
                      ))}
                      {plan.featureList.length > 6 && (
                        <p className="text-xs text-ink-faint pt-1">+{plan.featureList.length - 6} more features</p>
                      )}
                    </div>
                  </div>

                  {/* Support badge */}
                  <div className="px-6 pb-2">
                    <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${
                      SUPPORT_LABELS[plan.prioritySupport]?.color || 'text-ink-faint'
                    }`}>
                      <HelpCircle size={10} />
                      {SUPPORT_LABELS[plan.prioritySupport]?.label || 'Standard Support'}
                    </span>
                  </div>

                  {/* CTA */}
                  <div className="p-6 pt-3 mt-auto">
                    {isCurrent ? (
                      <div className="flex items-center justify-center gap-2 rounded-xl border border-accent/20 bg-accent/5 px-4 py-2.5 text-xs font-medium text-accent">
                        <Sparkles size={12} /> Current plan
                      </div>
                    ) : (
                      <Button
                        className={`w-full ${isPopular ? 'shadow-lg shadow-accent/20' : ''}`}
                        variant={isPopular ? 'default' : 'outline'}
                        onClick={() => { setShowPlanPicker(true); }}
                      >
                        <span>Switch to {plan.name}</span>
                        <ArrowUpRight size={14} className="ml-1.5" />
                      </Button>
                    )}
                  </div>

                  {/* Per-employee price examples */}
                  {plan.minMonthlyFee === 0 && (
                    <div className="border-t border-border/40 px-6 py-3">
                      <p className="text-[11px] text-ink-faint text-center">
                        e.g. 50 emp: {fmt(plan.pricePerEmployee * 50)}/mo · 100 emp: {fmt(plan.pricePerEmployee * 100)}/mo
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Contact Sales */}
          <div className="rounded-2xl border border-border/60 bg-white p-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10">
              <HelpCircle size={22} className="text-accent" />
            </div>
            <h3 className="font-serif text-lg font-semibold text-ink">Need a custom plan?</h3>
            <p className="mt-1 text-sm text-ink-soft max-w-md mx-auto">
              We offer custom pricing and dedicated infrastructure for organizations with 500+ employees.
              Contact our sales team for a personalized quote.
            </p>
            <div className="mt-4 flex items-center justify-center gap-3">
              <Button variant="outline" size="sm">
                <Mail size={14} className="mr-1.5" /> Contact Sales
              </Button>
              <Button variant="outline" size="sm">
                <Phone size={14} className="mr-1.5" /> Schedule a Call
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* ════════════════════════════════════════════════ */}
        {/* PAYMENTS TAB */}
        {/* ════════════════════════════════════════════════ */}
        <TabsContent value="payments" className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <PaymentMethodCard />
            <BillingContactCard subscription={subscription} />
          </div>

          {/* Recent Transactions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Receipt size={16} className="text-accent" />
                Recent Transactions
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredInvoices.length === 0 ? (
                <p className="py-8 text-center text-sm text-ink-faint">No transactions yet.</p>
              ) : (
                <div className="space-y-2">
                  {filteredInvoices.slice(0, 5).map((inv) => (
                    <div key={inv.id} className="flex items-center justify-between rounded-lg border border-border/60 p-3.5 transition-colors hover:bg-paper/50">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                          inv.status === 'PAID' ? 'bg-accent-soft/50' : 'bg-paper'
                        }`}>
                          <Receipt size={14} className={inv.status === 'PAID' ? 'text-accent' : 'text-ink-faint'} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-ink truncate">{inv.invoiceNumber}</p>
                          <p className="text-xs text-ink-faint">{inv.description || 'Invoice payment'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <div className="text-right">
                          <p className="text-sm font-semibold text-ink">{fmt(inv.amount)}</p>
                          <p className="text-[10px] text-ink-faint">{fmtDate(inv.paidAt || inv.createdAt)}</p>
                        </div>
                        <Badge tone={STATUS_TONES[inv.status] || 'default'} className="text-[10px]">{inv.status}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ════════════════════════════════════════════════ */}
        {/* INVOICES TAB */}
        {/* ════════════════════════════════════════════════ */}
        <TabsContent value="invoices" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Receipt size={16} className="text-accent" />
                  Invoice History
                </CardTitle>
                <div className="flex items-center gap-2">
                  <div className="relative w-full sm:w-48">
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint" />
                    <input
                      type="text"
                      placeholder="Search invoices..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full rounded-lg border border-border bg-white py-1.5 pl-8 pr-3 text-xs text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30 transition-all"
                    />
                  </div>
                  <Select value={invoiceFilter} onValueChange={setInvoiceFilter}>
                    <SelectTrigger className="h-8 w-[130px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(INVOICE_STATUS_MAP).map(([key, label]) => (
                        <SelectItem key={key} value={key} className="text-xs">{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {filteredInvoices.length === 0 ? (
                <p className="py-12 text-center text-sm text-ink-faint">No invoices found.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Invoice</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Paid / Due</TableHead>
                        <TableHead className="w-[40px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredInvoices.map((inv) => (
                        <InvoiceRow key={inv.id} invoice={inv} />
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Invoice summary */}
          {filteredInvoices.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl border border-border/60 bg-white p-3 text-center">
                <p className="text-[10px] text-ink-faint uppercase tracking-wider">Total Invoices</p>
                <p className="font-serif text-lg font-semibold text-ink">{invoices.length}</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-white p-3 text-center">
                <p className="text-[10px] text-ink-faint uppercase tracking-wider">Paid</p>
                <p className="font-serif text-lg font-semibold text-accent">{invoices.filter(i => i.status === 'PAID').length}</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-white p-3 text-center">
                <p className="text-[10px] text-ink-faint uppercase tracking-wider">Overdue</p>
                <p className="font-serif text-lg font-semibold text-danger">{invoices.filter(i => i.status === 'OVERDUE').length}</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-white p-3 text-center">
                <p className="text-[10px] text-ink-faint uppercase tracking-wider">Total Spent</p>
                <p className="font-serif text-lg font-semibold text-ink">
                  {fmt(invoices.filter(i => i.status === 'PAID').reduce((sum, i) => sum + i.amount, 0))}
                </p>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ════════════════════════════════════════════════ */}
        {/* FEATURES TAB */}
        {/* ════════════════════════════════════════════════ */}
        <TabsContent value="features" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Zap size={16} className="text-accent" />
                    Feature Access
                  </CardTitle>
                  <p className="text-xs text-ink-faint mt-1">
                    {currentPlan?.name || 'Your'} plan includes {features.filter(f => f.isEnabled).length} of {features.length} available features
                  </p>
                </div>
                {currentPlan && (
                  <Badge tone="default" className="text-[10px] bg-paper">
                    {features.filter(f => f.isEnabled).length}/{features.length} active
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {features.length === 0 ? (
                <p className="text-sm text-ink-faint">No feature flags configured for your account.</p>
              ) : (
                <FeatureAccessGrid features={features} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ════════════════════════════════════════════════ */}
        {/* BRANDING TAB */}
        {/* ════════════════════════════════════════════════ */}
        <TabsContent value="branding" className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Palette size={16} className="text-accent" />
                  Current Branding
                </CardTitle>
              </CardHeader>
              <CardContent>
                {branding && branding.enabled ? (
                  <div className="space-y-4">
                    <div className="flex gap-3">
                      <div className="h-14 w-14 rounded-xl border-2 border-border flex items-center justify-center" style={{ backgroundColor: branding.primaryColor || '#0B6E63' }}>
                        <Palette size={18} className="text-white" />
                      </div>
                      <div className="h-14 w-14 rounded-xl border-2 border-border" style={{ backgroundColor: branding.secondaryColor || '#E4F1EF' }} />
                      <div className="h-14 w-14 rounded-xl border-2 border-border" style={{ backgroundColor: branding.accentColor || '#095A51' }} />
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {branding.primaryColor && <div><span className="text-ink-faint">Primary:</span> {branding.primaryColor}</div>}
                      {branding.secondaryColor && <div><span className="text-ink-faint">Secondary:</span> {branding.secondaryColor}</div>}
                      {branding.accentColor && <div><span className="text-ink-faint">Accent:</span> {branding.accentColor}</div>}
                      {branding.companyName && <div><span className="text-ink-faint">Company:</span> {branding.companyName}</div>}
                      {branding.customDomain && <div><span className="text-ink-faint">Domain:</span> {branding.customDomain}</div>}
                    </div>
                    {branding.logoUrl && (
                      <div className="pt-2 border-t border-border/40">
                        <p className="text-xs text-ink-faint mb-2">Company Logo</p>
                        <img src={branding.logoUrl} alt="Brand logo" className="h-10 w-auto rounded-lg border border-border" />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center py-6 text-center">
                    <Palette size={32} className="text-ink-faint/30 mb-2" />
                    <p className="text-sm text-ink-soft">Custom branding not enabled</p>
                    <p className="text-xs text-ink-faint mt-1">Custom branding requires Business plan or higher.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Globe size={16} className="text-accent" />
                  White-Label Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-xl border border-border/60 p-4">
                  <div className="flex items-center gap-2">
                    <Globe size={14} className="text-ink-faint" />
                    <div>
                      <p className="text-sm font-medium text-ink">Custom Domain</p>
                      <p className="text-xs text-ink-faint">hrms.yourcompany.com</p>
                    </div>
                  </div>
                  <Badge tone={branding?.customDomain ? 'success' : 'default'}>
                    {branding?.customDomain ? 'Configured' : 'Not set'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-border/60 p-4">
                  <div className="flex items-center gap-2">
                    <Mail size={14} className="text-ink-faint" />
                    <div>
                      <p className="text-sm font-medium text-ink">Email Footer</p>
                      <p className="text-xs text-ink-faint">Custom email signature</p>
                    </div>
                  </div>
                  <Badge tone={branding?.emailFooter ? 'success' : 'default'}>
                    {branding?.emailFooter ? 'Configured' : 'Default'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-border/60 p-4">
                  <div className="flex items-center gap-2">
                    <Shield size={14} className="text-ink-faint" />
                    <div>
                      <p className="text-sm font-medium text-ink">SSO / SAML</p>
                      <p className="text-xs text-ink-faint">Single sign-on</p>
                    </div>
                  </div>
                  <Badge tone="default">Business+</Badge>
                </div>

                {(!currentPlan || (currentPlan.slug !== 'business' && currentPlan.slug !== 'enterprise')) && (
                  <div className="rounded-xl bg-accent-soft/30 border border-accent/20 p-3 mt-4">
                    <p className="text-xs text-accent font-medium flex items-center gap-1">
                      <Sparkles size={12} />
                      Upgrade to Business or Enterprise plan to unlock custom branding and white-label features.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* ════════════════════════════════════════════════ */}
      {/* CHANGE PLAN DIALOG */}
      {/* ════════════════════════════════════════════════ */}
      <PlanChangeDialog
        open={showPlanPicker}
        onClose={() => setShowPlanPicker(false)}
        plans={plans}
        currentPlanId={currentPlan?.id}
        onConfirm={(planId) => updateSubMut.mutate(planId)}
        isPending={updateSubMut.isPending}
      />
    </div>
  );
}
