import type { ReactNode } from 'react';
import './globals.css';

export const metadata = {
  title: 'Stellar Ledger Tax',
  description: 'Accounting export, not tax advice.',
};

/** Root layout for the app. */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
