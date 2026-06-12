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
      <div className="intro-stage" aria-hidden="true">
        <span className="pixel-player">
          <span className="run-frames">
            <span className="frame frame-a" />
            <span className="frame frame-b" />
          </span>
          <span className="frame frame-kick" />
        </span>
        <span className="pixel-ball" />
        <span className="pixel-goal" />
        <span className="gol-text">GOL!</span>
      </div>
      <p className="subtitle">★ KONKURS 1 ★</p>
      <nav className="menu">
        {MENU.map((m) => (
          <Link key={m.href} className="menu-item" href={m.href}>{m.label}</Link>
        ))}
      </nav>
      <Link className="press-start" href="/tabela/">PRESS START</Link>
    </main>
  );
}
