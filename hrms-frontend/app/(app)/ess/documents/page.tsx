'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api-client';
import { PaginatedResult, GeneratedDocument, DOCUMENT_CATEGORY_LABELS, DOCUMENT_CATEGORY_COLORS } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Label, FieldError } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, Download, Upload, FileText, Receipt, ChevronRight, Trash2 } from 'lucide-react';
import Link from 'next/link';

interface EmployeeDocument {
  id: string;
  name: string;
  category: string;
  fileUrl: string;
  fileSize: number | null;
  mimeType: string | null;
  notes: string | null;
  uploadedAt: string;
}

const DOC_CATEGORIES = [
  'ID_PROOF', 'ADDRESS_PROOF', 'EDUCATION', 'CERTIFICATION',
  'CONTRACT', 'TAX_FORM', 'MEDICAL', 'OTHER',
] as const;

const UPLOAD_CATEGORY_LABELS: Record<string, string> = {
  ID_PROOF: 'ID Proof', ADDRESS_PROOF: 'Address Proof', EDUCATION: 'Education',
  CERTIFICATION: 'Certification', CONTRACT: 'Contract', TAX_FORM: 'Tax Form',
  MEDICAL: 'Medical', OTHER: 'Other',
};

const createSchema = z.object({
  name: z.string().min(1, 'Required'),
  category: z.enum(DOC_CATEGORIES).default('OTHER'),
  fileUrl: z.string().url('Must be a valid URL'),
  notes: z.string().optional(),
});
type CreateForm = z.infer<typeof createSchema>;

function fmtSize(bytes: number | null) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export default function DocumentsPage() {
  const queryClient = useQueryClient();
  const [genPage, setGenPage] = useState(1);
  const [upPage, setUpPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<GeneratedDocument | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Generated documents
  const { data: generatedData, isLoading: genLoading } = useQuery({
    queryKey: ['me', 'generated-documents', genPage],
    queryFn: () => unwrap<PaginatedResult<GeneratedDocument>>(
      api.get('/me/generated-documents', { params: { page: genPage, limit: 10 } }),
    ),
  });

  // Uploaded documents
  const { data: uploadedData, isLoading: upLoading } = useQuery({
    queryKey: ['me', 'documents', upPage],
    queryFn: () => unwrap<PaginatedResult<EmployeeDocument>>(
      api.get('/me/documents', { params: { page: upPage, limit: 5 } }),
    ),
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { category: 'OTHER' },
  });

  const createMut = useMutation({
    mutationFn: (v: CreateForm) => api.post('/documents', v),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me', 'documents'] });
      setCreateOpen(false);
      reset();
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/documents/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['me', 'documents'] }),
  });

  const handlePreview = async (doc: GeneratedDocument) => {
    setSelectedDoc(doc);
    if (doc.fileType === 'html') {
      setPreviewLoading(true);
      try {
        const res = await fetch(doc.fileUrl);
        const html = await res.text();
        setPreviewHtml(html);
      } catch {
        setPreviewHtml(null);
      } finally {
        setPreviewLoading(false);
      }
    } else {
      setPreviewHtml(null);
    }
  };

  const generatedDocs = generatedData?.items || [];
  const uploadedDocs = uploadedData?.items || [];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-ink">My Documents</h1>
          <p className="mt-1 text-sm text-ink-faint">
            View your letter documents, payslips, and uploaded files
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/ess/payslips">
            <Button variant="outline" size="sm">
              <Receipt size={14} /> View Payslips
            </Button>
          </Link>
          <Button onClick={() => setCreateOpen(true)} size="sm">
            <Upload size={14} /> Add Document
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10">
              <FileText size={20} className="text-accent" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-ink">{generatedData?.meta?.total || 0}</p>
              <p className="text-xs text-ink-faint">Letters &amp; Certificates</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
              <Receipt size={20} className="text-blue-600" />
            </div>
            <div>
              <Link href="/ess/payslips" className="hover:underline">
                <p className="text-2xl font-semibold text-ink">View</p>
              </Link>
              <p className="text-xs text-ink-faint">Payslips</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50">
              <Upload size={20} className="text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-ink">{uploadedData?.meta?.total || 0}</p>
              <p className="text-xs text-ink-faint">Uploaded Documents</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Generated Documents Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>
            <span className="flex items-center gap-2">
              <FileText size={16} className="text-accent" />
              Letters &amp; Certificates
            </span>
          </CardTitle>
          {genLoading && <span className="text-xs text-ink-faint">Loading…</span>}
        </CardHeader>
        <CardContent>
          {generatedDocs.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <FileText size={32} className="text-ink-faint" />
              <p className="text-sm text-ink-faint">No letters or certificates generated for you yet.</p>
              <p className="text-xs text-ink-faint">Ask your HR team to generate documents via the Document Builder.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {generatedDocs.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between rounded-lg border border-border px-4 py-3 transition-all hover:shadow-sm hover:border-accent/20"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText size={16} className="shrink-0 text-accent" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink truncate">{doc.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-medium ${DOCUMENT_CATEGORY_COLORS[doc.documentType as keyof typeof DOCUMENT_CATEGORY_COLORS] || DOCUMENT_CATEGORY_COLORS.OTHER}`}>
                          {DOCUMENT_CATEGORY_LABELS[doc.documentType as keyof typeof DOCUMENT_CATEGORY_LABELS] || doc.documentType}
                        </span>
                        <Badge variant="default" className="uppercase text-[10px]">{doc.fileType}</Badge>
                        <span className="text-[10px] text-ink-faint">{formatDate(doc.generatedAt)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => handlePreview(doc)} title="Preview">
                      <Eye size={14} />
                    </Button>
                    <a
                      href={`/api/v1/document-templates/generated/${doc.id}/download`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button variant="ghost" size="sm" title="Download">
                        <Download size={14} />
                      </Button>
                    </a>
                  </div>
                </div>
              ))}
              {(generatedData?.meta?.totalPages || 1) > 1 && (
                <div className="flex items-center justify-between pt-3 text-xs text-ink-faint">
                  <span>Page {generatedData?.meta.page || 1} of {Math.max(generatedData?.meta.totalPages || 1, 1)}</span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={genPage <= 1} onClick={() => setGenPage(p => p - 1)}>Previous</Button>
                    <Button variant="outline" size="sm" disabled={genPage >= (generatedData?.meta.totalPages || 1)} onClick={() => setGenPage(p => p + 1)}>Next</Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Uploaded Documents Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>
            <span className="flex items-center gap-2">
              <Upload size={16} className="text-purple-600" />
              Uploaded Documents
            </span>
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setCreateOpen(true)}>
            <Upload size={12} /> Add
          </Button>
        </CardHeader>
        <CardContent>
          {upLoading && <p className="text-sm text-ink-faint">Loading…</p>}
          {uploadedData && (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Uploaded</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {uploadedDocs.map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell className="font-medium text-ink">{doc.name}</TableCell>
                      <TableCell>
                        <Badge variant="default">{UPLOAD_CATEGORY_LABELS[doc.category] || doc.category}</Badge>
                      </TableCell>
                      <TableCell className="text-ink-soft text-xs">
                        {new Date(doc.uploadedAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
                            <Button variant="ghost" size="sm"><Download size={14} /></Button>
                          </a>
                          <Button variant="ghost" size="sm" onClick={() => deleteMut.mutate(doc.id)}>
                            <Trash2 size={14} className="text-danger" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {uploadedDocs.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="py-6 text-center text-ink-faint">No uploaded documents yet.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </>
          )}
        </CardContent>
      </Card>

      {/* Quick Links */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link href="/ess/payslips">
          <Card className="cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5">
            <CardContent className="flex items-center gap-3 py-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
                <Receipt size={20} className="text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-ink">View Payslips</p>
                <p className="text-xs text-ink-faint">Monthly salary slips</p>
              </div>
              <ChevronRight size={16} className="text-ink-faint" />
            </CardContent>
          </Card>
        </Link>
        <Link href="/ess/attendance">
          <Card className="cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5">
            <CardContent className="flex items-center gap-3 py-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50">
                <Receipt size={20} className="text-amber-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-ink">Attendance Calendar</p>
                <p className="text-xs text-ink-faint">View your attendance records</p>
              </div>
              <ChevronRight size={16} className="text-ink-faint" />
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Preview Dialog */}
      <Dialog open={!!selectedDoc} onOpenChange={(o) => { if (!o) { setSelectedDoc(null); setPreviewHtml(null); }}}>
        <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedDoc?.title}</DialogTitle>
            <DialogDescription>
              {selectedDoc?.generatedAt && `Generated ${formatDateTime(selectedDoc.generatedAt)}`}
            </DialogDescription>
          </DialogHeader>

          {previewLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-accent" />
            </div>
          ) : previewHtml ? (
            <div className="rounded-lg border border-border bg-white p-6 shadow-sm">
              <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: previewHtml }} />
            </div>
          ) : selectedDoc?.fileUrl ? (
            <div className="flex flex-col items-center gap-4 py-8">
              <p className="text-sm text-ink-faint">
                Preview not available for {selectedDoc.fileType.toUpperCase()} files.
              </p>
              <a
                href={`/api/v1/document-templates/generated/${selectedDoc.id}/download`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button><Download size={14} /> Download {selectedDoc.fileType.toUpperCase()}</Button>
              </a>
            </div>
          ) : null}

          <DialogFooter>
            {selectedDoc && (
              <a
                href={`/api/v1/document-templates/generated/${selectedDoc.id}/download`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline"><Download size={14} /> Download</Button>
              </a>
            )}
            <Button onClick={() => { setSelectedDoc(null); setPreviewHtml(null); }}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Document Dialog */}
      <Dialog open={createOpen} onOpenChange={o => !o && setCreateOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Document</DialogTitle>
            <DialogDescription>Upload a document by providing its URL.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(v => createMut.mutate(v))} className="space-y-4">
            <div>
              <Label>Document Name</Label>
              <Input {...register('name')} placeholder="e.g. Passport Copy" />
              <FieldError message={errors.name?.message} />
            </div>
            <div>
              <Label>Category</Label>
              <select {...register('category')} className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm">
                {DOC_CATEGORIES.map(c => (
                  <option key={c} value={c}>{UPLOAD_CATEGORY_LABELS[c]}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>File URL</Label>
              <Input {...register('fileUrl')} placeholder="https://storage.example.com/doc.pdf" />
              <FieldError message={errors.fileUrl?.message} />
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Input {...register('notes')} placeholder="Any remarks" />
            </div>
            {createMut.isError && (
              <p className="text-sm text-danger">{(createMut.error as any)?.response?.data?.message || 'Failed.'}</p>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button type="submit" isLoading={createMut.isPending}>Upload</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}