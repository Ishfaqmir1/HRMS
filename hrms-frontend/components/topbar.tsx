'use client';

import { LogOut, Menu, Bell } from 'lucide-react';
import { api } from '@/lib/api-client';
import { getRefreshToken } from '@/lib/auth';
import { useAuth } from '@/lib/auth-context';
import { useAuthActions } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';

interface TopbarProps {
  onMenuClick?: () => void;
}

export function Topbar({ onMenuClick }: TopbarProps) {
  const { profile } = useAuth();
  const { signOut } = useAuthActions();

  async function handleLogout() {
    const refreshToken = getRefreshToken();
    try {
      if (refreshToken) await api.post('/auth/logout', { refreshToken });
    } catch {
      // best-effort
    }
    signOut();
  }

  return (
    <header className="topbar-glass sticky top-0 z-20 flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
      {/* Mobile hamburger */}
      <button
        onClick={onMenuClick}
        className="-ml-1 rounded-xl p-2 text-ink-soft transition-colors hover:bg-accent/5 hover:text-accent md:hidden active:scale-95"
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>

      {/* Spacer */}
      <div className="flex-1" />

      <div className="flex items-center gap-2">
        {/* Notification bell */}
        <button className="relative rounded-xl p-2 text-ink-faint transition-colors hover:bg-paper hover:text-ink-soft active:scale-95" aria-label="Notifications">
          <Bell size={18} />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-accent">
            <span className="absolute inset-0 animate-ping rounded-full bg-accent opacity-40" />
          </span>
        </button>

        {/* Profile chip */}
        {profile && (
          <div className="hidden items-center gap-2.5 rounded-xl bg-paper/80 px-3 py-1.5 sm:flex">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/10">
              <span className="text-xs font-semibold text-accent">
                {profile.firstName?.[0]}{profile.lastName?.[0]}
              </span>
            </div>
            <span className="text-sm font-medium text-ink-soft">
              {profile.firstName} {profile.lastName}
            </span>
          </div>
        )}

        <Button variant="ghost" size="sm" onClick={handleLogout} className="text-ink-faint hover:text-danger">
          <LogOut size={14} />
          <span className="hidden sm:inline">Sign out</span>
        </Button>
      </div>
    </header>
  );
}
