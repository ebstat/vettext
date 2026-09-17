import { notFound } from "next/navigation";

import type { Regel } from "@/db/schema";
import { formatDatumTijdspanne } from "@/lib/datum";
import { haalGesprekMetRegelsOp } from "@/lib/gesprekken";

import KopieerKnop from "./kopieer-knop";

export const dynamic = "force-dynamic";

const LABEL_PER_SPREKER: Record<Regel["spreker"], string> = {
  praktijkmedewerker: "Praktijkmedewerker",
  klant: "Klant",
};

export default async function GesprekPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gesprek = await haalGesprekMetRegelsOp(id);
  if (!gesprek) notFound();

  const header = (
    <header className="gesprek-header">
      <div>
        <h1>{formatDatumTijdspanne(gesprek.gestartOp, gesprek.beeindigdOp)}</h1>
        {gesprek.klantnaam && <span className="klant-badge">{gesprek.klantnaam}</span>}
      </div>
    </header>
  );

  if (gesprek.status === "bezig") {
    return (
      <main>
        {header}
        <div className="statuskaart">
          <p className="status-bezig">Transcriptie wordt verwerkt…</p>
          <p className="statuskaart-toelichting">
            Dit kan bij langere opnames een paar minuten duren. Je kunt dit venster gerust sluiten of naar een ander
            gesprek gaan — de verwerking gaat op de achtergrond door.
          </p>
        </div>
      </main>
    );
  }

  if (gesprek.status === "mislukt") {
    return (
      <main>
        {header}
        <div className="statuskaart">
          <p className="status-mislukt" role="alert">
            {gesprek.foutmelding}
          </p>
        </div>
      </main>
    );
  }

  const platteTekst = gesprek.regels
    .map((regel) => `${LABEL_PER_SPREKER[regel.spreker]}: ${regel.tekst}`)
    .join("\n");

  return (
    <main>
      {header}

      <div className="transcript-acties">
        <KopieerKnop tekst={platteTekst} />
      </div>

      <div className="transcript">
        {gesprek.regels.map((regel) => (
          <div key={regel.id} className={`regel regel--${regel.spreker}`}>
            <div className="regel-avatar" aria-hidden="true">
              {LABEL_PER_SPREKER[regel.spreker].charAt(0)}
            </div>
            <div className="regel-inhoud">
              <div className="regel-spreker">{LABEL_PER_SPREKER[regel.spreker]}</div>
              <div className="regel-tekst">{regel.tekst}</div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
