'use client';

import { usePathname } from 'next/navigation';
import TopGlassNavbar from './TopGlassNavbar';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/login';

  if (isLoginPage) {
    return (
      <main className="min-h-screen w-full overflow-x-hidden">
        {children}
      </main>
    );
  }

  return (
    <div className="flex flex-col min-h-screen w-full overflow-x-hidden bg-slate-50 font-sans">
      {/* Floating Top Glass Navigation Bar */}
      <TopGlassNavbar />

      {/* Main Content Area (Full Screen Width, 0 Sidebar Lag) */}
      <main className="flex-1 w-full p-3 sm:p-4 md:p-6 lg:px-8 lg:py-6 overflow-x-hidden">
        {children}
      </main>
    </div>
  );
}
