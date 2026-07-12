'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api-client';
import { PaginatedResult, GeneratedDocument, DOCUMENT_CATEGORY_LABELS, DOCUMENT_CATEGORY_COLORS } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  FileText, Download, Eye, Search, FileDown, FileType,
  CalendarDays, Loader2,
} from 'lucide-react';
import Link from 'next/link';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';

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

export default function GeneratedDocumentsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [selectedDoc, setSelectedDoc] = useState<GeneratedDocument | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['document-templates', 'generated', page, search, categoryFilter],
    queryFn: () => unwrap<PaginatedResult<GeneratedDocument>>(
      api.get('/document-templates/generated', {
        params: {
          page,
          limit: 20,
          search: search || undefined,
          category: categoryFilter || undefined,
        },
      }),
    ),
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

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-ink">Generated Documents</h1>
          <p className="mt-1 text-sm text-ink-faint">View and download generated documents</p>
        </div>
        <Link href="/documents/generate">
          <Button><FileDown size={14} /> Generate New</Button>
        </Link>
      </div>

      <Card>
        <CardContent className="pt-5">
          {/* Filters */}
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
              <Input
                placeholder="Search documents..."
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
              <option value="">All Types</option>
              {Object.entries(DOCUMENT_CATEGORY_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          {isLoading && <p className="text-sm text-ink-faint">Loading documents…</p>}

          {data && (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Document</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Employee</TableHead>
                    <TableHead>Format</TableHead>
                    <TableHead>Generated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell className="font-medium text-ink">
                        <div className="flex items-center gap-2">
                          <FileText size={14} className="text-ink-faint shrink-0" />
                          <span className="truncate max-w-[200px]">{doc.title}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-medium ${DOCUMENT_CATEGORY_COLORS[doc.documentType as keyof typeof DOCUMENT_CATEGORY_COLORS] || DOCUMENT_CATEGORY_COLORS.OTHER}`}>
                          {DOCUMENT_CATEGORY_LABELS[doc.documentType as keyof typeof DOCUMENT_CATEGORY_LABELS] || doc.documentType}
                        </span>
                      </TableCell>
                      <TableCell className="text-ink-soft text-sm">
                        {doc.employee ? `${doc.employee.firstName} ${doc.employee.lastName}` : '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="default" className="uppercase text-[10px]">
                          {doc.fileType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-ink-faint text-xs">
                        {formatDate(doc.generatedAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => handlePreview(doc)}>
                            <Eye size={14} />
                          </Button>
                          <a
                            href={`/api/v1/document-templates/generated/${doc.id}/download`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Button variant="ghost" size="sm">
                              <Download size={14} />
                            </Button>
                          </a>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {data.items.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-ink-faint">
                        No generated documents yet. Go to <Link href="/documents/generate" className="text-accent underline">Generate Documents</Link> to create some.
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

      {/* Preview Dialog */}
      <Dialog open={!!selectedDoc} onOpenChange={(o) => { if (!o) { setSelectedDoc(null); setPreviewHtml(null); }}}>
        <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedDoc?.title}</DialogTitle>
            <DialogDescription>
              {selectedDoc?.employee && `${selectedDoc.employee.firstName} ${selectedDoc.employee.lastName}`}
              {selectedDoc?.generatedAt && ` · ${formatDateTime(selectedDoc.generatedAt)}`}
            </DialogDescription>
          </DialogHeader>

          {previewLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-ink-faint" />
            </div>
          ) : previewHtml ? (
            <div className="rounded-lg border border-border bg-white p-6 shadow-sm">
              <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: previewHtml }} />
            </div>
          ) : selectedDoc?.fileUrl ? (
            <div className="flex flex-col items-center gap-4 py-8">
              <FileType size={48} className="text-ink-faint" />
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
    </div>
  );
}
