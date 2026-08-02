'use client';

import { useState, useRef, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, FileText, CheckCircle, XCircle, AlertTriangle, Download, ArrowLeft } from 'lucide-react';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import Link from 'next/link';

// ──────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────

interface ParsedRow {
  employeeCode: string;
  firstName: string;
  lastName: string;
  workEmail?: string;
  dateOfJoining: string;
  employmentType?: string;
  department?: string;
  designation?: string;
  phone?: string;
  gender?: string;
}

interface ImportResult {
  row: number;
  employeeCode: string;
  status: 'CREATED' | 'SKIPPED' | 'FAILED';
  error?: string;
}

interface ImportResponse {
  total: number;
  created: number;
  failed: number;
  results: ImportResult[];
}

// ──────────────────────────────────────────────────────────────────
// CSV Parsing
// ──────────────────────────────────────────────────────────────────

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split('\n').filter((l) => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/['"]/g, ''));
  const rows = lines.slice(1).map((line) => {
    const vals: string[] = [];
    let current = '';
    let inQuotes = false;
    for (const ch of line) {
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (ch === ',' && !inQuotes) { vals.push(current.trim()); current = ''; continue; }
      current += ch;
    }
    vals.push(current.trim());
    return vals;
  });

  return { headers, rows };
}

const HEADER_MAP: Record<string, keyof ParsedRow> = {
  'employee code': 'employeeCode',
  'employee_code': 'employeeCode',
  'employeecode': 'employeeCode',
  'code': 'employeeCode',
  'first name': 'firstName',
  'first_name': 'firstName',
  'firstname': 'firstName',
  'last name': 'lastName',
  'last_name': 'lastName',
  'lastname': 'lastName',
  'email': 'workEmail',
  'work email': 'workEmail',
  'work_email': 'workEmail',
  'date of joining': 'dateOfJoining',
  'date_of_joining': 'dateOfJoining',
  'joining date': 'dateOfJoining',
  'joining_date': 'dateOfJoining',
  'employment type': 'employmentType',
  'employment_type': 'employmentType',
  'employement type': 'employmentType',
  'department': 'department',
  'designation': 'designation',
  'phone': 'phone',
  'gender': 'gender',
};

function mapRows(headers: string[], rows: string[][]): ParsedRow[] {
  const colIndices = headers.map((h) => HEADER_MAP[h] ?? null);
  return rows.map((row) => {
    const obj: any = {};
    colIndices.forEach((field, idx) => {
      if (field && row[idx]) {
        obj[field] = row[idx].replace(/^['"]|['"]$/g, '');
      }
    });
    // Auto-generate employee code if missing
    if (!obj.employeeCode) {
      const ts = Date.now().toString(36);
      const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
      obj.employeeCode = `IMP-${ts}-${rand}`;
    }
    if (!obj.dateOfJoining) {
      obj.dateOfJoining = new Date().toISOString().split('T')[0];
    }
    if (!obj.employmentType) obj.employmentType = 'FULL_TIME';
    return obj as ParsedRow;
  });
}

function validateRows(parsed: ParsedRow[]): { valid: ParsedRow[]; errors: { row: number; message: string }[] } {
  const valid: ParsedRow[] = [];
  const errors: { row: number; message: string }[] = [];

  parsed.forEach((row, i) => {
    const issues: string[] = [];
    if (!row.firstName) issues.push('Missing first name');
    if (!row.lastName) issues.push('Missing last name');
    if (!row.employeeCode) issues.push('Missing employee code');
    if (!row.dateOfJoining || !/^\d{4}-\d{2}-\d{2}$/.test(row.dateOfJoining)) issues.push('Invalid date format (use YYYY-MM-DD)');

    if (issues.length === 0) {
      valid.push(row);
    } else {
      errors.push({ row: i + 1, message: issues.join('; ') });
    }
  });

  return { valid, errors };
}

// ──────────────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────────────

export default function EmployeeImportPage() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [validationErrors, setValidationErrors] = useState<{ row: number; message: string }[]>([]);
  const [importResult, setImportResult] = useState<ImportResponse | null>(null);
  const [fileName, setFileName] = useState<string>('');

  const processFile = useCallback((file: File) => {
    if (!file.name.endsWith('.csv')) {
      alert('Please upload a CSV file.');
      return;
    }
    setFileName(file.name);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const { headers, rows } = parseCSV(text);

      if (headers.length === 0 || rows.length === 0) {
        alert('Could not parse CSV. Ensure it has a header row and at least one data row.');
        return;
      }

      const parsed = mapRows(headers, rows);
      const { valid, errors } = validateRows(parsed);
      setParsedRows(valid);
      setValidationErrors(errors);
    };
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  const importMut = useMutation({
    mutationFn: async () => {
      const payload = parsedRows.map((r) => ({
        employeeCode: r.employeeCode,
        firstName: r.firstName,
        lastName: r.lastName,
        workEmail: r.workEmail || undefined,
        dateOfJoining: r.dateOfJoining,
        employmentType: r.employmentType?.toUpperCase().replace(/[^A-Z_]/g, '') as any || 'FULL_TIME',
        createLoginAccount: !!r.workEmail,
        roleSlug: 'employee',
      }));

      const { data } = await api.post('/employees/import', { employees: payload });
      return data.data as ImportResponse;
    },
    onSuccess: (result) => {
      setImportResult(result);
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });

  function resetAll() {
    setParsedRows([]);
    setValidationErrors([]);
    setImportResult(null);
    setFileName('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  const downloadTemplate = () => {
    const header = 'Employee Code,First Name,Last Name,Work Email,Date of Joining,Employment Type,Department,Designation,Phone,Gender';
    const sample = 'EMP-101,John,Smith,john.smith@acme.com,2026-01-15,FULL_TIME,Engineering,Software Engineer,+1-555-0100,MALE';
    const blob = new Blob([`${header}\n${sample}\n`], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'employee-import-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const fmt = (v: number) => new Intl.NumberFormat('en-US').format(v);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link href="/employees">
            <Button variant="ghost" size="sm">
              <ArrowLeft size={16} /> Back
            </Button>
          </Link>
          <div>
            <h1 className="ledger-tab font-serif text-2xl font-semibold text-ink">Bulk Import Employees</h1>
            <p className="mt-1 text-sm text-ink-faint">
              Upload a CSV file to create multiple employees at once.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={downloadTemplate}>
          <Download size={14} /> Download template
        </Button>
      </div>

      {/* Drop Zone */}
      {parsedRows.length === 0 && !importResult && (
        <Card>
          <CardContent className="pt-5">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 transition-all ${
                dragOver
                  ? 'border-accent bg-accent/[0.03]'
                  : 'border-border hover:border-accent/50 hover:bg-accent/[0.02]'
              }`}
            >
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent-soft">
                <Upload size={28} className="text-accent" />
              </div>
              <p className="text-lg font-medium text-ink">Drop CSV file here, or click to browse</p>
              <p className="mt-1 text-sm text-ink-faint">
                File should have a header row with employee data
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Preview Table */}
      {parsedRows.length > 0 && !importResult && (
        <>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Preview: {fileName}</CardTitle>
                <p className="text-sm text-ink-faint mt-1">
                  {fmt(parsedRows.length)} valid rows
                  {validationErrors.length > 0 && ` · ${fmt(validationErrors.length)} rows with errors (skipped)`}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={resetAll}>
                  Choose different file
                </Button>
                <Button
                  size="sm"
                  onClick={() => importMut.mutate()}
                  isLoading={importMut.isPending}
                  disabled={parsedRows.length === 0}
                >
                  Import {fmt(parsedRows.length)} employees
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="max-h-80 overflow-y-auto rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>First Name</TableHead>
                      <TableHead>Last Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Joining Date</TableHead>
                      <TableHead>Type</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedRows.slice(0, 50).map((row, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-ink-faint text-xs">{i + 1}</TableCell>
                        <TableCell className="font-medium text-ink">{row.employeeCode}</TableCell>
                        <TableCell>{row.firstName}</TableCell>
                        <TableCell>{row.lastName}</TableCell>
                        <TableCell className="text-ink-soft">{row.workEmail || '—'}</TableCell>
                        <TableCell>{row.dateOfJoining}</TableCell>
                        <TableCell>
                          <Badge variant="default">{row.employmentType || 'FULL_TIME'}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    {parsedRows.length > 50 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-sm text-ink-faint py-4">
                          ... and {fmt(parsedRows.length - 50)} more rows
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Validation Errors */}
              {validationErrors.length > 0 && (
                <div className="mt-4 rounded-lg border border-danger/20 bg-danger-soft/30 px-4 py-3">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle size={16} className="text-danger" />
                    <p className="text-sm font-medium text-danger">
                      {fmt(validationErrors.length)} row(s) with errors will be skipped
                    </p>
                  </div>
                  <ul className="space-y-1">
                    {validationErrors.map((err, i) => (
                      <li key={i} className="text-xs text-danger">
                        Row {err.row}: {err.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Import Results */}
      {importResult && (
        <Card>
          <CardHeader>
            <CardTitle>Import Complete</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-xl bg-accent/[0.04] border border-accent/10 p-4 text-center">
                <CheckCircle size={24} className="mx-auto mb-1 text-accent" />
                <p className="text-2xl font-bold text-accent">{fmt(importResult.created)}</p>
                <p className="text-xs text-ink-faint">Created</p>
              </div>
              <div className="rounded-xl bg-danger-soft/30 border border-danger/20 p-4 text-center">
                <XCircle size={24} className="mx-auto mb-1 text-danger" />
                <p className="text-2xl font-bold text-danger">{fmt(importResult.failed)}</p>
                <p className="text-xs text-ink-faint">Failed / Skipped</p>
              </div>
              <div className="rounded-xl bg-paper border border-border p-4 text-center">
                <FileText size={24} className="mx-auto mb-1 text-ink-faint" />
                <p className="text-2xl font-bold text-ink">{fmt(importResult.total)}</p>
                <p className="text-xs text-ink-faint">Total rows</p>
              </div>
            </div>

            {/* Detailed Results */}
            {importResult.results.filter((r) => r.status !== 'CREATED').length > 0 && (
              <div className="max-h-60 overflow-y-auto rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Row</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Error</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importResult.results
                      .filter((r) => r.status !== 'CREATED')
                      .map((r, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-ink-faint">{r.row}</TableCell>
                          <TableCell className="font-medium text-ink">{r.employeeCode}</TableCell>
                          <TableCell>
                            <Badge variant={r.status === 'FAILED' ? 'destructive' : 'warning'}>{r.status}</Badge>
                          </TableCell>
                          <TableCell className="text-danger text-xs">{r.error || '—'}</TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="flex gap-2">
              <Link href="/employees">
                <Button>View Employees</Button>
              </Link>
              <Button variant="outline" onClick={resetAll}>
                Import another file
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
