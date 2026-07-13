'use client';

import { useEffect, useState, useCallback, useRef, lazy, Suspense } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { X } from 'lucide-react';

// Dynamically import heavy layout components so they don't block the initial bundle
const Sidebar = lazy(() => import('@/components/sidebar').then(m => ({ default: m.Sidebar })));
const Topbar = lazy(() => import('@/components/topbar').then(m => ({ default: m.Topbar })));
const MobileNav = lazy(() => import('@/components/mobile-nav').then(m => ({ default: m.MobileNav })));
const ProtectedRoute = lazy(() => import('@/components/route-guard').then(m => ({ default: m.ProtectedRoute })));

// Minimal fallback while layout chunks load — avoids layout shift
function LayoutFallback({ children }: { children: React.ReactNode }) {
  return <main className="flex-1 px-4 pb-24 pt-5 md:pb-8 sm:px-6 sm:pt-6 lg:px-8">{children}</main>;
}

const BOTTOM_NAV_PATHS = ['/dashboard', '/attendance', '/leave', '/employees', '/ess'];
const SWIPE_THRESHOLD = 80;

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isLoaded, isAuthenticated } = useAuth();
  const [checked, setChecked] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  useEffect(() => {
    if (isLoaded && !isAuthenticated) {
      router.replace('/login');
    } else if (isLoaded && isAuthenticated) {
      setChecked(true);
    }
  }, [isLoaded, isAuthenticated, router]);

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

  // Swipe-to-close gesture handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const deltaX = e.touches[0].clientX - touchStartX.current;
    const deltaY = Math.abs(e.touches[0].clientY - touchStartY.current);

    // Only track horizontal swipes (ignore vertical scrolling)
    if (deltaX < 0 && deltaY < 30) {
      setIsDragging(true);
      setDragOffset(Math.max(deltaX, -290));
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (isDragging) {
      if (dragOffset < -SWIPE_THRESHOLD) {
        setSidebarOpen(false);
      }
      setIsDragging(false);
      setDragOffset(0);
    }
  }, [isDragging, dragOffset]);

  const showBottomNav = BOTTOM_NAV_PATHS.some((p) => pathname === p || pathname?.startsWith(p + '/'));

  if (!checked) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-paper">
        <div className="flex flex-col items-center gap-3">
          <h1 className="sr-only">Loading</h1>
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-accent" />
          <p className="text-sm text-gray-700">Loading...</p>
        </div>
      </main>
    );
  }

  return (
    <div className="relative min-h-screen bg-paper">
      {/* Desktop sidebar — always visible on md+ */}
      <div className="hidden md:fixed md:inset-y-0 md:flex md:w-60 md:h-screen">
        <Suspense fallback={<div className="h-screen w-60 animate-pulse bg-gray-50" />}>
          <Sidebar />
        </Suspense>
      </div>

      {/* Mobile drawer backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300 md:hidden ${
          sidebarOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        style={isDragging ? { opacity: Math.min(Math.abs(dragOffset) / 290, 0.5) } : undefined}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Mobile sidebar drawer */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-72 will-change-transform md:hidden ${
          isDragging ? '' : 'transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]'
        }`}
        style={{
          transform: sidebarOpen
            ? `translateX(${isDragging ? dragOffset : 0}px)`
            : 'translateX(-100%)',
        }}
        onTouchStart={sidebarOpen ? handleTouchStart : undefined}
        onTouchMove={sidebarOpen ? handleTouchMove : undefined}
        onTouchEnd={sidebarOpen ? handleTouchEnd : undefined}
      >
        {/* Swipe handle indicator */}
        <div className="absolute right-0 top-0 z-10 flex h-full w-1 items-center justify-center md:hidden">
          <div className="h-12 w-1 rounded-full bg-white/20" />
        </div>

        <Suspense fallback={<div className="h-full w-72 animate-pulse bg-white" />}>
          <Sidebar />
        </Suspense>

        {/* Close button */}
        <button
          onClick={() => setSidebarOpen(false)}
          className="absolute right-3 top-4 z-10 rounded-lg bg-gray-100 p-2 text-gray-500 transition-all duration-150 hover:bg-gray-200 hover:text-gray-700 active:scale-90"
          aria-label="Close menu"
        >
          <X size={18} />
        </button>
      </div>

      {/* Main content area */}
      <div className="flex min-h-screen flex-col md:pl-60">
        <Suspense fallback={<div className="h-16 animate-pulse bg-white/80" />}>
          <Topbar onMenuClick={() => setSidebarOpen(true)} />
        </Suspense>

        <main className="page-enter flex-1 px-4 pb-24 pt-5 md:pb-8 sm:px-6 sm:pt-6 lg:px-8">
          {/* ProtectedRoute has its own Suspense with an empty fallback to avoid
              rendering children before the guard validates permissions */}
          <Suspense fallback={<LayoutFallback>{children}</LayoutFallback>}>
            <ProtectedRoute>
              {children}
            </ProtectedRoute>
          </Suspense>
        </main>

        {/* Mobile bottom navigation */}
        {showBottomNav && (
          <div className="fixed bottom-0 left-0 right-0 z-30 md:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
            <Suspense fallback={null}>
              <MobileNav currentPath={pathname} />
            </Suspense>
          </div>
        )}
      </div>
    </div>
  );
}
