'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Check, ArrowRight, Sparkles, Building2, Users, Clock, Shield,
  BarChart3, Zap, Star, Globe, CreditCard, ChevronDown, Mail, Phone,
  MapPin, Linkedin, Twitter, Github, Play, Facebook, Instagram,
  Layers, HeadphonesIcon, Cloud, Smartphone,
  Palette, HeartHandshake, LineChart, Lock, Radio, HelpCircle,
  Menu, X, Target, Share2, MessageSquare,
  CheckCircle2, Minus, Youtube,
} from 'lucide-react';

// ──────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────

interface PlanFeature {
  code: string;
  name: string;
  description: string | null;
  category: string;
}

interface Plan {
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
  sortOrder: number;
  isActive: boolean;
  yearlyPrice: number;
  apiLimit: number;
  prioritySupport: string;
  visibility: string;
  features: Record<string, PlanFeature[]>;
  featureList: string[];
}

// ──────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────

function fmt(v: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(v);
}

const CATEGORY_LABELS: Record<string, string> = {
  core: 'Core HR',
  attendance: 'Attendance',
  leave: 'Leave Management',
  payroll: 'Payroll & Finance',
  hr: 'HR Management',
  ess: 'Employee Self-Service',
  analytics: 'Analytics & Reports',
  security: 'Security & Branding',
  integrations: 'Integrations & API',
};

// ──────────────────────────────────────────────────────────────────
// Data
// ──────────────────────────────────────────────────────────────────

const HIGHLIGHTS = [
  { icon: Users, label: 'Employee Management', desc: 'Complete employee lifecycle from onboarding to offboarding' },
  { icon: Clock, label: 'Time & Attendance', desc: 'Smart attendance with GPS, QR code & face recognition' },
  { icon: Shield, label: 'Payroll & Compliance', desc: 'Automated payroll with full statutory compliance (PF/ESI/PT)' },
  { icon: BarChart3, label: 'Analytics & Reports', desc: 'Real-time HR analytics and custom report builder' },
  { icon: Zap, label: 'Leave & Holidays', desc: 'Automated leave policies, balances, and approval workflows' },
  { icon: Globe, label: 'Multi-Branch', desc: 'Manage multiple branches, departments, and locations centrally' },
];

const HOW_IT_WORKS = [
  { step: '01', icon: Building2, title: 'Set up your workspace', desc: 'Create your company profile, add branches, departments, and configure your organizational structure in minutes.' },
  { step: '02', icon: Users, title: 'Add your team', desc: 'Invite employees, assign roles and designations, and set up reporting hierarchies effortlessly.' },
  { step: '03', icon: Play, title: 'Go live', desc: 'Start tracking attendance, processing payroll, managing leaves, and running your HR operations from day one.' },
];

const FEATURES_BENTO = [
  { icon: Cloud, title: 'Cloud-Native Platform', desc: 'Access your HR data anytime, anywhere with our secure cloud infrastructure.', accent: false, wide: false },
  { icon: Smartphone, title: 'Mobile-First Design', desc: 'Full-featured mobile experience for employees on the go.', accent: false, wide: false },
  { icon: Lock, title: 'Enterprise Security', desc: 'SOC 2 compliant, encrypted data, SSO authentication, and role-based access control.', accent: true, wide: true },
  { icon: Layers, title: 'Modular Architecture', desc: 'Pay only for what you need. Add modules as your organization grows.', accent: false, wide: false },
  { icon: LineChart, title: 'Advanced Analytics', desc: 'Custom dashboards, real-time metrics, and exportable reports.', accent: false, wide: false },
  { icon: HeartHandshake, title: 'Dedicated Support', desc: '24/7 customer support with dedicated account managers for enterprise plans.', accent: false, wide: true },
  { icon: Palette, title: 'Custom Branding', desc: 'White-label the platform with your company logo, colors, and domain.', accent: false, wide: false },
  { icon: Share2, title: 'Seamless Integrations', desc: 'Connect with your favorite tools: Slack, Zapier, accounting software, and more.', accent: false, wide: false },
  { icon: HeadphonesIcon, title: 'Employee Portal', desc: 'Self-service portal for employees to manage their profile, requests, and documents.', accent: false, wide: false },
];

const FAQS = [
  { q: 'How does the 14-day free trial work?', a: 'You get full access to all features in your chosen plan for 14 days with no credit card required. No commitments, cancel anytime.' },
  { q: 'Can I switch plans later?', a: 'Absolutely. You can upgrade or downgrade your plan at any time. Changes take effect immediately, and we prorate billing accordingly.' },
  { q: 'What payment methods do you accept?', a: 'We accept all major credit cards (Visa, Mastercard, American Express), PayPal, and bank transfers for annual plans.' },
  { q: 'Is my data secure?', a: 'Yes. We use enterprise-grade encryption (AES-256 at rest, TLS 1.3 in transit), SOC 2 controls, and regular security audits. Your data is hosted on AWS with 99.99% uptime SLA.' },
  { q: 'Do you offer custom enterprise plans?', a: 'Yes! Contact our sales team for custom pricing, dedicated infrastructure, SLA guarantees, and personalized onboarding for organizations with 500+ employees.' },
  { q: 'Can I migrate data from my current HR system?', a: 'We offer free data migration support for all paid plans. Our team will help you import employee data, attendance records, and payroll history seamlessly.' },
];

const FOOTER_LINKS = {
  product: [
    { label: 'Features', href: '#features' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'Integrations', href: '#' },
    { label: 'API Documentation', href: '#' },
    { label: 'Changelog', href: '#' },
  ],
  solutions: [
    { label: 'Small Business', href: '#' },
    { label: 'Enterprise', href: '#' },
    { label: 'Startups', href: '#' },
    { label: 'Remote Teams', href: '#' },
    { label: 'Non-Profits', href: '#' },
  ],
  resources: [
    { label: 'Documentation', href: '#' },
    { label: 'Help Center', href: '#' },
    { label: 'Blog', href: '#' },
    { label: 'Community', href: '#' },
    { label: 'Webinars', href: '#' },
  ],
  company: [
    { label: 'About Us', href: '#' },
    { label: 'Careers', href: '#' },
    { label: 'Press Kit', href: '#' },
    { label: 'Partners', href: '#' },
    { label: 'Privacy Policy', href: '#' },
    { label: 'Terms of Service', href: '#' },
  ],
};

const SOCIAL_LINKS = [
  { icon: Linkedin, href: '#', label: 'LinkedIn' },
  { icon: Twitter, href: '#', label: 'Twitter / X' },
  { icon: Github, href: '#', label: 'GitHub' },
  { icon: Youtube, href: '#', label: 'YouTube' },
  { icon: Facebook, href: '#', label: 'Facebook' },
  { icon: Instagram, href: '#', label: 'Instagram' },
];

// ──────────────────────────────────────────────────────────────────
// Static Default Plans (fallback when API is unavailable)
// ──────────────────────────────────────────────────────────────────

const DEFAULT_PLANS: Plan[] = [
  {
    id: 'starter-plan',
    name: 'Starter',
    slug: 'starter',
    description: 'Everything you need to get started with essential HR tools for small teams.',
    minMonthlyFee: 0,
    pricePerEmployee: 0,
    includedEmployees: 25,
    maxEmployees: 25,
    maxStorageGB: 5,
    annualDiscountPercent: 0,
    currency: 'USD',
    sortOrder: 0,
    isActive: true,
    yearlyPrice: 0,
    apiLimit: 1000,
    prioritySupport: 'email',
    visibility: 'PUBLIC',
    features: {
      core: [
        { code: 'employee_management', name: 'Employee Management', description: null, category: 'core' },
        { code: 'department_branch', name: 'Departments & Branches', description: null, category: 'core' },
        { code: 'designations', name: 'Designations', description: null, category: 'core' },
        { code: 'onboarding', name: 'Employee Onboarding', description: null, category: 'core' },
        { code: 'documents', name: 'Document Management', description: null, category: 'core' },
      ],
      attendance: [
        { code: 'attendance', name: 'Attendance Tracking', description: null, category: 'attendance' },
        { code: 'shift_management', name: 'Shift Management', description: null, category: 'attendance' },
      ],
      leave: [
        { code: 'leave_management', name: 'Leave Management', description: null, category: 'leave' },
        { code: 'leave_types', name: 'Custom Leave Types', description: null, category: 'leave' },
        { code: 'leave_balance', name: 'Leave Balance Tracking', description: null, category: 'leave' },
      ],
      ess: [
        { code: 'ess', name: 'Employee Self-Service (ESS)', description: null, category: 'ess' },
        { code: 'mobile_app', name: 'Mobile App Access', description: null, category: 'ess' },
      ],
      analytics: [
        { code: 'basic_reports', name: 'Basic Reports', description: null, category: 'analytics' },
        { code: 'notifications', name: 'Notifications & Alerts', description: null, category: 'analytics' },
      ],
    },
    featureList: [
      'Employee Management', 'Departments & Branches', 'Designations',
      'Attendance Tracking', 'Shift Management',
      'Leave Management', 'Custom Leave Types', 'Leave Balance Tracking',
      'Employee Self-Service (ESS)', 'Mobile App Access',
      'Basic Reports', 'Notifications & Alerts',
      'Employee Onboarding', 'Document Management',
    ],
  },
  {
    id: 'growth-plan',
    name: 'Growth',
    slug: 'growth',
    description: 'Perfect for growing teams that need payroll, compliance, and advanced attendance features.',
    minMonthlyFee: 0,
    pricePerEmployee: 5,
    includedEmployees: 25,
    maxEmployees: 100,
    maxStorageGB: 15,
    annualDiscountPercent: 15,
    currency: 'USD',
    sortOrder: 1,
    isActive: true,
    yearlyPrice: 0,
    apiLimit: 10000,
    prioritySupport: 'priority',
    visibility: 'PUBLIC',
    features: {
      core: [
        { code: 'employee_management', name: 'Employee Management', description: null, category: 'core' },
        { code: 'department_branch', name: 'Departments & Branches', description: null, category: 'core' },
        { code: 'designations', name: 'Designations', description: null, category: 'core' },
        { code: 'approval_workflow', name: 'Approval Workflows', description: null, category: 'core' },
        { code: 'onboarding', name: 'Employee Onboarding', description: null, category: 'core' },
        { code: 'documents', name: 'Document Management', description: null, category: 'core' },
        { code: 'document_templates', name: 'Document Templates', description: null, category: 'core' },
      ],
      attendance: [
        { code: 'attendance', name: 'Attendance Tracking', description: null, category: 'attendance' },
        { code: 'shift_management', name: 'Shift Management', description: null, category: 'attendance' },
        { code: 'overtime', name: 'Overtime Tracking', description: null, category: 'attendance' },
        { code: 'geo_fence', name: 'Geo Fencing', description: null, category: 'attendance' },
        { code: 'gps_attendance', name: 'GPS Attendance', description: null, category: 'attendance' },
        { code: 'qr_attendance', name: 'QR Attendance', description: null, category: 'attendance' },
      ],
      leave: [
        { code: 'leave_management', name: 'Leave Management', description: null, category: 'leave' },
        { code: 'leave_types', name: 'Custom Leave Types', description: null, category: 'leave' },
        { code: 'leave_balance', name: 'Leave Balance Tracking', description: null, category: 'leave' },
      ],
      payroll: [
        { code: 'payroll', name: 'Payroll Processing', description: null, category: 'payroll' },
        { code: 'payslips', name: 'Payslips', description: null, category: 'payroll' },
        { code: 'salary_structures', name: 'Salary Structures', description: null, category: 'payroll' },
        { code: 'tax_calculations', name: 'Tax Calculations', description: null, category: 'payroll' },
        { code: 'loans', name: 'Employee Loans', description: null, category: 'payroll' },
        { code: 'expenses', name: 'Expense Management', description: null, category: 'payroll' },
        { code: 'reimbursements', name: 'Reimbursements', description: null, category: 'payroll' },
        { code: 'statutory_compliance', name: 'Statutory Compliance (PF/ESI/PT)', description: null, category: 'payroll' },
      ],
      hr: [
        { code: 'assets', name: 'Asset Management', description: null, category: 'hr' },
        { code: 'travel', name: 'Travel Management', description: null, category: 'hr' },
        { code: 'training', name: 'Training & LMS', description: null, category: 'hr' },
      ],
      ess: [
        { code: 'ess', name: 'Employee Self-Service (ESS)', description: null, category: 'ess' },
        { code: 'mobile_app', name: 'Mobile App Access', description: null, category: 'ess' },
      ],
      analytics: [
        { code: 'basic_reports', name: 'Basic Reports', description: null, category: 'analytics' },
        { code: 'audit_logs', name: 'Audit Logs', description: null, category: 'analytics' },
        { code: 'notifications', name: 'Notifications & Alerts', description: null, category: 'analytics' },
      ],
    },
    featureList: [
      'Employee Management', 'Departments & Branches', 'Designations', 'Approval Workflows',
      'Attendance Tracking', 'Shift Management', 'Overtime Tracking', 'Geo Fencing',
      'GPS Attendance', 'QR Attendance',
      'Leave Management', 'Custom Leave Types', 'Leave Balance Tracking',
      'Payroll Processing', 'Payslips', 'Salary Structures', 'Tax Calculations',
      'Employee Loans', 'Expense Management', 'Reimbursements', 'Statutory Compliance',
      'Asset Management', 'Travel Management', 'Training & LMS',
      'Employee Self-Service', 'Mobile App Access',
      'Basic Reports', 'Audit Logs', 'Notifications & Alerts',
      'Employee Onboarding', 'Document Management', 'Document Templates',
    ],
  },
  {
    id: 'business-plan',
    name: 'Business',
    slug: 'business',
    description: 'Advanced features for established organizations with multiple branches and complex needs.',
    minMonthlyFee: 0,
    pricePerEmployee: 10,
    includedEmployees: 50,
    maxEmployees: 500,
    maxStorageGB: 50,
    annualDiscountPercent: 17,
    currency: 'USD',
    sortOrder: 2,
    isActive: true,
    yearlyPrice: 0,
    apiLimit: 50000,
    prioritySupport: 'dedicated',
    visibility: 'PUBLIC',
    features: {
      core: [
        { code: 'employee_management', name: 'Employee Management', description: null, category: 'core' },
        { code: 'department_branch', name: 'Departments & Branches', description: null, category: 'core' },
        { code: 'designations', name: 'Designations', description: null, category: 'core' },
        { code: 'roles_permissions', name: 'Custom Roles & Permissions', description: 'Define custom roles with granular permissions', category: 'core' },
        { code: 'approval_workflow', name: 'Approval Workflows', description: null, category: 'core' },
        { code: 'onboarding', name: 'Employee Onboarding', description: null, category: 'core' },
        { code: 'documents', name: 'Document Management', description: null, category: 'core' },
        { code: 'document_templates', name: 'Document Templates', description: null, category: 'core' },
      ],
      attendance: [
        { code: 'attendance', name: 'Attendance Tracking', description: null, category: 'attendance' },
        { code: 'shift_management', name: 'Shift Management', description: null, category: 'attendance' },
        { code: 'roster', name: 'Roster / Scheduling', description: null, category: 'attendance' },
        { code: 'overtime', name: 'Overtime Tracking', description: null, category: 'attendance' },
        { code: 'geo_fence', name: 'Geo Fencing', description: null, category: 'attendance' },
        { code: 'gps_attendance', name: 'GPS Attendance', description: null, category: 'attendance' },
        { code: 'qr_attendance', name: 'QR Attendance', description: null, category: 'attendance' },
        { code: 'face_recognition', name: 'Face Recognition', description: null, category: 'attendance' },
        { code: 'biometric', name: 'Biometric Integration', description: null, category: 'attendance' },
      ],
      leave: [
        { code: 'leave_management', name: 'Leave Management', description: null, category: 'leave' },
        { code: 'leave_types', name: 'Custom Leave Types', description: null, category: 'leave' },
        { code: 'leave_balance', name: 'Leave Balance Tracking', description: null, category: 'leave' },
      ],
      payroll: [
        { code: 'payroll', name: 'Payroll Processing', description: null, category: 'payroll' },
        { code: 'payslips', name: 'Payslips', description: null, category: 'payroll' },
        { code: 'salary_structures', name: 'Salary Structures', description: null, category: 'payroll' },
        { code: 'tax_calculations', name: 'Tax Calculations', description: null, category: 'payroll' },
        { code: 'loans', name: 'Employee Loans', description: null, category: 'payroll' },
        { code: 'expenses', name: 'Expense Management', description: null, category: 'payroll' },
        { code: 'reimbursements', name: 'Reimbursements', description: null, category: 'payroll' },
        { code: 'statutory_compliance', name: 'Statutory Compliance (PF/ESI/PT)', description: null, category: 'payroll' },
      ],
      hr: [
        { code: 'recruitment', name: 'Recruitment / ATS', description: null, category: 'hr' },
        { code: 'performance', name: 'Performance Reviews', description: null, category: 'hr' },
        { code: 'goals', name: 'Goals & OKRs', description: null, category: 'hr' },
        { code: 'training', name: 'Training & LMS', description: null, category: 'hr' },
        { code: 'assets', name: 'Asset Management', description: null, category: 'hr' },
        { code: 'travel', name: 'Travel Management', description: null, category: 'hr' },
      ],
      ess: [
        { code: 'ess', name: 'Employee Self-Service (ESS)', description: null, category: 'ess' },
        { code: 'mobile_app', name: 'Mobile App Access', description: null, category: 'ess' },
      ],
      analytics: [
        { code: 'basic_reports', name: 'Basic Reports', description: null, category: 'analytics' },
        { code: 'advanced_analytics', name: 'Advanced Analytics', description: null, category: 'analytics' },
        { code: 'custom_reports', name: 'Custom Reports', description: null, category: 'analytics' },
        { code: 'audit_logs', name: 'Audit Logs', description: null, category: 'analytics' },
        { code: 'notifications', name: 'Notifications & Alerts', description: null, category: 'analytics' },
      ],
      security: [
        { code: 'sso', name: 'SSO (Microsoft/Google/SAML)', description: null, category: 'security' },
        { code: 'custom_branding', name: 'Custom Branding / White-label', description: null, category: 'security' },
        { code: 'multi_branch', name: 'Multi-Branch Support', description: null, category: 'security' },
      ],
      integrations: [
        { code: 'api_access', name: 'API Access', description: null, category: 'integrations' },
        { code: 'webhooks', name: 'Webhooks', description: null, category: 'integrations' },
        { code: 'integrations', name: 'Third-party Integrations', description: null, category: 'integrations' },
      ],
    },
    featureList: [
      'Employee Management', 'Departments & Branches', 'Custom Roles & Permissions', 'Approval Workflows',
      'Attendance Tracking', 'Shift Management', 'Roster / Scheduling', 'Overtime Tracking',
      'Geo Fencing', 'GPS Attendance', 'QR Attendance', 'Face Recognition', 'Biometric Integration',
      'Leave Management', 'Custom Leave Types', 'Leave Balance Tracking',
      'Payroll Processing', 'Payslips', 'Salary Structures', 'Tax Calculations',
      'Employee Loans', 'Expense Management', 'Reimbursements', 'Statutory Compliance',
      'Recruitment / ATS', 'Performance Reviews', 'Goals & OKRs', 'Training & LMS',
      'Asset Management', 'Travel Management',
      'Employee Self-Service', 'Mobile App Access',
      'Basic Reports', 'Advanced Analytics', 'Custom Reports', 'Audit Logs', 'Notifications',
      'SSO', 'Custom Branding / White-label', 'Multi-Branch Support',
      'API Access', 'Webhooks', 'Third-party Integrations',
      'Employee Onboarding', 'Document Management', 'Document Templates',
    ],
  },
  {
    id: 'enterprise-plan',
    name: 'Enterprise',
    slug: 'enterprise',
    description: 'Maximum power, flexibility, and control for large organizations with global operations.',
    minMonthlyFee: 999,
    pricePerEmployee: 0,
    includedEmployees: 1000,
    maxEmployees: 99999,
    maxStorageGB: 500,
    annualDiscountPercent: 20,
    currency: 'USD',
    sortOrder: 3,
    isActive: true,
    yearlyPrice: 9590,
    apiLimit: 100000,
    prioritySupport: '24/7',
    visibility: 'PUBLIC',
    features: {
      core: [
        { code: 'employee_management', name: 'Employee Management', description: null, category: 'core' },
        { code: 'department_branch', name: 'Departments & Branches', description: null, category: 'core' },
        { code: 'designations', name: 'Designations', description: null, category: 'core' },
        { code: 'roles_permissions', name: 'Custom Roles & Permissions', description: 'Define custom roles with granular permissions', category: 'core' },
        { code: 'approval_workflow', name: 'Approval Workflows', description: null, category: 'core' },
        { code: 'onboarding', name: 'Employee Onboarding', description: null, category: 'core' },
        { code: 'documents', name: 'Document Management', description: null, category: 'core' },
        { code: 'document_templates', name: 'Document Templates', description: null, category: 'core' },
      ],
      attendance: [
        { code: 'attendance', name: 'Attendance Tracking', description: null, category: 'attendance' },
        { code: 'shift_management', name: 'Shift Management', description: null, category: 'attendance' },
        { code: 'roster', name: 'Roster / Scheduling', description: null, category: 'attendance' },
        { code: 'overtime', name: 'Overtime Tracking', description: null, category: 'attendance' },
        { code: 'geo_fence', name: 'Geo Fencing', description: null, category: 'attendance' },
        { code: 'gps_attendance', name: 'GPS Attendance', description: null, category: 'attendance' },
        { code: 'qr_attendance', name: 'QR Attendance', description: null, category: 'attendance' },
        { code: 'face_recognition', name: 'Face Recognition', description: null, category: 'attendance' },
        { code: 'biometric', name: 'Biometric Integration', description: null, category: 'attendance' },
      ],
      leave: [
        { code: 'leave_management', name: 'Leave Management', description: null, category: 'leave' },
        { code: 'leave_types', name: 'Custom Leave Types', description: null, category: 'leave' },
        { code: 'leave_balance', name: 'Leave Balance Tracking', description: null, category: 'leave' },
      ],
      payroll: [
        { code: 'payroll', name: 'Payroll Processing', description: null, category: 'payroll' },
        { code: 'payslips', name: 'Payslips', description: null, category: 'payroll' },
        { code: 'salary_structures', name: 'Salary Structures', description: null, category: 'payroll' },
        { code: 'tax_calculations', name: 'Tax Calculations', description: null, category: 'payroll' },
        { code: 'loans', name: 'Employee Loans', description: null, category: 'payroll' },
        { code: 'expenses', name: 'Expense Management', description: null, category: 'payroll' },
        { code: 'reimbursements', name: 'Reimbursements', description: null, category: 'payroll' },
        { code: 'statutory_compliance', name: 'Statutory Compliance (PF/ESI/PT)', description: null, category: 'payroll' },
      ],
      hr: [
        { code: 'recruitment', name: 'Recruitment / ATS', description: null, category: 'hr' },
        { code: 'performance', name: 'Performance Reviews', description: null, category: 'hr' },
        { code: 'goals', name: 'Goals & OKRs', description: null, category: 'hr' },
        { code: 'training', name: 'Training & LMS', description: 'Learning management system with training programs', category: 'hr' },
        { code: 'assets', name: 'Asset Management', description: null, category: 'hr' },
        { code: 'travel', name: 'Travel Management', description: null, category: 'hr' },
      ],
      ess: [
        { code: 'ess', name: 'Employee Self-Service (ESS)', description: null, category: 'ess' },
        { code: 'mobile_app', name: 'Mobile App Access', description: null, category: 'ess' },
        { code: 'whatsapp', name: 'WhatsApp Integration', description: null, category: 'ess' },
      ],
      analytics: [
        { code: 'basic_reports', name: 'Basic Reports', description: null, category: 'analytics' },
        { code: 'advanced_analytics', name: 'Advanced Analytics', description: null, category: 'analytics' },
        { code: 'custom_reports', name: 'Custom Reports', description: null, category: 'analytics' },
        { code: 'audit_logs', name: 'Audit Logs', description: null, category: 'analytics' },
        { code: 'notifications', name: 'Notifications & Alerts', description: null, category: 'analytics' },
      ],
      security: [
        { code: 'sso', name: 'SSO (Microsoft/Google/SAML)', description: null, category: 'security' },
        { code: 'custom_branding', name: 'Custom Branding / White-label', description: null, category: 'security' },
        { code: 'multi_branch', name: 'Multi-Branch Support', description: null, category: 'security' },
        { code: 'multi_company', name: 'Multi-Company Support', description: null, category: 'security' },
        { code: 'multi_country', name: 'Multi-Country Support', description: null, category: 'security' },
      ],
      integrations: [
        { code: 'api_access', name: 'API Access', description: null, category: 'integrations' },
        { code: 'webhooks', name: 'Webhooks', description: null, category: 'integrations' },
        { code: 'integrations', name: 'Third-party Integrations', description: null, category: 'integrations' },
        { code: 'ai_assistant', name: 'AI Assistant', description: null, category: 'integrations' },
      ],
    },
    featureList: [
      'Employee Management', 'Departments & Branches', 'Custom Roles & Permissions', 'Approval Workflows',
      'Attendance Tracking', 'Shift Management', 'Roster / Scheduling', 'Overtime Tracking',
      'Geo Fencing', 'GPS Attendance', 'QR Attendance', 'Face Recognition', 'Biometric Integration',
      'Leave Management', 'Custom Leave Types', 'Leave Balance Tracking',
      'Payroll Processing', 'Payslips', 'Salary Structures', 'Tax Calculations',
      'Employee Loans', 'Expense Management', 'Reimbursements', 'Statutory Compliance',
      'Recruitment / ATS', 'Performance Reviews', 'Goals & OKRs', 'Training & LMS',
      'Asset Management', 'Travel Management',
      'Employee Self-Service', 'Mobile App Access', 'WhatsApp Integration',
      'Basic Reports', 'Advanced Analytics', 'Custom Reports', 'Audit Logs', 'Notifications',
      'SSO', 'Custom Branding / White-label', 'Multi-Branch Support',
      'Multi-Company Support', 'Multi-Country Support',
      'API Access', 'Webhooks', 'Third-party Integrations', 'AI Assistant',
      'Employee Onboarding', 'Document Management', 'Document Templates',
      '24/7 Priority Support',
    ],
  },
];

// ──────────────────────────────────────────────────────────────────
// Components
// ──────────────────────────────────────────────────────────────────

function AnimatedCounter({ end, suffix = '', duration = 2000 }: { end: number; suffix?: string; duration?: number }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const counted = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !counted.current) {
          counted.current = true;
          const startTime = Date.now();
          const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
            setCount(Math.floor(eased * end));
            if (progress < 1) requestAnimationFrame(animate);
          };
          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.3 }
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [end, duration]);

  return <span ref={ref}>{count}{suffix}</span>;
}

function FadeInSection({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { threshold: 0.1 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'} ${className}`}
    >
      {children}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Main Page
// ──────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const router = useRouter();
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Contact form state
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [contactSubmitted, setContactSubmitted] = useState(false);

  // Scroll listener for nav
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  // Fetch plans from API, fall back to static defaults
  const { data: plans, isLoading } = useQuery({
    queryKey: ['pricing-plans'],
    queryFn: async () => {
      try {
        return await unwrap<Plan[]>(api.get('/billing/plans'));
      } catch {
        // API unavailable — use static defaults
        return DEFAULT_PLANS;
      }
    },
    initialData: DEFAULT_PLANS,
    staleTime: 60 * 60 * 1000,
  });

  // If already authenticated, redirect
  useEffect(() => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('hrms_access_token') : null;
      if (token) {
        router.replace('/dashboard');
      }
    } catch { /* ignore */ }
  }, [router]);

  const popularPlan = plans.find(p => p.slug === 'growth');

  function getPlanPrice(plan: Plan): { amount: number; label: string; period: string } {
    if (plan.minMonthlyFee > 0) {
      const yearlyEquivalent = plan.yearlyPrice || (plan.minMonthlyFee * 12 * (1 - (plan.annualDiscountPercent || 0) / 100));
      const displayAmount = billingCycle === 'yearly' ? Math.round(yearlyEquivalent / 12) : plan.minMonthlyFee;
      return { amount: displayAmount, label: billingCycle === 'yearly' ? '/mo (billed annually)' : '/month', period: 'month' };
    }
    const monthly = plan.pricePerEmployee;
    if (billingCycle === 'yearly' && plan.annualDiscountPercent > 0) {
      const discounted = monthly * (1 - plan.annualDiscountPercent / 100);
      return { amount: Math.round(discounted), label: '/emp/mo (billed annually)', period: 'month' };
    }
    return { amount: monthly, label: '/employee/month', period: 'month' };
  }

  function getRegisterUrl(): string {
    return selectedPlanId ? `/register?plan=${selectedPlanId}` : '/register';
  }

  function handleContactSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Simulate submission
    setContactSubmitted(true);
    setTimeout(() => {
      setContactName('');
      setContactEmail('');
      setContactMessage('');
      setContactSubmitted(false);
    }, 5000);
  }

  // Collect all unique categories across plans for comparison
  const allCategories = [...new Set(
    plans.flatMap(p => Object.keys(p.features))
  )].sort((a, b) => {
    const order = ['core', 'attendance', 'leave', 'payroll', 'hr', 'ess', 'analytics', 'security', 'integrations'];
    return order.indexOf(a) - order.indexOf(b);
  });

  return (
    <div className="min-h-screen bg-white">
      {/* ── Navigation ─────────────────────────────────────────────── */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-white/90 backdrop-blur-xl shadow-sm border-b border-border/40'
            : 'bg-transparent'
        }`}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-accent-hover shadow-lg shadow-accent/20 group-hover:shadow-accent/30 transition-shadow">
              <span className="font-serif text-base font-bold text-white">H</span>
            </div>
            <div className="flex flex-col">
              <span className="font-serif text-lg font-semibold text-ink leading-tight">HRMS</span>
              <span className="text-[10px] font-medium text-ink-faint tracking-wider uppercase leading-tight">Enterprise Platform</span>
            </div>
          </Link>

          {/* Desktop nav links */}
          <div className="hidden lg:flex items-center gap-8">
            <Link href="#features" className="text-sm font-medium text-ink-soft hover:text-ink transition-colors">Features</Link>
            <Link href="#solutions" className="text-sm font-medium text-ink-soft hover:text-ink transition-colors">Solutions</Link>
            <Link href="#pricing" className="text-sm font-medium text-ink-soft hover:text-ink transition-colors">Pricing</Link>
            <Link href="#contact" className="text-sm font-medium text-ink-soft hover:text-ink transition-colors">Contact</Link>
          </div>

          {/* Desktop auth buttons */}
          <div className="hidden lg:flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm">Sign in</Button>
            </Link>
            <Link href={getRegisterUrl()}>
              <Button size="sm" className="shadow-sm shadow-accent/10">
                Get Started <ArrowRight size={14} className="ml-1" />
              </Button>
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            className="lg:hidden p-2 rounded-lg hover:bg-paper transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-border/40 bg-white px-4 py-4 space-y-3 animate-in slide-in-from-top-2">
            <Link href="#features" className="block text-sm font-medium text-ink-soft hover:text-ink py-2" onClick={() => setMobileMenuOpen(false)}>Features</Link>
            <Link href="#solutions" className="block text-sm font-medium text-ink-soft hover:text-ink py-2" onClick={() => setMobileMenuOpen(false)}>Solutions</Link>
            <Link href="#pricing" className="block text-sm font-medium text-ink-soft hover:text-ink py-2" onClick={() => setMobileMenuOpen(false)}>Pricing</Link>
            <Link href="#contact" className="block text-sm font-medium text-ink-soft hover:text-ink py-2" onClick={() => setMobileMenuOpen(false)}>Contact</Link>
            <div className="flex gap-2 pt-2 border-t border-border/40">
              <Link href="/login" className="flex-1"><Button variant="outline" className="w-full" size="sm">Sign in</Button></Link>
              <Link href={getRegisterUrl()} className="flex-1"><Button className="w-full" size="sm">Get Started</Button></Link>
            </div>
          </div>
        )}
      </nav>

      {/* ── Hero Section ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden min-h-screen flex items-center">
        {/* Premium animated background */}
        <div className="pointer-events-none absolute inset-0 -z-10">
          {/* Base gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-white via-paper/30 to-accent/5" />
          {/* Animated orbs */}
          <div className="absolute -top-40 -right-40 h-[500px] w-[500px] rounded-full bg-accent/[0.03] blur-3xl animate-pulse" style={{ animationDuration: '8s' }} />
          <div className="absolute -bottom-40 -left-40 h-[500px] w-[500px] rounded-full bg-accent/[0.02] blur-3xl animate-pulse" style={{ animationDuration: '10s', animationDelay: '2s' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full bg-accent/[0.015] blur-3xl" />
          {/* Grid pattern */}
          <div className="absolute inset-0 opacity-[0.02]" style={{
            backgroundImage: `linear-gradient(to right, #0B6E63 1px, transparent 1px), linear-gradient(to bottom, #0B6E63 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
          }} />

          {/* ── Floating decorative shapes ──────────────────────────── */}
          {/* Large teal ring — top right area */}
          <div
            className="hero-floating hidden lg:block"
            style={{
              top: '15%', right: '10%',
              width: '80px', height: '80px',
              border: '1.5px solid rgba(11,110,99,0.12)',
              borderRadius: '50%',
              animation: 'float-drift 12s ease-in-out infinite',
            }}
          />
          {/* Small teal dot — top left */}
          <div
            className="hero-floating"
            style={{
              top: '20%', left: '12%',
              width: '12px', height: '12px',
              background: 'rgba(11,110,99,0.08)',
              animation: 'float 6s ease-in-out infinite',
            }}
          />
          {/* Diamond shape — center right */}
          <div
            className="hero-floating hidden lg:block"
            style={{
              top: '50%', right: '18%',
              width: '20px', height: '20px',
              background: 'rgba(11,110,99,0.06)',
              transform: 'rotate(45deg)',
              borderRadius: '3px',
              animation: 'float 8s ease-in-out infinite 1s',
            }}
          />
          {/* Double ring — bottom left */}
          <div
            className="hero-floating hidden md:block"
            style={{
              bottom: '25%', left: '8%',
              width: '50px', height: '50px',
              border: '1px solid rgba(11,110,99,0.08)',
              borderRadius: '50%',
              animation: 'shimmer-ring 5s ease-in-out infinite',
            }}
          />
          {/* Small dot cluster — right side */}
          <div
            className="hero-floating"
            style={{
              top: '35%', right: '25%',
              width: '6px', height: '6px',
              background: 'rgba(11,110,99,0.1)',
              animation: 'glow-pulse 3s ease-in-out infinite 0.5s',
            }}
          />
          {/* Medium ring — bottom right */}
          <div
            className="hero-floating hidden lg:block"
            style={{
              bottom: '20%', right: '30%',
              width: '35px', height: '35px',
              border: '1.5px solid rgba(11,110,99,0.07)',
              borderRadius: '50%',
              animation: 'float-slow 10s ease-in-out infinite 2s',
            }}
          />
          {/* Diamond — left middle */}
          <div
            className="hero-floating hidden sm:block"
            style={{
              top: '40%', left: '5%',
              width: '14px', height: '14px',
              background: 'rgba(11,110,99,0.05)',
              transform: 'rotate(45deg)',
              borderRadius: '2px',
              animation: 'float 7s ease-in-out infinite 3s',
            }}
          />
          {/* Accent square — top center */}
          <div
            className="hero-floating hidden lg:block"
            style={{
              top: '10%', left: '45%',
              width: '10px', height: '10px',
              background: 'rgba(11,110,99,0.07)',
              borderRadius: '2px',
              animation: 'float 9s ease-in-out infinite 1.5s',
            }}
          />

          {/* ── Rising particles ────────────────────────────────────── */}
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div
              key={`p${i}`}
              className="hero-particle"
              style={{
                left: `${10 + i * 10}%`,
                bottom: '-5%',
                animation: `particle-rise ${8 + i * 2}s ease-in-out infinite`,
                animationDelay: `${i * 1.2}s`,
                '--drift': `${(i % 3 === 0 ? '' : '-')}${20 + i * 5}px`,
                width: `${2 + (i % 3)}px`,
                height: `${2 + (i % 3)}px`,
                background: `rgba(11, 110, 99, ${0.15 + i * 0.02})`,
              } as React.CSSProperties}
            />
          ))}
        </div>

        <div className="mx-auto max-w-6xl px-4 pt-32 pb-20 sm:px-6 lg:px-8 w-full">
          <div className="mx-auto max-w-4xl text-center">
            {/* Badge */}
            <div className="mx-auto mb-8 inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/5 px-4 py-1.5 shadow-sm animate-fade-in">
              <Sparkles size={14} className="text-accent" />
              <span className="text-xs font-medium text-accent">The complete HRMS platform for modern teams</span>
            </div>

            {/* Headline */}
            <h1 className="font-serif text-5xl font-bold tracking-tight text-ink sm:text-6xl lg:text-7xl leading-[1.1]">
              All-in-one HRMS for{' '}
              <span className="bg-gradient-to-r from-accent via-accent to-accent-hover bg-clip-text text-transparent">
                growing companies
              </span>
            </h1>

            {/* Subtitle */}
            <p className="mx-auto mt-6 max-w-2xl text-lg text-ink-soft leading-relaxed">
              From attendance to payroll, manage your entire workforce in one intelligent platform.
              Smart, secure, and built for teams of all sizes.
            </p>

            {/* CTA Buttons */}
            <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Link href={getRegisterUrl()}>
                <Button size="lg" className="min-w-[220px] shadow-xl shadow-accent/20 hover:shadow-2xl hover:shadow-accent/30 transition-all duration-300 text-base">
                  Start Free Trial <ArrowRight size={16} className="ml-2" />
                </Button>
              </Link>
              <Link href="#features">
                <Button variant="outline" size="lg" className="min-w-[220px] text-base">
                  <Play size={16} className="mr-2" /> See How It Works
                </Button>
              </Link>
            </div>

            {/* Trust markers */}
            <div className="mt-6 flex items-center justify-center gap-6 text-sm text-ink-faint">
              <span className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-accent" /> No credit card</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-accent" /> 14-day free trial</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-accent" /> Cancel anytime</span>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="mt-20 grid grid-cols-2 gap-6 md:grid-cols-4 border-t border-border/40 pt-12">
            {[
              { label: 'Active Users', end: 15000, suffix: '+' },
              { label: 'Companies Trust Us', end: 1200, suffix: '+' },
              { label: 'Countries Served', end: 45, suffix: '' },
              { label: 'Payroll Processed', end: 500, suffix: 'M+' },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="stat-value text-3xl md:text-4xl">
                  <AnimatedCounter end={stat.end} suffix={stat.suffix} />
                </div>
                <div className="stat-label mt-1">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Customer logos / social proof */}
          <div className="mt-16 text-center">
            <p className="text-xs font-medium uppercase tracking-widest text-ink-faint mb-6">Trusted by innovative companies worldwide</p>
            <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6 opacity-40 grayscale">
              {['TechFlow', 'ApexSoft', 'NexGen', 'CloudBase', 'Strata', 'Pioneer'].map((name) => (
                <div key={name} className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-md bg-ink/20" />
                  <span className="font-serif text-lg font-semibold text-ink">{name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-ink-faint animate-bounce">
          <span className="text-[10px] font-medium uppercase tracking-widest">Scroll</span>
          <ChevronDown size={16} />
        </div>
      </section>

      {/* ── How It Works Section ──────────────────────────────────────── */}
      <section id="solutions" className="relative px-4 py-24 sm:px-6 lg:px-8 bg-paper/50">
        <div className="mx-auto max-w-6xl">
          <FadeInSection>
            <div className="text-center mb-16">
              <div className="mx-auto mb-4 inline-flex items-center gap-1.5 rounded-full border border-accent/20 bg-accent/5 px-4 py-1">
                <Target size={12} className="text-accent" />
                <span className="text-xs font-medium text-accent">Simple Setup</span>
              </div>
              <h2 className="font-serif text-3xl font-semibold text-ink sm:text-4xl">Get started in three simple steps</h2>
              <p className="mt-3 text-ink-soft max-w-2xl mx-auto">
                From zero to fully operational in under an hour. No technical expertise required.
              </p>
            </div>
          </FadeInSection>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {HOW_IT_WORKS.map((item) => (
              <FadeInSection key={item.step}>
                <div className="group relative rounded-2xl border border-border/60 bg-white p-8 transition-all duration-300 hover:border-accent/20 hover:shadow-xl hover:shadow-accent/5">
                  {/* Step number */}
                  <div className="absolute -top-3 -right-3 flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent-hover text-xs font-bold text-white shadow-lg shadow-accent/20">
                    {item.step}
                  </div>
                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 group-hover:bg-accent/15 transition-colors">
                    <item.icon size={22} className="text-accent" />
                  </div>
                  <h3 className="font-serif text-xl font-semibold text-ink">{item.title}</h3>
                  <p className="mt-3 text-sm text-ink-soft leading-relaxed">{item.desc}</p>
                </div>
              </FadeInSection>
            ))}
          </div>
        </div>
      </section>

      {/* ── Highlights / Features Grid ───────────────────────────────── */}
      <section id="features" className="relative px-4 py-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <FadeInSection>
            <div className="text-center mb-16">
              <div className="mx-auto mb-4 inline-flex items-center gap-1.5 rounded-full border border-accent/20 bg-accent/5 px-4 py-1">
                <Layers size={12} className="text-accent" />
                <span className="text-xs font-medium text-accent">Powerful Features</span>
              </div>
              <h2 className="font-serif text-3xl font-semibold text-ink sm:text-4xl">Everything you need to run HR</h2>
              <p className="mt-3 text-ink-soft max-w-2xl mx-auto">
                A comprehensive suite of HR tools designed to streamline your workforce management.
              </p>
            </div>
          </FadeInSection>

          {/* Bento Grid */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES_BENTO.map((item) => (
              <FadeInSection key={item.title}>
                <div
                  className={`group rounded-2xl border p-6 transition-all duration-300 h-full ${
                    item.accent
                      ? 'bento-card-gradient text-white border-accent/20 lg:col-span-2'
                      : 'border-border/60 bg-white hover:border-accent/20 hover:shadow-lg hover:shadow-accent/5'
                  } ${item.wide ? 'lg:col-span-2' : ''}`}
                  style={item.wide && item.accent ? {} : undefined}
                >
                  <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl ${
                    item.accent ? 'bg-white/15' : 'bg-accent/10 group-hover:bg-accent/15'
                  } transition-colors`}>
                    <item.icon size={20} className={item.accent ? 'text-white' : 'text-accent'} />
                  </div>
                  <h3 className={`font-serif text-lg font-semibold ${item.accent ? 'text-white' : 'text-ink'}`}>
                    {item.title}
                  </h3>
                  <p className={`mt-2 text-sm leading-relaxed ${item.accent ? 'text-white/75' : 'text-ink-soft'}`}>
                    {item.desc}
                  </p>
                </div>
              </FadeInSection>
            ))}
          </div>
        </div>
      </section>

      {/* ── Core Capabilities Grid ───────────────────────────────────── */}
      <section className="relative px-4 py-24 sm:px-6 lg:px-8 bg-paper/50">
        <div className="mx-auto max-w-6xl">
          <FadeInSection>
            <div className="text-center mb-16">
              <h2 className="font-serif text-3xl font-semibold text-ink sm:text-4xl">Core capabilities</h2>
              <p className="mt-3 text-ink-soft max-w-2xl mx-auto">
                Six pillars of HR management, seamlessly integrated into one platform.
              </p>
            </div>
          </FadeInSection>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {HIGHLIGHTS.map((h) => (
              <FadeInSection key={h.label}>
                <div className="group rounded-2xl border border-border/60 bg-white p-6 transition-all duration-300 hover:border-accent/20 hover:shadow-lg hover:shadow-accent/5">
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-accent/10 group-hover:bg-accent/15 transition-colors">
                    <h.icon size={20} className="text-accent" />
                  </div>
                  <h3 className="font-serif text-lg font-semibold text-ink">{h.label}</h3>
                  <p className="mt-2 text-sm text-ink-soft leading-relaxed">{h.desc}</p>
                </div>
              </FadeInSection>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing Section ──────────────────────────────────────────── */}
      <section id="pricing" className="scroll-mt-20 relative px-4 py-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <FadeInSection>
            <div className="text-center mb-12">
              <div className="mx-auto mb-4 inline-flex items-center gap-1.5 rounded-full border border-accent/20 bg-accent/5 px-4 py-1">
                <CreditCard size={12} className="text-accent" />
                <span className="text-xs font-medium text-accent">Transparent Pricing</span>
              </div>
              <h2 className="font-serif text-3xl font-semibold text-ink sm:text-4xl">
                {billingCycle === 'yearly' ? 'Annual pricing' : 'Simple, transparent pricing'}
              </h2>
              <p className="mt-3 text-ink-soft max-w-2xl mx-auto">
                Choose the plan that fits your team. Upgrade, downgrade, or cancel anytime.
              </p>

              {/* Billing toggle */}
              <div className="mt-8 inline-flex items-center gap-2 rounded-2xl border border-border bg-white p-1.5 shadow-sm">
                <button
                  className={`rounded-xl px-6 py-2.5 text-sm font-medium transition-all ${
                    billingCycle === 'monthly'
                      ? 'bg-accent text-white shadow-md shadow-accent/20'
                      : 'text-ink-soft hover:text-ink'
                  }`}
                  onClick={() => setBillingCycle('monthly')}
                >
                  Monthly
                </button>
                <button
                  className={`rounded-xl px-6 py-2.5 text-sm font-medium transition-all ${
                    billingCycle === 'yearly'
                      ? 'bg-accent text-white shadow-md shadow-accent/20'
                      : 'text-ink-soft hover:text-ink'
                  }`}
                  onClick={() => setBillingCycle('yearly')}
                >
                  Yearly
                  <span className="ml-2 rounded-full bg-amber-soft px-2 py-0.5 text-[10px] font-semibold text-amber">
                    Save up to 20%
                  </span>
                </button>
              </div>
            </div>
          </FadeInSection>

          {/* Subtle loading indicator while API loads */}
          {isLoading && (
            <div className="flex items-center justify-center gap-2 mb-8">
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-gray-300 border-t-accent" />
              <span className="text-xs text-ink-faint">Loading latest plans...</span>
            </div>
          )}

              {/* Plan Cards */}
              <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
                {plans.map((plan) => {
                  const isPopular = plan.slug === 'growth';
                  const isSelected = selectedPlanId === plan.id;
                  const price = getPlanPrice(plan);
                  const planCategories = Object.keys(plan.features);
                  const totalFeatures = plan.featureList.length;
                  const supportLabel = plan.prioritySupport
                    ? plan.prioritySupport.charAt(0).toUpperCase() + plan.prioritySupport.slice(1)
                    : 'Email';

                  return (
                    <div
                      key={plan.id}
                      className={`group relative flex flex-col rounded-2xl border-2 transition-all duration-300 ${
                        isSelected
                          ? 'border-accent shadow-2xl shadow-accent/10 scale-[1.02]'
                          : isPopular
                          ? 'border-accent/40 shadow-xl shadow-accent/5 hover:shadow-2xl hover:shadow-accent/10'
                          : 'border-border/60 shadow-sm hover:shadow-lg hover:border-accent/20'
                      } ${isPopular ? 'bg-white' : 'bg-white/80'}`}
                      onClick={() => setSelectedPlanId(plan.id)}
                    >
                      {/* Popular badge */}
                      {isPopular && (
                        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-10">
                          <div className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-accent to-accent-hover px-5 py-1.5 text-xs font-semibold text-white shadow-lg shadow-accent/30">
                            <Star size={12} />
                            Most Popular
                          </div>
                        </div>
                      )}

                      {/* Plan header */}
                      <div className="p-7 pb-0">
                        <div className="flex items-center justify-between">
                          <h3 className="font-serif text-xl font-semibold text-ink">{plan.name}</h3>
                          {totalFeatures > 0 && (
                            <Badge tone="default" className="text-[10px] bg-paper text-ink-faint">
                              {totalFeatures} features
                            </Badge>
                          )}
                        </div>
                        <p className="mt-1.5 text-sm text-ink-faint leading-relaxed line-clamp-2">{plan.description}</p>

                        {/* Price */}
                        <div className="mt-6 flex items-baseline gap-1.5">
                          <span className="font-serif text-4xl font-bold text-ink">{fmt(price.amount)}</span>
                          <span className="text-xs text-ink-faint">{price.label}</span>
                        </div>

                        {/* Plan limits */}
                        <div className="mt-5 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-border/40 pt-5 text-sm text-ink-soft">
                          <span className="flex items-center gap-1.5">
                            <Users size={13} />
                            Up to {plan.maxEmployees.toLocaleString()} employees
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Cloud size={13} />
                            {plan.maxStorageGB}GB storage
                          </span>
                        </div>

                        {/* Support & API limits */}
                        <div className="mt-3 flex flex-wrap gap-3">
                          {plan.apiLimit > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-lg bg-paper px-2.5 py-1 text-[11px] font-medium text-ink-soft">
                              <Radio size={10} />
                              {plan.apiLimit.toLocaleString()} API calls/mo
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1 rounded-lg bg-paper px-2.5 py-1 text-[11px] font-medium text-ink-soft">
                            <HeadphonesIcon size={10} />
                            {supportLabel} support
                          </span>
                        </div>
                      </div>

                      {/* Categorized Features */}
                      <div className="flex-1 px-7 py-6">
                        <div className="space-y-5">
                          {planCategories.slice(0, 4).map((cat) => (
                            <div key={cat}>
                              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint mb-2.5">
                                {CATEGORY_LABELS[cat] || cat}
                              </h4>
                              <div className="space-y-2">
                                {plan.features[cat].slice(0, 4).map((feat) => (
                                  <div key={feat.code} className="flex items-start gap-2.5">
                                    <Check size={13} className="mt-0.5 flex-shrink-0 text-accent" />
                                    <span className="text-sm text-ink-soft">{feat.name}</span>
                                  </div>
                                ))}
                                {plan.features[cat].length > 4 && (
                                  <span className="text-xs text-ink-faint ml-6">
                                    +{plan.features[cat].length - 4} more
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                          {planCategories.length > 4 && (
                            <p className="text-xs text-accent font-medium pt-1">
                              +{planCategories.length - 4} more categories
                            </p>
                          )}
                        </div>
                      </div>

                      {/* CTA */}
                      <div className="p-7 pt-0 mt-auto">
                        <Link href={`/register?plan=${plan.id}`}>
                          <Button
                            className={`w-full transition-all ${
                              isPopular
                                ? 'shadow-lg shadow-accent/20 hover:shadow-xl hover:shadow-accent/30'
                                : ''
                            }`}
                            variant={isPopular ? 'default' : 'outline'}
                            size="lg"
                          >
                            {plan.minMonthlyFee === 0
                              ? `Start at ${fmt(plan.pricePerEmployee)}/emp`
                              : `Start Free Trial`}
                            <ArrowRight size={14} className="ml-2" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Feature Comparison Table */}
              {plans.length > 0 && (
                <FadeInSection>
                  <div className="mt-20">
                    <h3 className="font-serif text-2xl font-semibold text-ink text-center mb-2">Compare plans in detail</h3>
                    <p className="text-sm text-ink-soft text-center mb-10">See exactly what&apos;s included in each plan</p>

                    <div className="overflow-x-auto rounded-2xl border border-border/60 shadow-sm">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border/60 bg-paper/80">
                            <th className="text-left py-4 px-6 font-semibold text-ink">Features</th>
                            {plans.map((plan) => (
                              <th key={plan.id} className={`py-4 px-4 text-center font-semibold ${plan.slug === 'growth' ? 'text-accent' : 'text-ink'}`}>
                                {plan.name}
                                {plan.slug === 'growth' && <span className="block text-[10px] font-normal text-accent">Popular</span>}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {allCategories.map((cat) => (
                            <>
                              {/* Category header row */}
                              <tr key={cat} className="border-b border-border/30 bg-paper/40">
                                <td colSpan={plans.length + 1} className="py-3 px-6">
                                  <span className="text-xs font-bold uppercase tracking-wider text-ink-faint">
                                    {CATEGORY_LABELS[cat] || cat}
                                  </span>
                                </td>
                              </tr>
                              {/* Feature rows */}
                              {(() => {
                                // Collect all features in this category across all plans
                                const allFeatureCodes = [...new Set(
                                  plans.flatMap(p => (p.features[cat] || []).map(f => f.code))
                                )];
                                return allFeatureCodes.map((code) => {
                                  const featureName = plans
                                    .map(p => p.features[cat]?.find(f => f.code === code))
                                    .find(Boolean)?.name || code;
                                  return (
                                    <tr key={code} className="border-b border-border/20 hover:bg-paper/30 transition-colors">
                                      <td className="py-3 px-6 text-ink-soft">{featureName}</td>
                                      {plans.map((plan) => {
                                        const hasIt = plan.features[cat]?.some(f => f.code === code);
                                        return (
                                          <td key={plan.id} className="py-3 px-4 text-center">
                                            {hasIt ? (
                                              <Check size={16} className="mx-auto text-accent" />
                                            ) : (
                                              <Minus size={14} className="mx-auto text-ink-faint/30" />
                                            )}
                                          </td>
                                        );
                                      })}
                                    </tr>
                                  );
                                });
                              })()}
                            </>
                          ))}
                          {/* Limits row */}
                          <tr className="border-b border-border/20 bg-paper/30">
                            <td className="py-3 px-6 font-medium text-ink">Max Employees</td>
                            {plans.map(plan => (
                              <td key={plan.id} className="py-3 px-4 text-center text-sm text-ink-soft">
                                {plan.maxEmployees.toLocaleString()}
                              </td>
                            ))}
                          </tr>
                          <tr className="border-b border-border/20 bg-paper/30">
                            <td className="py-3 px-6 font-medium text-ink">Storage</td>
                            {plans.map(plan => (
                              <td key={plan.id} className="py-3 px-4 text-center text-sm text-ink-soft">
                                {plan.maxStorageGB}GB
                              </td>
                            ))}
                          </tr>
                          <tr className="bg-paper/30">
                            <td className="py-3 px-6 font-medium text-ink">Support</td>
                            {plans.map(plan => (
                              <td key={plan.id} className="py-3 px-4 text-center text-sm text-ink-soft">
                                {plan.prioritySupport
                                  ? plan.prioritySupport.charAt(0).toUpperCase() + plan.prioritySupport.slice(1)
                                  : 'Email'}
                              </td>
                            ))}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </FadeInSection>
              )}

              {/* Bottom CTA */}
              <FadeInSection>
                <div className="mt-16 text-center">
                  <p className="text-sm text-ink-soft">
                    All plans include a 14-day free trial. No credit card required.
                  </p>
                  <Link href={getRegisterUrl()}>
                    <Button size="lg" className="mt-5 min-w-[280px] shadow-xl shadow-accent/20 hover:shadow-2xl hover:shadow-accent/30 transition-all text-base">
                      Start Your Free Trial <Sparkles size={16} className="ml-2" />
                    </Button>
                  </Link>
                </div>
              </FadeInSection>
          </div>
        </section>

      {/* ── FAQ Section ────────────────────────────────────────────────── */}
      <section className="relative px-4 py-24 sm:px-6 lg:px-8 bg-paper/50">
        <div className="mx-auto max-w-3xl">
          <FadeInSection>
            <div className="text-center mb-12">
              <div className="mx-auto mb-4 inline-flex items-center gap-1.5 rounded-full border border-accent/20 bg-accent/5 px-4 py-1">
                <HelpCircle size={12} className="text-accent" />
                <span className="text-xs font-medium text-accent">FAQ</span>
              </div>
              <h2 className="font-serif text-3xl font-semibold text-ink sm:text-4xl">Frequently asked questions</h2>
              <p className="mt-3 text-ink-soft">Everything you need to know about our platform and pricing.</p>
            </div>
          </FadeInSection>

          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <FadeInSection key={i}>
                <details className="group rounded-2xl border border-border/60 bg-white transition-all duration-200 hover:border-accent/20 hover:shadow-sm [&[open]]:border-accent/20 [&[open]]:shadow-md">
                  <summary className="flex cursor-pointer items-center justify-between px-6 py-4 select-none">
                    <span className="font-medium text-ink text-sm pr-4">{faq.q}</span>
                    <ChevronDown size={16} className="flex-shrink-0 text-ink-faint transition-transform duration-200 group-open:rotate-180" />
                  </summary>
                  <div className="px-6 pb-5">
                    <p className="text-sm text-ink-soft leading-relaxed">{faq.a}</p>
                  </div>
                </details>
              </FadeInSection>
            ))}
          </div>
        </div>
      </section>

      {/* ── Enterprise CTA ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-accent via-accent to-accent-hover px-4 py-20 sm:px-6 lg:px-8">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-white/[0.06] blur-3xl" />
          <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-white/[0.04] blur-3xl" />
        </div>
        <div className="mx-auto max-w-3xl text-center">
          <FadeInSection>
            <h2 className="font-serif text-3xl font-semibold text-white sm:text-4xl">Need a custom enterprise plan?</h2>
            <p className="mt-4 text-lg text-white/80 max-w-2xl mx-auto leading-relaxed">
              Enterprise-grade features, dedicated infrastructure, personalized onboarding, 
              and custom pricing for organizations with complex requirements.
            </p>
            <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Link href="/register">
                <Button size="lg" variant="secondary" className="bg-white text-accent hover:bg-white/90 min-w-[200px] shadow-xl text-base">
                  Get Started <ArrowRight size={16} className="ml-2" />
                </Button>
              </Link>
              <a
                href="mailto:sales@hrms.io"
                className="inline-flex items-center gap-2 rounded-xl border border-white/25 px-7 py-3 text-sm font-medium text-white transition-all hover:bg-white/10 hover:border-white/40"
              >
                <Mail size={16} />
                Contact Sales
              </a>
            </div>
          </FadeInSection>
        </div>
      </section>

      {/* ── Contact Section ────────────────────────────────────────────── */}
      <section id="contact" className="scroll-mt-20 relative px-4 py-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <FadeInSection>
            <div className="text-center mb-16">
              <div className="mx-auto mb-4 inline-flex items-center gap-1.5 rounded-full border border-accent/20 bg-accent/5 px-4 py-1">
                <MessageSquare size={12} className="text-accent" />
                <span className="text-xs font-medium text-accent">Get in Touch</span>
              </div>
              <h2 className="font-serif text-3xl font-semibold text-ink sm:text-4xl">We&apos;d love to hear from you</h2>
              <p className="mt-3 text-ink-soft max-w-2xl mx-auto">
                Have a question, need a demo, or want to discuss enterprise pricing? Reach out to our team.
              </p>
            </div>
          </FadeInSection>

          <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
            {/* Contact Form */}
            <FadeInSection>
              <div className="rounded-2xl border border-border/60 bg-white p-8 shadow-sm">
                {contactSubmitted ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent/10">
                      <CheckCircle2 size={28} className="text-accent" />
                    </div>
                    <h3 className="font-serif text-xl font-semibold text-ink">Message sent!</h3>
                    <p className="mt-2 text-sm text-ink-soft">Our team will get back to you within 24 hours.</p>
                  </div>
                ) : (
                  <form onSubmit={handleContactSubmit} className="space-y-5">
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                      <div>
                        <label htmlFor="contact-name" className="block text-sm font-medium text-ink mb-1.5">Full name</label>
                        <input
                          id="contact-name"
                          type="text"
                          required
                          value={contactName}
                          onChange={(e) => setContactName(e.target.value)}
                          placeholder="Jane Smith"
                          className="w-full rounded-xl border border-border bg-white px-4 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all"
                        />
                      </div>
                      <div>
                        <label htmlFor="contact-email" className="block text-sm font-medium text-ink mb-1.5">Email address</label>
                        <input
                          id="contact-email"
                          type="email"
                          required
                          value={contactEmail}
                          onChange={(e) => setContactEmail(e.target.value)}
                          placeholder="jane@company.com"
                          className="w-full rounded-xl border border-border bg-white px-4 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all"
                        />
                      </div>
                    </div>
                    <div>
                      <label htmlFor="contact-message" className="block text-sm font-medium text-ink mb-1.5">Message</label>
                      <textarea
                        id="contact-message"
                        required
                        rows={5}
                        value={contactMessage}
                        onChange={(e) => setContactMessage(e.target.value)}
                        placeholder="Tell us about your requirements, team size, or any questions you have..."
                        className="w-full rounded-xl border border-border bg-white px-4 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all resize-none"
                      />
                    </div>
                    <Button type="submit" size="lg" className="w-full shadow-lg shadow-accent/10">
                      <Mail size={16} className="mr-2" />
                      Send Message
                    </Button>
                  </form>
                )}
              </div>
            </FadeInSection>

            {/* Contact Info Cards */}
            <FadeInSection>
              <div className="space-y-5">
                <div className="rounded-2xl border border-border/60 bg-white p-6 shadow-sm transition-all duration-200 hover:border-accent/20 hover:shadow-md">
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 flex-shrink-0">
                      <Mail size={18} className="text-accent" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-ink">Email us</h3>
                      <p className="mt-1 text-sm text-ink-soft">Our support team typically responds within 2 hours.</p>
                      <div className="mt-2 space-y-1">
                        <a href="mailto:support@hrms.io" className="block text-sm text-accent hover:text-accent-hover transition-colors">support@hrms.io</a>
                        <a href="mailto:sales@hrms.io" className="block text-sm text-accent hover:text-accent-hover transition-colors">sales@hrms.io</a>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-border/60 bg-white p-6 shadow-sm transition-all duration-200 hover:border-accent/20 hover:shadow-md">
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 flex-shrink-0">
                      <Phone size={18} className="text-accent" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-ink">Call us</h3>
                      <p className="mt-1 text-sm text-ink-soft">Available Monday to Friday, 9 AM — 6 PM EST.</p>
                      <div className="mt-2 space-y-1">
                        <a href="tel:+1-555-0123" className="block text-sm text-accent hover:text-accent-hover transition-colors">+1 (555) 0123</a>
                        <a href="tel:+1-555-4567" className="block text-sm text-accent hover:text-accent-hover transition-colors">+1 (555) 4567</a>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-border/60 bg-white p-6 shadow-sm transition-all duration-200 hover:border-accent/20 hover:shadow-md">
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 flex-shrink-0">
                      <MapPin size={18} className="text-accent" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-ink">Visit us</h3>
                      <p className="mt-1 text-sm text-ink-soft">Our global headquarters.</p>
                      <p className="mt-2 text-sm text-ink-soft">
                        100 Innovation Drive, Suite 400<br />
                        San Francisco, CA 94105<br />
                        United States
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-border/60 bg-white p-6 shadow-sm transition-all duration-200 hover:border-accent/20 hover:shadow-md">
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 flex-shrink-0">
                      <Clock size={18} className="text-accent" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-ink">Office hours</h3>
                      <p className="mt-1 text-sm text-ink-soft">We operate across time zones to serve you better.</p>
                      <p className="mt-2 text-sm text-ink-soft">
                        Monday — Friday: 9:00 AM — 6:00 PM EST<br />
                        Saturday: 10:00 AM — 2:00 PM EST<br />
                        Sunday: Closed
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </FadeInSection>
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <footer className="border-t border-border/40 bg-ink">
        {/* Main footer */}
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-3 lg:grid-cols-6">
            {/* Brand column */}
            <div className="col-span-2 lg:col-span-2">
              <Link href="/" className="inline-flex items-center gap-2.5 group mb-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-white/20 to-white/10 shadow-lg">
                  <span className="font-serif text-base font-bold text-white">H</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-serif text-lg font-semibold text-white leading-tight">HRMS</span>
                  <span className="text-[10px] font-medium text-white/40 tracking-wider uppercase leading-tight">Enterprise Platform</span>
                </div>
              </Link>
              <p className="mt-4 text-sm text-white/60 leading-relaxed max-w-sm">
                The all-in-one HRMS platform designed for modern, growing companies. 
                Streamline your HR operations from recruitment to retirement.
              </p>
              {/* Social links */}
              <div className="mt-6 flex gap-3">
                {SOCIAL_LINKS.slice(0, 5).map((social) => (
                  <a
                    key={social.label}
                    href={social.href}
                    className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white/50 hover:bg-white/20 hover:text-white transition-all duration-200"
                    aria-label={social.label}
                  >
                    <social.icon size={16} />
                  </a>
                ))}
              </div>
            </div>

            {/* Product */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-white/50 mb-4">Product</h4>
              <ul className="space-y-2.5">
                {FOOTER_LINKS.product.map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className="text-sm text-white/70 hover:text-white transition-colors">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Solutions */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-white/50 mb-4">Solutions</h4>
              <ul className="space-y-2.5">
                {FOOTER_LINKS.solutions.map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className="text-sm text-white/70 hover:text-white transition-colors">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Resources */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-white/50 mb-4">Resources</h4>
              <ul className="space-y-2.5">
                {FOOTER_LINKS.resources.map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className="text-sm text-white/70 hover:text-white transition-colors">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Company */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-white/50 mb-4">Company</h4>
              <ul className="space-y-2.5">
                {FOOTER_LINKS.company.map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className="text-sm text-white/70 hover:text-white transition-colors">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Newsletter / CTA */}
          <div className="mt-12 border-t border-white/10 pt-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h4 className="text-sm font-semibold text-white">Stay up to date</h4>
              <p className="text-xs text-white/50 mt-1">Get product updates, tips, and industry news delivered to your inbox.</p>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <input
                type="email"
                placeholder="Enter your email"
                className="flex-1 sm:w-60 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-accent/50"
              />
              <Button size="sm" className="bg-white text-ink hover:bg-white/90 flex-shrink-0">
                Subscribe
              </Button>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/10">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-white/40">
              &copy; {new Date().getFullYear()} HRMS Platform, Inc. All rights reserved.
            </p>
            <div className="flex gap-6 text-xs text-white/40">
              <Link href="#" className="hover:text-white/70 transition-colors">Privacy Policy</Link>
              <Link href="#" className="hover:text-white/70 transition-colors">Terms of Service</Link>
              <Link href="#" className="hover:text-white/70 transition-colors">Cookie Policy</Link>
              <Link href="#" className="hover:text-white/70 transition-colors">GDPR</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
