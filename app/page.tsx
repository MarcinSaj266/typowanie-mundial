import Link from 'next/link';

const MENU = [
  { href: '/tabela/', label: 'TABELA OGÓLNA' },
  { href: '/grupy/', label: 'GRUPY A–H' },
  { href: '/mecze/', label: 'MECZE I TYPY' },
] as const;

export default function MenuPage() {
  return (
    <main className="screen title-screen intro">
      <h1 className="game-title">TYPOWANIE<br />MUNDIAL 2026</h1>
      <div className="ball-lane" aria-hidden="true">
        <span className="pixel-ball" />
      </div>
      <p className="subtitle">★ KONKURS 1 ★</p>
      <nav className="menu">
        {MENU.map((m) => (
          <Link key={m.href} className="menu-item" href={m.href}>{m.label}</Link>
        ))}
      </nav>
      <p className="press-start">PRESS START</p>
    </main>
  );
}
