'use client';

import { usePathname } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith('/admin');

  if (isAdmin) {
    return (
      <main className="min-h-screen flex-grow bg-gray-50/60">
        {children}
      </main>
    );
  }

  return (
    <>
      <Navbar />
      <main className="flex-grow pt-16 sm:pt-18 md:pt-20">{children}</main>
      <Footer />
    </>
  );
}
