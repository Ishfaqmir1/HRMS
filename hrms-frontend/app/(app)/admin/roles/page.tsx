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
  Shield, Users, Plus, Pencil, Trash2, Check, X, Search,
} from 'lucide-react';

// ──────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────

interface Permission {
  id: string;
  code: string;
  module: string;
  action: string;
  description: string | null;
}

interface PlatformRole {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  systemRole: string | null;
  isSystem: boolean;
  companyId: string | null;
  createdAt: string;
  updatedAt: string;
  rolePermissions: Array<{ id: string; permission: Permission }>;
  _count: { userRoles: number };
}

interface PermissionsMap {
  [module: string]: Permission[];
}

// ──────────────────────────────────────────────────────────────────
// Role Detail Dialog
// ──────────────────────────────────────────────────────────────────

function RoleDetailDialog({
  role, open, onClose, onEdit,
}: {
  role: PlatformRole | null;
  open: boolean;
  onClose: () => void;
  onEdit: (role: PlatformRole) => void;
}) {
  if (!role) return null;

  const grouped: Record<string, Permission[]> = {};
  for (const rp of role.rolePermissions) {
    const p = rp.permission;
    grouped[p.module] = grouped[p.module] || [];
    grouped[p.module].push(p);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2">
                <Shield size={18} className="text-accent" />
                {role.name}
              </DialogTitle>
              <DialogDescription>
                {role.slug} · {role._count.userRoles} user(s) assigned
              </DialogDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => { onEdit(role); onClose(); }}>
              <Pencil size={12} className="mr-1" /> Edit
            </Button>
          </div>
        </DialogHeader>
        {role.description && (
          <p className="text-sm text-ink-soft -mt-2">{role.description}</p>
        )}
        <div className="space-y-4 mt-4">
          {Object.entries(grouped).map(([module, permissions]) => (
            <div key={module}>
              <p className="text-xs font-semibold text-ink-faint uppercase tracking-wider mb-2">
                {module} ({permissions.length})
              </p>
              <div className="flex flex-wrap gap-2">
                {permissions.map((p) => (
                  <span
                    key={p.id}
                    className="inline-flex items-center gap-1 rounded-md border border-accent/20 bg-accent/5 px-2.5 py-1 text-xs text-accent"
                  >
                    <Check size={10} className="flex-shrink-0" />
                    {p.action}
                  </span>
                ))}
              </div>
            </div>
          ))}
          {role.rolePermissions.length === 0 && (
            <p className="text-sm text-ink-faint italic">No permissions assigned.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ──────────────────────────────────────────────────────────────────
// Role Editor Dialog
// ──────────────────────────────────────────────────────────────────

function RoleEditorDialog({
  open, onClose, role, allPermissions,
}: {
  open: boolean;
  onClose: () => void;
  role: PlatformRole | null;
  allPermissions: PermissionsMap;
}) {
  const queryClient = useQueryClient();
  const isEdit = !!role;
  const [name, setName] = useState(role?.name || '');
  const [slug, setSlug] = useState(role?.slug || '');
  const [description, setDescription] = useState(role?.description || '');
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(
    new Set(role?.rolePermissions.map((rp) => rp.permission.code) || []),
  );

  const saveMut = useMutation({
    mutationFn: async () => {
      const permissionCodes = Array.from(selectedCodes);
      if (role) {
        await api.patch(`/admin/roles/${role.id}`, { name, description });
        await api.put(`/admin/roles/${role.id}/permissions`, { permissionCodes });
        return;
      }
      return api.post('/admin/roles', { name, slug, description, permissionCodes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'roles'] });
      onClose();
    },
  });

  function togglePermission(code: string) {
    const next = new Set(selectedCodes);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    setSelectedCodes(next);
  }

  // Auto-generate slug from name
  function handleNameChange(val: string) {
    setName(val);
    if (!role) {
      setSlug(val.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/--+/g, '-').replace(/^-|-$/g, ''));
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield size={18} className="text-accent" />
            {isEdit ? `Edit: ${role.name}` : 'Create Platform Role'}
          </DialogTitle>
          <DialogDescription>
            {isEdit ? 'Update the role name, description, and permissions.' : 'Define a new platform-level role and assign permissions.'}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => { e.preventDefault(); saveMut.mutate(); }}
          className="space-y-5"
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Role Name</Label>
              <Input value={name} onChange={(e) => handleNameChange(e.target.value)} placeholder="e.g. Auditor" required />
            </div>
            <div>
              <Label>Slug</Label>
              <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="auditor" required disabled={isEdit} />
            </div>
          </div>
          <div>
            <Label>Description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description" />
          </div>

          <div className="border-t border-border pt-4">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold text-ink">Permissions</p>
              <span className="text-xs text-ink-faint">{selectedCodes.size} selected</span>
            </div>

            {Object.entries(allPermissions).map(([module, permissions]) => (
              <details key={module} className="mb-3">
                <summary className="cursor-pointer text-xs font-semibold text-ink-faint uppercase tracking-wider hover:text-accent transition-colors">
                  {module} ({permissions.length})
                </summary>
                <div className="mt-2 ml-1 flex flex-wrap gap-1.5">
                  {permissions.map((perm) => {
                    const isSelected = selectedCodes.has(perm.code);
                    return (
                      <button
                        key={perm.id}
                        type="button"
                        onClick={() => togglePermission(perm.code)}
                        className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-all ${
                          isSelected
                            ? 'border-accent bg-accent/5 text-accent shadow-sm'
                            : 'border-border/60 text-ink-faint hover:border-ink-faint/40 hover:bg-paper'
                        }`}
                      >
                        {isSelected ? (
                          <Check size={10} className="flex-shrink-0" />
                        ) : (
                          <X size={10} className="flex-shrink-0 text-ink-faint/40" />
                        )}
                        {perm.action}
                      </button>
                    );
                  })}
                </div>
              </details>
            ))}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" isLoading={saveMut.isPending}>
              {isEdit ? 'Save Changes' : 'Create Role'}
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

export default function AdminRolesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedRole, setSelectedRole] = useState<PlatformRole | null>(null);
  const [detailRole, setDetailRole] = useState<PlatformRole | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<PlatformRole | null>(null);

  // Fetch platform roles
  const { data: roles = [], isLoading } = useQuery({
    queryKey: ['admin', 'roles'],
    queryFn: () => unwrap<PlatformRole[]>(api.get('/admin/roles')),
    staleTime: 30_000,
  });

  // Fetch all permissions
  const { data: permissions = {} } = useQuery({
    queryKey: ['admin', 'role-permissions'],
    queryFn: () => unwrap<PermissionsMap>(api.get('/admin/roles/permissions')),
    staleTime: 60_000,
  });

  // Delete mutation
  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/roles/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'roles'] });
      setConfirmDelete(null);
    },
  });

  // Filter
  const filtered = roles.filter((r) =>
    !search || r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.slug.toLowerCase().includes(search.toLowerCase()),
  );

  function openCreate() {
    setSelectedRole(null);
    setEditorOpen(true);
  }

  function openEdit(role: PlatformRole) {
    setSelectedRole(role);
    setEditorOpen(true);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Shield size={16} className="text-accent" />
            <span className="text-xs font-medium text-accent uppercase tracking-wider">Access Control</span>
          </div>
          <h1 className="font-serif text-2xl font-semibold text-ink">Platform Roles</h1>
          <p className="mt-1 text-sm text-ink-faint">
            Manage system-level roles and their permissions for platform users
          </p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus size={14} className="mr-1.5" />
          Create Role
        </Button>
      </div>

      {/* Search */}
      {roles.length > 0 && (
        <div className="relative max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
          <Input
            placeholder="Search by name or slug..."
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
        /* Role Cards Grid */
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((role) => {
            const permCount = role.rolePermissions.length;
            const userCount = role._count.userRoles;
            return (
              <div
                key={role.id}
                className="group relative flex flex-col rounded-2xl border border-border/60 bg-white transition-all duration-200 hover:shadow-md hover:border-accent/20"
              >
                {/* Card Body */}
                <div
                  className="flex-1 p-5 cursor-pointer"
                  onClick={() => setDetailRole(role)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/5">
                        <Shield size={18} className="text-accent" />
                      </div>
                      <div>
                        <h3 className="font-serif text-base font-semibold text-ink">{role.name}</h3>
                        <span className="text-[10px] font-mono text-ink-faint">{role.slug}</span>
                      </div>
                    </div>
                    <Badge tone="default" className="text-[9px]">
                      {role.systemRole || 'Custom'}
                    </Badge>
                  </div>

                  {role.description && (
                    <p className="mt-3 text-xs text-ink-soft line-clamp-2">{role.description}</p>
                  )}

                  {/* Stats */}
                  <div className="mt-4 flex items-center gap-4 text-xs text-ink-faint">
                    <span className="flex items-center gap-1">
                      <Shield size={11} /> {permCount} permission{permCount !== 1 ? 's' : ''}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users size={11} /> {userCount} user{userCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-1.5 border-t border-border/40 px-5 py-2.5">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs"
                    onClick={(e) => { e.stopPropagation(); openEdit(role); }}
                  >
                    <Pencil size={12} className="mr-1" /> Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs text-danger hover:text-danger"
                    onClick={(e) => { e.stopPropagation(); setConfirmDelete(role); }}
                    isLoading={deleteMut.isPending && deleteMut.variables === role.id}
                  >
                    <Trash2 size={12} className="mr-1" /> Delete
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Empty State */
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border/60 py-20 text-center">
          <Shield size={40} className="mb-3 text-ink-faint/40" />
          <h3 className="font-serif text-lg font-semibold text-ink">
            {search ? 'No roles found' : 'No Platform Roles'}
          </h3>
          <p className="mt-1 text-sm text-ink-faint max-w-md">
            {search
              ? `No roles match "${search}".`
              : 'Platform roles define what actions users can perform. Create your first role to get started.'}
          </p>
          {search && (
            <Button variant="ghost" size="sm" className="mt-3" onClick={() => setSearch('')}>
              Clear search
            </Button>
          )}
        </div>
      )}

      {/* Detail Dialog */}
      <RoleDetailDialog
        role={detailRole}
        open={!!detailRole}
        onClose={() => setDetailRole(null)}
        onEdit={(r) => { setDetailRole(null); setTimeout(() => openEdit(r), 100); }}
      />

      {/* Editor Dialog */}
      <RoleEditorDialog
        open={editorOpen}
        onClose={() => { setEditorOpen(false); setSelectedRole(null); }}
        role={selectedRole}
        allPermissions={permissions}
      />

      {/* Confirm Delete Dialog */}
      <Dialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 size={18} className="text-danger" />
              Delete &ldquo;{confirmDelete?.name}&rdquo;
            </DialogTitle>
            <DialogDescription>
              {confirmDelete && confirmDelete._count.userRoles > 0
                ? `This role is assigned to ${confirmDelete._count.userRoles} user(s). You must revoke all assignments before deleting.`
                : 'Are you sure you want to delete this role? This action cannot be undone.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button
              variant="destructive"
              isLoading={deleteMut.isPending}
              disabled={confirmDelete ? confirmDelete._count.userRoles > 0 : false}
              onClick={() => confirmDelete && deleteMut.mutate(confirmDelete.id)}
            >
              <Trash2 size={14} className="mr-1.5" />
              Delete Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
