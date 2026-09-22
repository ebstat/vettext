"use client";

import { useState } from "react";

export default function KopieerKnop({ tekst, label = "Kopieer transcript" }: { tekst: string; label?: string }) {
  const [gekopieerd, setGekopieerd] = useState(false);

  async function kopieer() {
    await navigator.clipboard.writeText(tekst);
    setGekopieerd(true);
    setTimeout(() => setGekopieerd(false), 2000);
  }

  return (
    <button className={`knop-secundair ${gekopieerd ? "gekopieerd" : ""}`} onClick={kopieer}>
      {gekopieerd ? "✓ Gekopieerd" : label}
    </button>
  );
}
