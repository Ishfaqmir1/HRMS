'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api-client';
import { PaginatedResult, DocumentTemplate, GeneratedDocument, DOCUMENT_CATEGORY_LABELS, DOCUMENT_CATEGORY_COLORS } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  FileSpreadsheet, ScrollText, Printer, FileText, Plus, Settings,
  ChevronRight, ArrowRight, Download, Eye, Loader2,
} from 'lucide-react';
import Link from 'next/link';



function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

export default function DocumentsHubPage() {
  const [seedDialog, setSeedDialog] = useState(false);
  const queryClient = useQueryClient();

  const { data: templatesData } = useQuery({
    queryKey: ['document-templates', 1],
    queryFn: () => unwrap<PaginatedResult<DocumentTemplate>>(
      api.get('/document-templates', { params: { page: 1, limit: 100 } }),
    ),
  });

  const { data: generatedData } = useQuery({
    queryKey: ['document-templates', 'generated', 1],
    queryFn: () => unwrap<PaginatedResult<GeneratedDocument>>(
      api.get('/document-templates/generated', { params: { page: 1, limit: 10 } }),
    ),
  });

  const seedMut = useMutation({
    mutationFn: () => api.post('/document-templates/seed'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-templates'] });
      setSeedDialog(false);
    },
  });

  const templates = templatesData?.items || [];
  const generated = generatedData?.items || [];

  const stats = [
    { label: 'Templates', value: templates.length, icon: ScrollText, color: 'text-accent', bg: 'bg-accent/10' },
    { label: 'Generated', value: generatedData?.meta?.total || 0, icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50' },
    {
      label: 'Categories',
      value: [...new Set(templates.map((t) => t.category))].length,
      icon: Settings,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
    },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-ink">Document Builder</h1>
          <p className="mt-1 text-sm text-ink-faint">
            Generate offer letters, appointment letters, experience certificates, and more
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setSeedDialog(true)}>
            <Settings size={14} /> Load Defaults
          </Button>
          <Link href="/documents/templates/new">
            <Button size="sm"><Plus size={14} /> New Template</Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center gap-4 py-4">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${stat.bg}`}>
                <stat.icon size={20} className={stat.color} />
              </div>
              <div>
                <p className="text-2xl font-semibold text-ink">{stat.value}</p>
                <p className="text-xs text-ink-faint">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/documents/templates">
          <Card className="cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5">
            <CardContent className="flex items-center gap-3 py-4">
              <ScrollText size={20} className="text-accent" />
              <div className="flex-1">
                <p className="font-medium text-ink">Manage Templates</p>
                <p className="text-xs text-ink-faint">Edit document templates</p>
              </div>
              <ChevronRight size={16} className="text-ink-faint" />
            </CardContent>
          </Card>
        </Link>
        <Link href="/documents/generate">
          <Card className="cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5">
            <CardContent className="flex items-center gap-3 py-4">
              <Printer size={20} className="text-accent" />
              <div className="flex-1">
                <p className="font-medium text-ink">Generate Documents</p>
                <p className="text-xs text-ink-faint">Create for employees</p>
              </div>
              <ChevronRight size={16} className="text-ink-faint" />
            </CardContent>
          </Card>
        </Link>
        <Link href="/documents/generated">
          <Card className="cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5">
            <CardContent className="flex items-center gap-3 py-4">
              <FileText size={20} className="text-accent" />
              <div className="flex-1">
                <p className="font-medium text-ink">View Generated</p>
                <p className="text-xs text-ink-faint">Download &amp; review</p>
              </div>
              <ChevronRight size={16} className="text-ink-faint" />
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Templates Overview */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Document Templates</CardTitle>
          <Link href="/documents/templates">
            <Button variant="ghost" size="sm">View All <ArrowRight size={14} className="ml-1" /></Button>
          </Link>
        </CardHeader>
        <CardContent>
          {templates.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <FileSpreadsheet size={32} className="text-ink-faint" />
              <p className="text-sm text-ink-faint">No templates yet. Load default templates or create your own.</p>
              <Button variant="outline" size="sm" onClick={() => setSeedDialog(true)}>
                Load Default Templates
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {templates.slice(0, 6).map((t) => (
                <Link key={t.id} href={`/documents/templates/${t.id}`}>
                  <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3 transition-all hover:bg-paper hover:shadow-sm">
                    <div className="flex items-center gap-3">
                      <span className={`rounded-md border px-2.5 py-0.5 text-xs font-medium ${DOCUMENT_CATEGORY_COLORS[t.category as keyof typeof DOCUMENT_CATEGORY_COLORS] || DOCUMENT_CATEGORY_COLORS.OTHER}`}>
                        {DOCUMENT_CATEGORY_LABELS[t.category as keyof typeof DOCUMENT_CATEGORY_LABELS] || t.category}
                      </span>
                      <span className="text-sm font-medium text-ink">{t.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {t.isDefault && <Badge variant="default" className="text-[10px]">Default</Badge>}
                      <ChevronRight size={14} className="text-ink-faint" />
                    </div>
                  </div>
                </Link>
              ))}
              {templates.length > 6 && (
                <p className="text-center text-xs text-ink-faint">
                  +{templates.length - 6} more templates
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Generated Documents */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recently Generated</CardTitle>
          <Link href="/documents/generated">
            <Button variant="ghost" size="sm">View All <ArrowRight size={14} className="ml-1" /></Button>
          </Link>
        </CardHeader>
        <CardContent>
          {generated.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-faint">No documents generated yet.</p>
          ) : (
            <div className="space-y-2">
              {generated.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
                  <div className="flex items-center gap-3">
                    <FileText size={16} className="text-ink-faint" />
                    <div>
                      <p className="text-sm font-medium text-ink">{doc.title}</p>
                      <p className="text-xs text-ink-faint">
                        {doc.employee?.firstName} {doc.employee?.lastName} &middot; {formatDate(doc.generatedAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="sm"><Download size={14} /></Button>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Seed Dialog */}
      <Dialog open={seedDialog} onOpenChange={(o) => !o && setSeedDialog(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Load Default Templates</DialogTitle>
            <DialogDescription>
              This will create default templates for all document types (Offer Letter, Appointment Letter,
              Experience Letter, Relieving Letter, Salary Certificate) if they don&apos;t already exist.
            </DialogDescription>
          </DialogHeader>
          {seedMut.isError && (
            <p className="text-sm text-danger">
              {(seedMut.error as any)?.response?.data?.message || 'Failed to load defaults.'}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSeedDialog(false)}>Cancel</Button>
            <Button onClick={() => seedMut.mutate()} isLoading={seedMut.isPending}>Load Templates</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
