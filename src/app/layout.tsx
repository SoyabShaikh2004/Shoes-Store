import { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from 'react-hot-toast';
import AppLayout from '@/components/AppLayout';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'StepStyle | Premium Footwear',
  description:
    'Premium footwear eCommerce store with full-featured admin panel, image uploading, MRP pricing management, and inventory customization',
  openGraph: {
    title: 'StepStyle | Premium Footwear',
    description:
      'Premium footwear eCommerce store with full-featured admin panel, image uploading, MRP pricing management, and inventory customization',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className={`${inter.className} flex min-h-screen flex-col`}>
        <Toaster position="top-center" />
        <AppLayout>{children}</AppLayout>
      </body>
    </html>
  );
} 