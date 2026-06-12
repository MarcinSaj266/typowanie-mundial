'use client';

// Jedyny klientowy komponent apki: włącznik muzyki (autoplay blokują przeglądarki,
// więc dźwięk zawsze startuje z gestu użytkownika). Żyje w layoucie, więc przy
// nawigacji App Routera nie jest remontowany i muzyka gra dalej między widokami.
import { useRef, useState } from 'react';

export default function MusicToggle() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [gra, setGra] = useState(false);

  function przelacz() {
    let audio = audioRef.current;
    if (!audio) {
      audio = new Audio('/audio/full-time-glory.mp3');
      audio.loop = true;
      audioRef.current = audio;
    }
    if (gra) {
      audio.pause();
      setGra(false);
    } else {
      setGra(true);
      audio.play().catch(() => setGra(false));
    }
  }

  return (
    <button
      type="button"
      className="music-toggle"
      aria-pressed={gra}
      aria-label={gra ? 'Wyłącz muzykę' : 'Włącz muzykę'}
      onClick={przelacz}
    >
      ♪ {gra ? 'ON' : 'OFF'}
    </button>
  );
}
