'use client';

import { usePathname } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import MobileBottomNav from '@/components/MobileBottomNav';
import { QuickOrderProvider } from '@/components/QuickOrderContext';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith('/admin');

  if (isAdmin) {
    return (
      <main className="min-h-screen flex-grow bg-slate-50 !pt-0">
        {children}
      </main>
    );
  }

  return (
    <QuickOrderProvider>
      <Navbar />
      <main className="flex-grow pt-14 sm:pt-16 md:pt-20">{children}</main>
      <Footer />
      <MobileBottomNav />
    </QuickOrderProvider>
  );
}
