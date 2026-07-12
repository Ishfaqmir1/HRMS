'use client';

import { useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api-client';
import { DocumentTemplate, DOCUMENT_CATEGORY_LABELS } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Label, FieldError } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Eye, Code, Type, Save, ArrowLeft, AlertTriangle,
  FileText, Download, Printer,
} from 'lucide-react';
import Link from 'next/link';

const CATEGORIES = [
  { value: 'OFFER_LETTER', label: 'Offer Letter' },
  { value: 'APPOINTMENT_LETTER', label: 'Appointment Letter' },
  { value: 'EXPERIENCE_LETTER', label: 'Experience Letter' },
  { value: 'RELIEVING_LETTER', label: 'Relieving Letter' },
  { value: 'SALARY_CERTIFICATE', label: 'Salary Certificate' },
  { value: 'CONFIRMATION_LETTER', label: 'Confirmation Letter' },
  { value: 'PROMOTION_LETTER', label: 'Promotion Letter' },
  { value: 'TRANSFER_LETTER', label: 'Transfer Letter' },
  { value: 'OTHER', label: 'Other' },
];

const VARIABLE_HELP = [
  { var: '{{employeeName}}', desc: 'Full name' },
  { var: '{{firstName}}', desc: 'First name' },
  { var: '{{lastName}}', desc: 'Last name' },
  { var: '{{position}}', desc: 'Job title' },
  { var: '{{department}}', desc: 'Department' },
  { var: '{{joiningDate}}', desc: 'Date of joining' },
  { var: '{{salary}}', desc: 'Salary' },
  { var: '{{totalCTC}}', desc: 'Total CTC' },
  { var: '{{companyName}}', desc: 'Company name' },
  { var: '{{reportingManager}}', desc: 'Manager name' },
  { var: '{{hrName}}', desc: 'HR name' },
  { var: '{{formatDate}}', desc: 'Date formatting' },
  { var: '{{currency}}', desc: 'Currency formatting' },
];

function SampleHtmlPreview({ html }: { html: string }) {
  return (
    <div className="rounded-lg border border-border bg-white p-6 shadow-sm">
      <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

export default function EditTemplatePage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<'editor' | 'preview'>('editor');
  const [view, setView] = useState<'rich' | 'code'>('code');
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: template, isLoading } = useQuery({
    queryKey: ['document-templates', id],
    queryFn: () => unwrap<DocumentTemplate>(api.get(`/document-templates/${id}`)),
  });

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<{
    name: string;
    category: string;
    description: string;
    content: string;
  }>({
    resolver: zodResolver(z.object({
      name: z.string().min(1, 'Required'),
      category: z.string().min(1, 'Required'),
      description: z.string().optional(),
      content: z.string().min(1, 'Required'),
    })),
    values: template ? {
      name: template.name,
      category: template.category,
      description: template.description || '',
      content: template.content ?? '',
    } : undefined,
  });

  const content = watch('content');

  const updateMut = useMutation({
    mutationFn: (data: any) => api.patch(`/document-templates/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-templates'] });
      queryClient.invalidateQueries({ queryKey: ['document-templates', id] });
    },
  });

  const handlePreview = () => {
    setPreviewLoading(true);
    try {
      const sampleHtml = content
        .replace(/\{\{employeeName\}\}/g, 'John Doe')
        .replace(/\{\{firstName\}\}/g, 'John')
        .replace(/\{\{lastName\}\}/g, 'Doe')
        .replace(/\{\{position\}\}/g, 'Software Engineer')
        .replace(/\{\{department\}\}/g, 'Engineering')
        .replace(/\{\{companyName\}\}/g, 'Acme Corp')
        .replace(/\{\{hrName\}\}/g, 'HR Department')
        .replace(/\{\{formatDate [^}]+\}\}/g, new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }))
        .replace(/\{\{currency [^}]+\}\}/g, '$75,000')
        .replace(/\{\{joiningDate\}\}/g, new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }))
        .replace(/\{\{now\}\}/g, new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }))
        .replace(/\{\{[^}]+\}\}/g, '[Variable]');
      setPreviewHtml(sampleHtml);
      setMode('preview');
    } finally {
      setPreviewLoading(false);
    }
  };

  const insertVariable = (variable: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newContent = content.substring(0, start) + variable + content.substring(end);
    setValue('content', newContent);
    setTimeout(() => {
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = start + variable.length;
    }, 0);
  };

  if (isLoading) {
    return <p className="text-sm text-ink-faint">Loading template…</p>;
  }

  if (!template) {
    return (
      <div className="flex flex-col items-center gap-3 py-12">
        <p className="text-ink-faint">Template not found.</p>
        <Link href="/documents/templates"><Button variant="outline">Back to Templates</Button></Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/documents/templates">
            <Button variant="ghost" size="sm"><ArrowLeft size={14} /></Button>
          </Link>
          <div>
            <h1 className="font-serif text-xl font-semibold text-ink">{template.name}</h1>
            <p className="text-xs text-ink-faint">
              {DOCUMENT_CATEGORY_LABELS[template.category as keyof typeof DOCUMENT_CATEGORY_LABELS] || template.category}
              {template.isDefault && <Badge variant="default" className="ml-2">Default</Badge>}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/documents/generate?templateId=${template.id}`}>
            <Button variant="outline" size="sm"><Printer size={14} /> Generate</Button>
          </Link>
          <Button variant="outline" size="sm" onClick={handlePreview} isLoading={previewLoading}>
            <Eye size={14} /> Preview
          </Button>
          <Button size="sm" onClick={handleSubmit((data) => updateMut.mutate(data))} isLoading={updateMut.isPending}>
            <Save size={14} /> Save Changes
          </Button>
        </div>
      </div>

      {updateMut.isError && (
        <div className="flex items-center gap-2 rounded-lg bg-danger-soft/50 border border-danger/20 px-4 py-3 text-sm text-danger">
          <AlertTriangle size={14} />
          {(updateMut.error as any)?.response?.data?.message || 'Failed to save.'}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        {/* Left sidebar */}
        <div className="space-y-4 lg:col-span-1">
          <Card>
            <CardHeader><CardTitle>Template Info</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Name</Label>
                <Input {...register('name')} />
                <FieldError message={errors.name?.message} />
              </div>
              <div>
                <Label>Category</Label>
                <select {...register('category')} className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm">
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Description</Label>
                <Input {...register('description')} />
              </div>
              <div className="rounded-lg bg-paper p-3">
                <p className="text-xs text-ink-faint">Slug</p>
                <p className="text-sm font-mono text-ink">{template.slug}</p>
              </div>
              <div className="rounded-lg bg-paper p-3">
                <p className="text-xs text-ink-faint">Last updated</p>
                <p className="text-sm text-ink">{new Date(template.updatedAt).toLocaleDateString()}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Variables</CardTitle></CardHeader>
            <CardContent>
              <p className="mb-3 text-xs text-ink-faint">Click to insert at cursor:</p>
              <div className="flex flex-wrap gap-1.5">
                {VARIABLE_HELP.map((v) => (
                  <button
                    key={v.var}
                    onClick={() => insertVariable(v.var)}
                    className="rounded-md border border-border bg-paper px-2 py-1 text-xs font-mono text-accent hover:bg-accent/10 transition-colors"
                    title={v.desc}
                  >
                    {v.var}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Editor area */}
        <div className="lg:col-span-3">
          {mode === 'editor' ? (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle>Content</CardTitle>
                <div className="flex gap-1 rounded-lg border border-border p-0.5">
                  <button
                    onClick={() => setView('code')}
                    className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                      view === 'code' ? 'bg-accent text-white shadow-sm' : 'text-ink-faint hover:text-ink'
                    }`}
                  >
                    <Code size={12} /> HTML
                  </button>
                  <button
                    onClick={() => setView('rich')}
                    className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                      view === 'rich' ? 'bg-accent text-white shadow-sm' : 'text-ink-faint hover:text-ink'
                    }`}
                  >
                    <Type size={12} /> Rich
                  </button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border border-border">
                  <textarea
                    {...register('content')}
                    ref={(el) => { textareaRef.current = el; }}
                    className="w-full min-h-[500px] resize-y border-0 bg-paper p-4 font-mono text-sm leading-relaxed text-ink outline-none focus:ring-0"
                    spellCheck={false}
                  />
                </div>
                <FieldError message={errors.content?.message} />
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle>Preview</CardTitle>
                <Button variant="outline" size="sm" onClick={() => setMode('editor')}>
                  <Code size={14} /> Back to Editor
                </Button>
              </CardHeader>
              <CardContent>
                {previewHtml && <SampleHtmlPreview html={previewHtml} />}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
