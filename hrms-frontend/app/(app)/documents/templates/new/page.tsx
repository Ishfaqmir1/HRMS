'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api-client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Label, FieldError } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Eye, Code, Type, Save, ArrowLeft, Loader2, AlertTriangle,
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
  { var: '{{firstName}}', desc: 'First name only' },
  { var: '{{lastName}}', desc: 'Last name only' },
  { var: '{{position}}', desc: 'Job title' },
  { var: '{{department}}', desc: 'Department name' },
  { var: '{{joiningDate}}', desc: 'Date of joining' },
  { var: '{{salary}}', desc: 'Salary amount' },
  { var: '{{totalCTC}}', desc: 'Total CTC' },
  { var: '{{companyName}}', desc: 'Company name' },
  { var: '{{reportingManager}}', desc: 'Manager name' },
  { var: '{{hrName}}', desc: 'HR contact name' },
  { var: '{{formatDate variable}}', desc: 'Format date helper' },
  { var: '{{currency number}}', desc: 'Format currency helper' },
  { var: '{{uppercase text}}', desc: 'Uppercase helper' },
  { var: '{{now}}', desc: 'Current date' },
];

const formSchema = z.object({
  name: z.string().min(1, 'Required'),
  category: z.string().min(1, 'Required'),
  description: z.string().optional(),
  content: z.string().min(1, 'Template content is required'),
});

type FormData = z.infer<typeof formSchema>;

function SampleHtmlPreview({ html }: { html: string }) {
  return (
    <div className="rounded-lg border border-border bg-white p-6 shadow-sm">
      <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

export default function NewTemplatePage() {
  const router = useRouter();
  const [mode, setMode] = useState<'editor' | 'preview'>('editor');
  const [view, setView] = useState<'rich' | 'code'>('code');
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      category: 'OFFER_LETTER',
      description: '',
      content: `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12pt; line-height: 1.6; color: #222; max-width: 700px; margin: 0 auto; padding: 20px; }
  .header { text-align: center; border-bottom: 2px solid #0B6E63; padding-bottom: 15px; margin-bottom: 25px; }
  .header h1 { color: #0B6E63; font-size: 22pt; margin: 0; }
  .content p { margin: 8px 0; }
  .signature { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; }
</style>
</head>
<body>
<div class="header">
  <h1>{{companyName}}</h1>
</div>

<p>Date: {{formatDate currentDate}}</p>

<p>Dear <strong>{{employeeName}}</strong>,</p>

<div class="content">
<p>This is to confirm your appointment with {{companyName}} as <strong>{{position}}</strong> in the <strong>{{department}}</strong> department.</p>

<p>Your date of joining is <strong>{{formatDate joiningDate}}</strong>.</p>
</div>

<div class="signature">
  <p>Sincerely,</p>
  <p><strong>{{hrName}}</strong></p>
</div>
</body>
</html>`,
    },
  });

  const content = watch('content');

  const createMut = useMutation({
    mutationFn: (data: FormData) => api.post('/document-templates', data),
    onSuccess: (res: any) => {
      const id = res.data?.id || res.id;
      router.push(`/documents/templates/${id}`);
    },
  });

  const handlePreview = async () => {
    try {
      setPreviewLoading(true);
      // We create a temporary template-less preview by POSTing a preview
      const res = await api.post('/document-templates/preview', {
        templateId: 'preview',
        variables: {},
      }).catch(() => null);

      // If preview endpoint fails, just render the template with sample data replaced
      const sampleHtml = content
        .replace(/\{\{employeeName\}\}/g, 'John Doe')
        .replace(/\{\{firstName\}\}/g, 'John')
        .replace(/\{\{lastName\}\}/g, 'Doe')
        .replace(/\{\{position\}\}/g, 'Software Engineer')
        .replace(/\{\{department\}\}/g, 'Engineering')
        .replace(/\{\{joiningDate\}\}/g, new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }))
        .replace(/\{\{companyName\}\}/g, 'Acme Corp')
        .replace(/\{\{hrName\}\}/g, 'HR Department')
        .replace(/\{\{formatDate [^}]+\}\}/g, new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }))
        .replace(/\{\{currency [^}]+\}\}/g, '$75,000')
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
    // Restore cursor position after variable
    setTimeout(() => {
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = start + variable.length;
    }, 0);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/documents/templates">
            <Button variant="ghost" size="sm"><ArrowLeft size={14} /></Button>
          </Link>
          <h1 className="font-serif text-xl font-semibold text-ink">New Template</h1>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePreview}
            isLoading={previewLoading}
          >
            <Eye size={14} /> Preview
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit((data) => createMut.mutate(data))}
            isLoading={createMut.isPending}
          >
            <Save size={14} /> Save Template
          </Button>
        </div>
      </div>

      {createMut.isError && (
        <div className="flex items-center gap-2 rounded-lg bg-danger-soft/50 border border-danger/20 px-4 py-3 text-sm text-danger">
          <AlertTriangle size={14} />
          {(createMut.error as any)?.response?.data?.message || 'Failed to save template.'}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        {/* Left: Form fields */}
        <div className="space-y-4 lg:col-span-1">
          <Card>
            <CardHeader><CardTitle>Template Info</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Template Name *</Label>
                <Input {...register('name')} placeholder="e.g. Standard Offer Letter" />
                <FieldError message={errors.name?.message} />
              </div>
              <div>
                <Label>Category *</Label>
                <select {...register('category')} className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm">
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Description</Label>
                <Input {...register('description')} placeholder="Brief description of this template" />
              </div>
            </CardContent>
          </Card>

          {/* Variable Insertion */}
          <Card>
            <CardHeader><CardTitle>Insert Variable</CardTitle></CardHeader>
            <CardContent>
              <p className="mb-3 text-xs text-ink-faint">Click a variable to insert it at the cursor position:</p>
              <div className="flex flex-wrap gap-1.5">
                {VARIABLE_HELP.map((v) => (
                  <button
                    key={v.var}
                    onClick={() => insertVariable(v.var)}
                    className="rounded-md border border-border bg-paper px-2 py-1 text-xs font-mono text-accent hover:bg-accent/10 hover:border-accent/30 transition-colors"
                    title={v.desc}
                  >
                    {v.var}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Content Editor */}
        <div className="lg:col-span-3">
          {mode === 'editor' ? (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle>Template Content</CardTitle>
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
                  {view === 'code' ? (
                    <textarea
                      {...register('content')}
                      ref={(el) => { textareaRef.current = el; }}
                      className="w-full min-h-[500px] resize-y border-0 bg-paper p-4 font-mono text-sm leading-relaxed text-ink outline-none focus:ring-0"
                      placeholder="Enter HTML template content with {{variable}} placeholders..."
                      spellCheck={false}
                    />
                  ) : (
                    <div className="min-h-[500px]">
                      <textarea
                        {...register('content')}
                        ref={(el) => { textareaRef.current = el; }}
                        className="w-full min-h-[500px] resize-y border-0 bg-paper p-4 font-mono text-sm leading-relaxed text-ink outline-none focus:ring-0"
                        placeholder="Enter HTML template content with {{variable}} placeholders..."
                        spellCheck={false}
                      />
                      <p className="border-t border-border p-2 text-xs text-ink-faint">
                        Rich text mode shows a code editor. For WYSIWYG editing, download the HTML template,
                        edit in your preferred tool, and paste the HTML back here.
                      </p>
                    </div>
                  )}
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
