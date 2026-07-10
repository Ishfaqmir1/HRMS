'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Shield, Users } from 'lucide-react';
import { api, unwrap } from '@/lib/api-client';
import { Role, Permission } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input, Label, FieldError } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

const roleSchema = z.object({
  name: z.string().min(1, 'Required'),
  slug: z.string().min(1, 'Required').regex(/^[a-z0-9-]+$/, 'Lowercase, numbers, hyphens only'),
  description: z.string().optional(),
});
type RoleForm = z.infer<typeof roleSchema>;

export default function RolesPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set());

  const { data: permissions, isLoading: permLoading } = useQuery({
    queryKey: ['permissions'],
    queryFn: () => unwrap<Record<string, Permission[]>>(api.get('/roles/permissions')),
  });

  const { data: roles, isLoading: rolesLoading } = useQuery({
    queryKey: ['roles'],
    queryFn: () => unwrap<Role[]>(api.get('/roles')),
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<RoleForm>({
    resolver: zodResolver(roleSchema),
  });

  function openCreate() {
    setSelectedRole(null);
    setSelectedPermissions(new Set());
    reset({});
    setShowForm(true);
  }

  function openEdit(role: Role) {
    setSelectedRole(role);
    setSelectedPermissions(new Set(role.rolePermissions.map((rp) => rp.permission.code)));
    reset({ name: role.name, slug: role.slug, description: role.description || '' });
    setShowForm(true);
  }

  function togglePermission(code: string) {
    const next = new Set(selectedPermissions);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    setSelectedPermissions(next);
  }

  const saveMutation = useMutation({
    mutationFn: async (values: RoleForm) => {
      const permissionCodes = Array.from(selectedPermissions);
      if (selectedRole) {
        await api.patch(`/roles/${selectedRole.id}`, values);
        await api.put(`/roles/${selectedRole.id}/permissions`, { permissionCodes });
        return { message: 'updated' };
      }
      const { data } = await api.post('/roles', {
        ...values,
        permissionCodes,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      queryClient.invalidateQueries({ queryKey: ['permissions'] });
      setShowForm(false);
      setSelectedRole(null);
      reset();
    },
  });

  const systemRoles = roles?.filter((r) => r.isSystem) || [];
  const customRoles = roles?.filter((r) => !r.isSystem) || [];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="ledger-tab font-serif text-2xl font-semibold text-ink">Roles & Permissions</h1>
        <Button onClick={openCreate}><Plus size={16} /> Create role</Button>
      </div>

      <Tabs defaultValue="system">
        <TabsList>
          <TabsTrigger value="system">System Roles</TabsTrigger>
          <TabsTrigger value="custom">Custom Roles</TabsTrigger>
        </TabsList>

        <TabsContent value="system">
          <Card>
            <CardContent className="pt-5">
              {rolesLoading && <p className="text-sm text-ink-faint">Loading roles…</p>}
              {systemRoles.length > 0 && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {systemRoles.map((role) => (
                    <div key={role.id} className="rounded-lg border border-border p-4 hover:shadow-sm transition-shadow">
                      <div className="flex items-center gap-2 mb-3">
                        <Shield size={16} className="text-accent" />
                        <p className="font-medium text-ink">{role.name}</p>
                        <Badge variant="secondary">System</Badge>
                      </div>
                      <p className="text-xs text-ink-faint mb-2">{role.slug}</p>
                      <p className="text-xs text-ink-soft">
                        {role.rolePermissions.length} permissions
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="custom">
          <Card>
            <CardContent className="pt-5">
              {customRoles.length === 0 ? (
                <p className="text-sm text-ink-faint py-4">No custom roles created yet.</p>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {customRoles.map((role) => (
                    <div
                      key={role.id}
                      className="rounded-lg border border-border p-4 hover:shadow-sm transition-shadow cursor-pointer"
                      onClick={() => openEdit(role)}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Users size={16} className="text-accent" />
                        <p className="font-medium text-ink">{role.name}</p>
                      </div>
                      <p className="text-xs text-ink-faint mb-2">{role.description || 'No description'}</p>
                      <p className="text-xs text-ink-soft">{role.rolePermissions.length} permissions</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create / Edit Role Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedRole ? `Edit: ${selectedRole.name}` : 'Create Custom Role'}</DialogTitle>
            <DialogDescription>Define the role name and its granular permissions.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit((values) => saveMutation.mutate(values))} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Role name</Label>
                <Input id="name" placeholder="Regional HR Lead" {...register('name')} />
                <FieldError message={errors.name?.message} />
              </div>
              <div>
                <Label htmlFor="slug">Slug</Label>
                <Input id="slug" placeholder="regional-hr-lead" {...register('slug')} />
                <FieldError message={errors.slug?.message} />
              </div>
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Input id="description" placeholder="Optional description" {...register('description')} />
            </div>

            <div className="border-t pt-4">
              <p className="text-sm font-medium text-ink mb-3">Permissions</p>
              {permLoading && <p className="text-sm text-ink-faint">Loading permissions…</p>}
              {permissions && Object.entries(permissions).map(([module, perms]) => (
                <details key={module} className="mb-2">
                  <summary className="cursor-pointer text-sm font-medium text-ink capitalize hover:text-accent">
                    {module} ({perms.length})
                  </summary>
                  <div className="mt-1 ml-2 flex flex-wrap gap-2">
                    {perms.map((perm) => (
                      <label
                        key={perm.id}
                        className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs cursor-pointer transition-colors ${
                          selectedPermissions.has(perm.code)
                            ? 'border-accent bg-accent-soft text-accent'
                            : 'border-border text-ink-faint hover:border-ink-faint'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedPermissions.has(perm.code)}
                          onChange={() => togglePermission(perm.code)}
                          className="sr-only"
                        />
                        {perm.action}
                      </label>
                    ))}
                  </div>
                </details>
              ))}
            </div>

            {saveMutation.isError && (
              <p className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
                {(saveMutation.error as any)?.response?.data?.message || 'Could not save role.'}
              </p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit" isLoading={saveMutation.isPending}>
                {selectedRole ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
