'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api-client';
import { PaginatedResult, DocumentTemplate, DOCUMENT_CATEGORY_LABELS, DOCUMENT_CATEGORY_COLORS } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Plus, Pencil, Trash2, Copy, Eye, Search,
} from 'lucide-react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';



function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

export default function TemplatesPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['document-templates', page, search, categoryFilter],
    queryFn: () => unwrap<PaginatedResult<DocumentTemplate>>(
      api.get('/document-templates', {
        params: {
          page,
          limit: 20,
          search: search || undefined,
          category: categoryFilter || undefined,
        },
      }),
    ),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/document-templates/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['document-templates'] }),
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-ink">Document Templates</h1>
          <p className="mt-1 text-sm text-ink-faint">Create and manage document letter templates</p>
        </div>
        <Link href="/documents/templates/new">
          <Button><Plus size={14} /> Create Template</Button>
        </Link>
      </div>

      <Card>
        <CardContent className="pt-5">
          {/* Filters */}
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
              <Input
                placeholder="Search templates..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="pl-9"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm"
            >
              <option value="">All Categories</option>
              {Object.entries(DOCUMENT_CATEGORY_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          {isLoading && <p className="text-sm text-ink-faint">Loading templates…</p>}

          {data && (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium text-ink">
                        <div className="flex items-center gap-2">
                          {t.name}
                          {t.isDefault && <Badge variant="default" className="text-[10px]">Default</Badge>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-medium ${DOCUMENT_CATEGORY_COLORS[t.category as keyof typeof DOCUMENT_CATEGORY_COLORS] || DOCUMENT_CATEGORY_COLORS.OTHER}`}>
                          {DOCUMENT_CATEGORY_LABELS[t.category as keyof typeof DOCUMENT_CATEGORY_LABELS] || t.category}
                        </span>
                      </TableCell>
                      <TableCell className="text-ink-faint text-xs max-w-xs truncate">
                        {t.description || '—'}
                      </TableCell>
                      <TableCell className="text-ink-faint text-xs">{formatDate(t.updatedAt)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Link href={`/documents/templates/${t.id}`}>
                            <Button variant="ghost" size="sm"><Pencil size={12} /></Button>
                          </Link>
                          <Button variant="ghost" size="sm" onClick={() => deleteMut.mutate(t.id)}>
                            <Trash2 size={12} className="text-danger" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {data.items.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-ink-faint">
                        No templates found. Create a new template or load default templates.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              <div className="mt-4 flex items-center justify-between text-sm text-ink-faint">
                <span>Page {data.meta.page} of {Math.max(data.meta.totalPages, 1)}</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
                  <Button variant="outline" size="sm" disabled={page >= data.meta.totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
