'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api-client';
import { PaginatedResult } from '@/lib/types';
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
import { Trash2, Download, Upload } from 'lucide-react';

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

const CATEGORY_LABELS: Record<string, string> = {
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

export default function DocumentsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['me', 'documents', page],
    queryFn: () => unwrap<PaginatedResult<EmployeeDocument>>(api.get('/me/documents', { params: { page, limit: 20 } })),
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

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="ledger-tab font-serif text-2xl font-semibold text-ink">My Documents</h1>
        <Button onClick={() => setCreateOpen(true)}>
          <Upload size={14} /> Add Document
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Uploaded Documents</CardTitle></CardHeader>
        <CardContent>
          {isLoading && <p className="text-sm text-ink-faint">Loading documents…</p>}
          {data && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-medium text-ink">{doc.name}</TableCell>
                    <TableCell><Badge variant="default">{CATEGORY_LABELS[doc.category] || doc.category}</Badge></TableCell>
                    <TableCell className="text-ink-soft">{fmtSize(doc.fileSize)}</TableCell>
                    <TableCell className="text-ink-soft">
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
                {data.items.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="py-8 text-center text-ink-faint">No documents uploaded yet.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
          <div className="mt-4 flex items-center justify-between text-sm text-ink-faint">
            <span>Page {data?.meta.page || 1} of {Math.max(data?.meta.totalPages || 1, 1)}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
              <Button variant="outline" size="sm" disabled={page >= (data?.meta.totalPages || 1)} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          </div>
        </CardContent>
      </Card>

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
                  <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
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
