import type {Metadata} from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { FirebaseClientProvider } from '@/firebase/client-provider';

export const metadata: Metadata = {
  title: {
    template: '%s | Stokify',
    default: 'Stokify - Modern Inventory Management',
  },
  description: 'Manage your crop inventory with ease. Track batches, storage locations, customers, and transactions all in one place.',
  metadataBase: new URL('https://stokify.app'), // Replace with your actual domain
  openGraph: {
    title: 'Stokify - Modern Inventory Management',
    description: 'Manage your crop inventory with ease. Track batches, storage locations, customers, and transactions all in one place.',
    url: 'https://stokify.app', // Replace with your actual domain
    siteName: 'Stokify',
    images: [
      {
        url: '/og-image.png', // It's good practice to have a dedicated social sharing image
        width: 1200,
        height: 630,
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Stokify - Modern Inventory Management',
    description: 'Manage your crop inventory with ease. Track batches, storage locations, customers, and transactions all in one place.',
    creator: '@yourtwitterhandle', // Replace with your Twitter handle
    images: ['/twitter-image.png'], // It's good practice to have a dedicated Twitter image
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=PT+Sans:ital,wght@0,400;0,700;1,400;1,700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased">
        <FirebaseClientProvider>
          {children}
        </FirebaseClientProvider>
        <Toaster />
      </body>
    </html>
  );
}
