import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--app-font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Mesurado AI — Developer Dashboard',
    template: '%s | Mesurado AI',
  },
  description:
    'Developer API Gateway and Dashboard for Mesurado AI — built by Media Tech Liberia.',
  keywords: ['AI', 'API', 'LLM', 'Mesurado', 'Media Tech Liberia'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head />
      <body className={inter.variable}>{children}</body>
    </html>
  );
}
