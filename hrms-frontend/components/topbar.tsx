'use client';

import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { LogOut, Menu } from 'lucide-react';
import { api, unwrap } from '@/lib/api-client';
import { clearSession, getRefreshToken } from '@/lib/auth';
import { Button } from '@/components/ui/button';

interface TopbarProps {
  onMenuClick?: () => void;
}

export function Topbar({ onMenuClick }: TopbarProps) {
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
      // best-effort
    }
    clearSession();
    router.push('/login');
  }

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-white/80 px-4 backdrop-blur-md sm:px-6 lg:px-8">
      {/* Mobile hamburger */}
      <button
        onClick={onMenuClick}
        className="-ml-1 rounded-md p-2 text-ink-soft hover:bg-paper md:hidden"
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>

      {/* Spacer */}
      <div className="flex-1" />

      <div className="flex items-center gap-4">
        {profile && (
          <span className="hidden text-sm text-ink-soft sm:block">
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
