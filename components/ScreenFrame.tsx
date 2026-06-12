import Link from 'next/link';
import type { ReactNode } from 'react';

/** Rama ekranu: żółta ramka + czarny pasek tytułu + przycisk „◀ MENU" (wariant B makiety). */
export function ScreenFrame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="screen">
      <div className="frame">
        <header className="title-bar">
          <Link href="/" className="menu-btn">◀ MENU</Link>
          <h1>★ {title} ★</h1>
        </header>
        <div className="screen-body">{children}</div>
      </div>
    </main>
  );
}
