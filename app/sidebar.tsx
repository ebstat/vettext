"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import type { GesprekStatus } from "@/lib/gesprekken";

export type SidebarGesprek = {
  id: string;
  tijdspanne: string;
  klantnaam: string | null;
  preview: string | null;
  status: GesprekStatus;
  foutmelding: string | null;
};

const VERVERS_INTERVAL_MS = 5000;

export default function Sidebar({ gesprekken }: { gesprekken: SidebarGesprek[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const [wordtVerwijderd, setWordtVerwijderd] = useState<string | null>(null);

  const heeftBezigGesprek = gesprekken.some((gesprek) => gesprek.status === "bezig");

  useEffect(() => {
    if (!heeftBezigGesprek) return;

    const interval = setInterval(() => router.refresh(), VERVERS_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [heeftBezigGesprek, router]);

  async function verwijderGesprek(event: React.MouseEvent, id: string, href: string) {
    event.preventDefault();
    event.stopPropagation();

    if (!window.confirm("Dit gesprek en het transcript definitief verwijderen?")) return;

    setWordtVerwijderd(id);
    try {
      const response = await fetch(`/api/gesprekken/${id}`, { method: "DELETE" });
      if (!response.ok) {
        window.alert("Verwijderen is mislukt. Probeer het opnieuw.");
        return;
      }
      if (pathname === href) router.push("/");
      router.refresh();
    } finally {
      setWordtVerwijderd(null);
    }
  }

  return (
    <nav className="sidebar">
      <div className="merk">VetText</div>

      <Link href="/opnemen" className={`nieuw-gesprek ${pathname === "/opnemen" ? "actief" : ""}`}>
        <span className="nieuw-gesprek-icoon" aria-hidden="true" />
        Nieuw gesprek
      </Link>

      {gesprekken.length === 0 ? (
        <p className="sidebar-leeg">Nog geen gesprekken opgenomen.</p>
      ) : (
        <ul>
          {gesprekken.map((gesprek) => {
            const href = `/gesprekken/${gesprek.id}`;
            return (
              <li key={gesprek.id} className={wordtVerwijderd === gesprek.id ? "wordt-verwijderd" : ""}>
                <Link href={href} className={pathname === href ? "actief" : ""}>
                  <div className="tijdspanne">{gesprek.tijdspanne}</div>
                  {gesprek.klantnaam && <div className="klantnaam">{gesprek.klantnaam}</div>}
                  {gesprek.status === "bezig" && <div className="status-bezig">Bezig met verwerken…</div>}
                  {gesprek.status === "mislukt" && (
                    <div className="status-mislukt">{gesprek.foutmelding ?? "Mislukt"}</div>
                  )}
                  {gesprek.status === "klaar" && <div className="preview">{gesprek.preview ?? "(geen tekst)"}</div>}
                </Link>
                <button
                  type="button"
                  className="verwijder-knop"
                  aria-label="Gesprek verwijderen"
                  title="Gesprek verwijderen"
                  disabled={wordtVerwijderd === gesprek.id}
                  onClick={(event) => verwijderGesprek(event, gesprek.id, href)}
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </nav>
  );
}
