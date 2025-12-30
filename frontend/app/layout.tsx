import { Analytics } from '@vercel/analytics/react';
import { Navbar } from '@/components/Navbar';
import { ThemeProvider } from '@/components/ThemeProvider';
import type { Metadata, Viewport } from 'next';

import './globals.css';

const siteConfig = {
  name: 'Receipts',
  description:
    'Hold YouTubers accountable. Track and verify their financial predictions with AI-powered analysis.',
  url: process.env.NEXT_PUBLIC_APP_URL || 'https://receipts.app',
};

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: siteConfig.name,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  keywords: [
    'YouTuber predictions',
    'financial predictions',
    'stock market',
    'prediction accuracy',
    'accountability',
    'fact checking',
    'investment advice',
    'market analysis',
  ],
  authors: [{ name: 'sincerelyyyash', url: 'https://sincerelyyyash.com' }],
  creator: 'sincerelyyyash',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: siteConfig.url,
    title: siteConfig.name,
    description: siteConfig.description,
    siteName: siteConfig.name,
  },
  twitter: {
    card: 'summary_large_image',
    title: siteConfig.name,
    description: siteConfig.description,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'white' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
  width: 'device-width',
  initialScale: 1,
};

const RootLayout = ({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) => {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-hanken-grotesk antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <div className="relative min-h-screen flex flex-col">
            <Navbar />
            <main className="flex-1">{children}</main>
            <footer className="border-t py-6">
              <div className="container mx-auto max-w-6xl px-4 text-center text-sm text-muted-foreground">
                <p>&copy; {new Date().getFullYear()} Receipts. All rights reserved.</p>
                <p className="mt-1">
                  Built by{' '}
                  <a
                    href="https://sincerelyyyash.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-foreground hover:underline transition-colors"
                  >
                    sincerelyyyash
                  </a>
                </p>
              </div>
            </footer>
          </div>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
};

export default RootLayout;
