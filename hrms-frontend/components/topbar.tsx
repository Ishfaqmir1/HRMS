'use client';

import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { LogOut } from 'lucide-react';
import { api, unwrap } from '@/lib/api-client';
import { clearSession, getRefreshToken } from '@/lib/auth';
import { Button } from '@/components/ui/button';

export function Topbar() {
  const router = useRouter();

  const { data: profile } = useQuery<{ firstName: string; lastName: string }>({
    queryKey: ['me', 'profile'],
    queryFn: () => unwrap(api.get('/me/profile')),
    retry: false,
  });

  async function handleLogout() {
    const refreshToken = getRefreshToken();
    try {
      if (refreshToken) await api.post('/auth/logout', { refreshToken });
    } catch {
      // best-effort — clear the local session regardless
    }
    clearSession();
    router.push('/login');
  }

  return (
    <header className="flex h-16 items-center justify-end border-b border-border bg-white px-8">
      <div className="flex items-center gap-4">
        {profile && (
          <span className="text-sm text-ink-soft">
            {profile.firstName} {profile.lastName}
          </span>
        )}
        <Button variant="ghost" size="sm" onClick={handleLogout}>
          <LogOut size={14} /> Sign out
        </Button>
      </div>
    </header>
  );
}
