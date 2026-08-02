'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api-client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Users, Shield, Mail, Clock, CheckCircle2, XCircle,
  Search, Plus, Trash2, ToggleLeft, ToggleRight,
} from 'lucide-react';

// ──────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────

interface PlatformRole {
  id: string;
  name: string;
  slug: string;
  systemRole: string | null;
  isSystem: boolean;
}

interface PlatformUser {
  id: string;
  email: string;
  status: string;
  isEmailVerified: boolean;
  lastLoginAt: string | null;
  mustChangePassword: boolean;
  createdAt: string;
  updatedAt: string;
  roles: PlatformRole[];
}

// ──────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function fmtRelative(iso: string | null | undefined): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function getRoleColor(role: PlatformRole): string {
  if (role.slug === 'super-admin') return 'bg-accent/10 text-accent border-accent/20';
  if (role.slug === 'auditor') return 'bg-amber/10 text-amber border-amber/20';
  return 'bg-blue/10 text-blue border-blue/20';
}

// ──────────────────────────────────────────────────────────────────
// Create User Dialog
// ──────────────────────────────────────────────────────────────────

function CreateUserDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const mutation = useMutation({
    mutationFn: (data: { email: string; password: string }) =>
      unwrap(api.post('/admin/users', data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      onClose();
      setEmail('');
      setPassword('');
    },
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users size={18} className="text-accent" />
            Create Platform User
          </DialogTitle>
          <DialogDescription>
            Create a new super admin user with platform-level access.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate({ email, password });
          }}
          className="space-y-4"
        >
          <div>
            <Label>Email Address</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              required
            />
          </div>
          <div>
            <Label>Password</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Secure password"
              required
              minLength={8}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" isLoading={mutation.isPending}>
              <Plus size={14} className="mr-1.5" />
              Create User
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ──────────────────────────────────────────────────────────────────
// Main Page
// ──────────────────────────────────────────────────────────────────

export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Fetch platform users
  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => unwrap<PlatformUser[]>(api.get('/admin/users')),
    staleTime: 15_000,
  });

  // Suspend/Activate mutation
  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'ACTIVE' | 'SUSPENDED' }) =>
      api.patch(`/admin/users/${id}/status`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });

  // Delete mutation
  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      setConfirmDelete(null);
    },
  });

  // Filter
  const filtered = users.filter((u) =>
    !search || u.email.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Users size={16} className="text-accent" />
            <span className="text-xs font-medium text-accent uppercase tracking-wider">Platform Access</span>
          </div>
          <h1 className="font-serif text-2xl font-semibold text-ink">Platform Users</h1>
          <p className="mt-1 text-sm text-ink-faint">
            Manage super admin users and their platform-level roles
          </p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus size={14} className="mr-1.5" />
          Add Platform User
        </Button>
      </div>

      {/* Search */}
      {users.length > 0 && (
        <div className="relative max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
          <Input
            placeholder="Search by email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      )}

      {/* Loading */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-accent" />
        </div>
      ) : filtered.length > 0 ? (
        /* User Cards */
        <div className="space-y-3">
          {filtered.map((user) => (
            <div
              key={user.id}
              className="group rounded-2xl border border-border/60 bg-white transition-all duration-200 hover:shadow-md hover:border-accent/20"
            >
              <div className="p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  {/* Left: User Info */}
                  <div className="flex items-start gap-4 min-w-0 flex-1">
                    {/* Avatar */}
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-accent/10">
                      <span className="text-base font-semibold text-accent">
                        {user.email[0].toUpperCase()}
                      </span>
                    </div>

                    {/* Details */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-ink">{user.email}</span>
                        <Badge
                          tone={user.status === 'ACTIVE' ? 'success' : 'danger'}
                          className="text-[10px]"
                        >
                          {user.status}
                        </Badge>
                        {user.isEmailVerified && (
                          <Badge tone="success" className="text-[9px]">Verified</Badge>
                        )}
                      </div>

                      <div className="mt-2 flex flex-wrap gap-2">
                        {user.roles.map((role) => (
                          <span
                            key={role.id}
                            className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-medium ${getRoleColor(role)}`}
                          >
                            <Shield size={10} />
                            {role.name}
                          </span>
                        ))}
                        {user.roles.length === 0 && (
                          <span className="text-[10px] text-ink-faint italic">No roles assigned</span>
                        )}
                      </div>

                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-faint">
                        <span className="flex items-center gap-1">
                          <Clock size={11} />
                          Created {fmtDate(user.createdAt)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Mail size={11} />
                          Last login: {fmtRelative(user.lastLoginAt)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {user.status === 'ACTIVE' ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-amber hover:text-amber"
                        onClick={() => statusMut.mutate({ id: user.id, status: 'SUSPENDED' })}
                        isLoading={statusMut.isPending}
                      >
                        <ToggleRight size={14} className="mr-1" />
                        Suspend
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-accent hover:text-accent"
                        onClick={() => statusMut.mutate({ id: user.id, status: 'ACTIVE' })}
                        isLoading={statusMut.isPending}
                      >
                        <ToggleLeft size={14} className="mr-1" />
                        Activate
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-danger hover:text-danger"
                      onClick={() => setConfirmDelete(user.id)}
                      isLoading={deleteMut.isPending && deleteMut.variables === user.id}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Empty State */
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border/60 py-20 text-center">
          <Users size={40} className="mb-3 text-ink-faint/40" />
          <h3 className="font-serif text-lg font-semibold text-ink">
            {search ? 'No results found' : 'No Platform Users'}
          </h3>
          <p className="mt-1 text-sm text-ink-faint max-w-md">
            {search
              ? `No users match "${search}".`
              : 'Platform users have access to the super admin dashboard. Create your first one to get started.'}
          </p>
          {search && (
            <Button variant="ghost" size="sm" className="mt-3" onClick={() => setSearch('')}>
              Clear search
            </Button>
          )}
        </div>
      )}

      {/* Create Dialog */}
      <CreateUserDialog open={showCreate} onClose={() => setShowCreate(false)} />

      {/* Confirm Delete Dialog */}
      <Dialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle size={18} className="text-danger" />
              Remove Platform User
            </DialogTitle>
            <DialogDescription>
              This will soft-delete the user. They will no longer be able to access the platform.
              This action can be reversed by a super admin.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button
              variant="destructive"
              isLoading={deleteMut.isPending}
              onClick={() => confirmDelete && deleteMut.mutate(confirmDelete)}
            >
              <Trash2 size={14} className="mr-1.5" />
              Remove User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
