'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import { Sidebar } from '@/components/sidebar';
import { Topbar } from '@/components/topbar';
import { MobileNav } from '@/components/mobile-nav';
import { X } from 'lucide-react';

const BOTTOM_NAV_PATHS = ['/dashboard', '/attendance', '/leave', '/employees', '/ess'];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checked, setChecked] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/login');
    } else {
      setChecked(true);
    }
  }, [router]);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [sidebarOpen]);

  const showBottomNav = BOTTOM_NAV_PATHS.some((p) => pathname === p || pathname?.startsWith(p + '/'));

  if (!checked) return null;

  return (
    <div className="relative min-h-screen bg-paper">
      {/* Desktop sidebar — always visible on md+ */}
      <div className="hidden md:fixed md:inset-y-0 md:flex md:w-60">
        <Sidebar />
      </div>

      {/* Mobile drawer — overlay on small screens */}
      {sidebarOpen && (
        <div
          className="drawer-backdrop fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-300 ease-out md:hidden ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Sidebar />
        <button
          onClick={() => setSidebarOpen(false)}
          className="absolute right-3 top-5 rounded-md p-1 text-white/60 hover:text-white"
        >
          <X size={20} />
        </button>
      </div>

      {/* Main content area */}
      <div className="flex min-h-screen flex-col md:pl-60">
        <Topbar onMenuClick={() => setSidebarOpen(true)} />

        <main className="page-enter flex-1 px-4 pb-24 pt-6 sm:px-6 lg:px-8">
          {children}
        </main>

        {/* Mobile bottom navigation */}
        {showBottomNav && (
          <div className="fixed bottom-0 left-0 right-0 z-30 md:hidden">
            <MobileNav currentPath={pathname} />
          </div>
        )}
      </div>
    </div>
  );
}
