import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Context Engine',
  description: 'Context Understanding Engine with Knowledge Graph',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
