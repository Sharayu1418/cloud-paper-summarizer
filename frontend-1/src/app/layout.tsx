'use client';

import './globals.css';
import { ToastProvider } from '@/components/ui';
import { AuthProvider } from '@/contexts/AuthContext';
import Sidebar from '@/components/layout/Sidebar';
import { usePathname } from 'next/navigation';

// Auth pages that shouldn't show the sidebar
const authPages = ['/login', '/signup', '/signup/confirm', '/auth/callback'];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const isAuthPage = authPages.some(page => pathname?.startsWith(page));

  return (
    <html lang="en">
      <head>
        <title>Scholar - Research Paper Assistant</title>
        <meta name="description" content="Upload, organize, and chat with your research papers using AI" />
      </head>
      <body className="antialiased">
        <AuthProvider>
          <ToastProvider>
            {isAuthPage ? (
              <main className="min-h-screen">{children}</main>
            ) : (
              <div className="flex h-screen bg-[var(--color-ivory)]">
                <Sidebar />
                <main className="flex-1 overflow-auto bg-white">{children}</main>
              </div>
            )}
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
