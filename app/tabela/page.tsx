import { RetroTable } from '../../components/RetroTable';
import { ScreenFrame } from '../../components/ScreenFrame';
import { loadResults } from '../lib/results';

export default function TabelaPage() {
  const { general } = loadResults();
  return (
    <ScreenFrame title="TABELA OGÓLNA">
      <RetroTable rows={general} showGroup showPuch />
    </ScreenFrame>
  );
}
