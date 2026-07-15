import type { Metadata } from 'next';
import { Fraunces, Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';
import { ErrorBoundary } from '@/components/error-boundary';

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  weight: ['500', '600'],
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'HRMS Platform — All-in-one HRMS for growing companies',
  description: 'From attendance to payroll, manage your entire workforce in one intelligent platform. Smart, secure, and built for teams of all sizes. Start your free trial today.',
  keywords: ['HRMS', 'HR platform', 'payroll', 'attendance', 'HR software', 'workforce management', 'employee management'],
  openGraph: {
    title: 'HRMS Platform — All-in-one HRMS for growing companies',
    description: 'From attendance to payroll, manage your entire workforce in one intelligent platform.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable} ${mono.variable}`}>
      <body className="font-sans antialiased">
        <ErrorBoundary>
          <Providers>{children}</Providers>
        </ErrorBoundary>
      </body>
    </html>
  );
}
