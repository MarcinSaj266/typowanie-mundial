'use client';

// PRESS START: turla piłeczkę na ekranie tytułowym (restart animacji CSS).
export default function PressStart() {
  function turlaj() {
    const pilka = document.querySelector<HTMLElement>('.pixel-ball');
    if (!pilka) return;
    pilka.style.animation = 'none';
    void pilka.offsetWidth; // wymusza reflow, żeby przeglądarka zrestartowała animację
    pilka.style.animation = '';
  }

  return (
    <button type="button" className="press-start" onClick={turlaj}>
      PRESS START
    </button>
  );
}
