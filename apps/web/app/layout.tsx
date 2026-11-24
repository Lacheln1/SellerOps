import type { ReactNode } from 'react';

export const metadata = { title: 'SellerOps' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
