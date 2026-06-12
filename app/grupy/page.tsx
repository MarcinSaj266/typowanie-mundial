import { RetroTable } from '../../components/RetroTable';
import { ScreenFrame } from '../../components/ScreenFrame';
import { loadResults } from '../lib/results';

const GROUPS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const;

export default function GrupyPage() {
  const { groups } = loadResults();
  return (
    <ScreenFrame title="GRUPY A–H">
      <nav className="group-nav">
        {GROUPS.map((g) => <a key={g} href={`#${g}`}>{g}</a>)}
      </nav>
      {GROUPS.map((g) => (
        <section key={g} id={g} className="group-section">
          <h2 className="group-heading">★ GRUPA {g} ★</h2>
          <RetroTable rows={groups[g]} />
        </section>
      ))}
    </ScreenFrame>
  );
}
