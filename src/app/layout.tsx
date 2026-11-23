import { Metadata, Viewport } from 'next';
import { DM_Sans, Plus_Jakarta_Sans } from 'next/font/google';
import { Toaster } from 'react-hot-toast';
import AppLayout from '@/components/AppLayout';
import './globals.css';

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-display',
});

export const metadata: Metadata = {
  title: 'StepStyle | Premium Footwear',
  description:
    'Premium footwear eCommerce store with mobile quick ordering, instant UPI & COD checkout, live order tracking, and curated athletic & lifestyle shoes.',
  openGraph: {
    title: 'StepStyle | Premium Footwear',
    description:
      'Premium footwear eCommerce store with mobile quick ordering, instant UPI & COD checkout, live order tracking, and curated athletic & lifestyle shoes.',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`h-full ${dmSans.variable} ${plusJakarta.variable}`}>
      <body className={`${dmSans.className} flex min-h-screen flex-col bg-white text-slate-900 antialiased`}>
        <Toaster position="top-center" />
        <AppLayout>{children}</AppLayout>
      </body>
    </html>
  );
}