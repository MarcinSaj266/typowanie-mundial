import './globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import RetroAudio from '../components/RetroAudio';

export const metadata: Metadata = {
  title: 'Typowanie Mundial 2026',
  description: 'Wyniki i tabele konkursu typowania Mistrzostw Świata 2026',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pl">
      <body>
        {children}
        <RetroAudio />
      </body>
    </html>
  );
}
