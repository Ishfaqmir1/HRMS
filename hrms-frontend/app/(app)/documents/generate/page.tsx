'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, useRouter } from 'next/navigation';
import { api, unwrap } from '@/lib/api-client';
import { PaginatedResult, Employee, DocumentTemplate, DOCUMENT_CATEGORY_LABELS, DOCUMENT_CATEGORY_COLORS } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input, Label } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Printer, Check, Search, FileText, AlertTriangle, CheckSquare, Square,
  Download, Loader2,
} from 'lucide-react';
import Link from 'next/link';

export default function GenerateDocumentsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const preselectedTemplate = searchParams.get('templateId');

  const [selectedTemplate, setSelectedTemplate] = useState<string>(preselectedTemplate || '');
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [format, setFormat] = useState<'pdf' | 'docx' | 'html'>('pdf');
  const [notes, setNotes] = useState('');
  const [search, setSearch] = useState('');
  const [selectAll, setSelectAll] = useState(false);
  const [resultDialog, setResultDialog] = useState<{ count: number; templateName: string } | null>(null);

  // Fetch templates
  const { data: templatesData } = useQuery({
    queryKey: ['document-templates', 'all'],
    queryFn: () => unwrap<PaginatedResult<DocumentTemplate>>(
      api.get('/document-templates', { params: { page: 1, limit: 100 } }),
    ),
  });

  // Fetch employees
  const { data: employeesData } = useQuery({
    queryKey: ['employees', 'list', search],
    queryFn: () => unwrap<PaginatedResult<Employee>>(
      api.get('/employees', {
        params: { page: 1, limit: 100, search: search || undefined },
      }),
    ),
  });

  const templates = templatesData?.items || [];
  const employees = employeesData?.items || [];

  // Generate mutation
  const generateMut = useMutation({
    mutationFn: () => api.post('/document-templates/generate', {
      templateId: selectedTemplate,
      employeeIds: selectedEmployees,
      format,
      notes: notes || undefined,
    }),
    onSuccess: (res: any) => {
      const data = res.data || res;
      setResultDialog({ count: data.count, templateName: data.templateName });
      queryClient.invalidateQueries({ queryKey: ['document-templates', 'generated'] });
    },
  });

  const selectedTemplateData = templates.find((t) => t.id === selectedTemplate);

  const toggleEmployee = (id: string) => {
    setSelectedEmployees((prev) =>
      prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id],
    );
  };

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedEmployees([]);
    } else {
      setSelectedEmployees(employees.map((e) => e.id));
    }
    setSelectAll(!selectAll);
  };

  const canGenerate = selectedTemplate && selectedEmployees.length > 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/documents">
          <Button variant="ghost" size="sm">&larr; Back</Button>
        </Link>
        <div>
          <h1 className="font-serif text-2xl font-semibold text-ink">Generate Documents</h1>
          <p className="text-sm text-ink-faint">Select a template and employees to generate documents</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: Template Selection */}
        <Card>
          <CardHeader><CardTitle>1. Select Template</CardTitle></CardHeader>
          <CardContent>
            {templates.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-6">
                <FileText size={24} className="text-ink-faint" />
                <p className="text-sm text-ink-faint">No templates available.</p>
                <Link href="/documents/templates/new">
                  <Button variant="outline" size="sm">Create Template</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {templates.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTemplate(t.id)}
                    className={`w-full rounded-lg border p-3 text-left transition-all ${
                      selectedTemplate === t.id
                        ? 'border-accent bg-accent/[0.03] ring-1 ring-accent/20'
                        : 'border-border hover:border-accent/30 hover:bg-paper'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-ink">{t.name}</p>
                        <span className={`inline-block mt-1 rounded-md px-2 py-0.5 text-xs font-medium ${DOCUMENT_CATEGORY_COLORS[t.category as keyof typeof DOCUMENT_CATEGORY_COLORS] || DOCUMENT_CATEGORY_COLORS.OTHER}`}>
                          {DOCUMENT_CATEGORY_LABELS[t.category as keyof typeof DOCUMENT_CATEGORY_LABELS] || t.category}
                        </span>
                      </div>
                      {selectedTemplate === t.id && (
                        <Check size={16} className="text-accent" />
                      )}
                    </div>
                    {t.description && (
                      <p className="mt-1 text-xs text-ink-faint">{t.description}</p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Middle: Employee Selection */}
        <Card>
          <CardHeader>
            <CardTitle>2. Select Employees</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative mb-3">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
              <Input
                placeholder="Search employees..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {selectedEmployees.length > 0 && (
              <p className="mb-2 text-xs text-accent font-medium">
                {selectedEmployees.length} selected
              </p>
            )}

            <div className="max-h-[400px] space-y-1 overflow-y-auto">
              {/* Select All */}
              {employees.length > 0 && (
                <button
                  onClick={toggleSelectAll}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-ink-soft hover:bg-paper transition-colors"
                >
                  {selectAll ? <CheckSquare size={14} className="text-accent" /> : <Square size={14} />}
                  <span className="font-medium">Select All</span>
                </button>
              )}

              {employees.map((emp) => (
                <button
                  key={emp.id}
                  onClick={() => toggleEmployee(emp.id)}
                  className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                    selectedEmployees.includes(emp.id)
                      ? 'bg-accent/[0.04] text-ink'
                      : 'text-ink-soft hover:bg-paper'
                  }`}
                >
                  {selectedEmployees.includes(emp.id)
                    ? <CheckSquare size={14} className="text-accent shrink-0" />
                    : <Square size={14} className="shrink-0" />
                  }
                  <span className="truncate">
                    {emp.firstName} {emp.lastName}
                  </span>
                  <span className="ml-auto text-xs text-ink-faint">{emp.employeeCode}</span>
                </button>
              ))}
              {employees.length === 0 && (
                <p className="py-6 text-center text-sm text-ink-faint">No employees found.</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Right: Configuration & Generate */}
        <Card>
          <CardHeader><CardTitle>3. Configure & Generate</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {/* Selected template summary */}
            <div className="rounded-lg bg-paper p-3">
              <p className="text-xs text-ink-faint">Template</p>
              <p className="text-sm font-medium text-ink">
                {selectedTemplateData?.name || 'Not selected'}
              </p>
            </div>

            {/* Employee count */}
            <div className="rounded-lg bg-paper p-3">
              <p className="text-xs text-ink-faint">Employees</p>
              <p className="text-sm font-medium text-ink">{selectedEmployees.length} selected</p>
            </div>

            {/* Format */}
            <div>
              <Label>Output Format</Label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as any)}
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
              >
                <option value="pdf">PDF</option>
                <option value="docx">Word (DOCX)</option>
                <option value="html">HTML</option>
              </select>
            </div>

            {/* Notes */}
            <div>
              <Label>Notes (optional)</Label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Please review before sending"
                className="mt-1 flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"
              />
            </div>

            <div className="rounded-lg bg-amber-soft/40 border border-amber/10 px-4 py-3">
              <div className="flex items-start gap-2">
                <AlertTriangle size={14} className="mt-0.5 text-amber shrink-0" />
                <p className="text-xs text-amber/80">
                  Documents will be generated for each selected employee with their data merged into the template.
                </p>
              </div>
            </div>

            <Button
              className="w-full"
              disabled={!canGenerate}
              onClick={() => generateMut.mutate()}
              isLoading={generateMut.isPending}
            >
              <Printer size={14} /> Generate {selectedEmployees.length > 0 ? `(${selectedEmployees.length})` : ''}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Result Dialog */}
      <Dialog open={!!resultDialog} onOpenChange={(o) => !o && setResultDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Documents Generated</DialogTitle>
            <DialogDescription>
              Successfully generated {resultDialog?.count} document(s) using &ldquo;{resultDialog?.templateName}&rdquo;.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center py-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/10">
              <Check size={28} className="text-accent" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setResultDialog(null); router.push('/documents/generated'); }}>
              <FileText size={14} /> View Generated
            </Button>
            <Button onClick={() => setResultDialog(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Error Dialog */}
      {generateMut.isError && (
        <div className="flex items-center gap-2 rounded-lg bg-danger-soft/50 border border-danger/20 px-4 py-3 text-sm text-danger">
          <AlertTriangle size={14} />
          {(generateMut.error as any)?.response?.data?.message || 'Generation failed.'}
        </div>
      )}
    </div>
  );
}
