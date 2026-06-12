'use client';

// Dźwięk apki (jedyny klientowy komponent):
// - muzyka w tle, domyślnie WŁĄCZONA — przeglądarki blokują autoplay z dźwiękiem,
//   więc gdy blokada zadziała, start następuje przy pierwszym geście użytkownika;
// - 8-bitowe „blipy" (WebAudio, fala kwadratowa) przy kliknięciu w link/przycisk/summary.
// Komponent żyje w layoucie: nawigacja App Routera go nie remontuje, muzyka gra dalej.
// Przycisk ♪ steruje TYLKO muzyką — dźwięk klikania gra zawsze (decyzja użytkownika).
import { useEffect, useRef, useState } from 'react';

export default function RetroAudio() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const muzykaRef = useRef(true);
  const [muzyka, setMuzyka] = useState(true);

  useEffect(() => {
    const audio = new Audio('/audio/full-time-glory.mp3');
    audio.loop = true;
    audio.volume = 0.55;
    audioRef.current = audio;

    const startNaGest = () => {
      if (muzykaRef.current) audio.play().catch(() => {});
      window.removeEventListener('pointerdown', startNaGest);
      window.removeEventListener('keydown', startNaGest);
    };
    audio.play().catch(() => {
      window.addEventListener('pointerdown', startNaGest);
      window.addEventListener('keydown', startNaGest);
    });

    return () => {
      window.removeEventListener('pointerdown', startNaGest);
      window.removeEventListener('keydown', startNaGest);
      audio.pause();
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    const blip = (e: MouseEvent) => {
      // Blip gra niezależnie od stanu muzyki.
      if (!(e.target instanceof Element) || !e.target.closest('a, button, summary')) return;
      const ctx = (ctxRef.current ??= new AudioContext());
      if (ctx.state === 'suspended') void ctx.resume();
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(660, t);
      osc.frequency.setValueAtTime(990, t + 0.045);
      gain.gain.setValueAtTime(0.22, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.09);
    };
    window.addEventListener('click', blip, true);
    return () => window.removeEventListener('click', blip, true);
  }, []);

  function przelacz() {
    const nast = !muzyka;
    setMuzyka(nast);
    muzykaRef.current = nast;
    if (nast) audioRef.current?.play().catch(() => {});
    else audioRef.current?.pause();
  }

  return (
    <button
      type="button"
      className="music-toggle"
      aria-pressed={muzyka}
      aria-label={muzyka ? 'Wyłącz muzykę' : 'Włącz muzykę'}
      onClick={przelacz}
    >
      ♪ {muzyka ? 'ON' : 'OFF'}
    </button>
  );
}
