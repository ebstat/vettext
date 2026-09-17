# Project: VetText

Bouw een minimale Next.js-app (App Router, TypeScript) die klantgesprekken bij een
dierenartspraktijk opneemt, transcribeert met sprekerlabels, en na een instelbaar
aantal dagen automatisch verwijdert. GEEN audio-opslag — alleen tekst.

## Stack

- Next.js 15 (App Router), TypeScript
- Drizzle ORM + Neon Postgres
- Deploy target: Vercel (incl. Vercel Cron voor retentie)
- AssemblyAI voor transcriptie + diarisatie (EU-endpoint: api.eu.assemblyai.com)

## Kernflow

1. Browser: neem audio op via de Web Audio API / MediaRecorder vanaf de
   geselecteerde microfoon-input (Rode Wireless ME-ontvanger, aangesloten via USB-C —
   gedraagt zich als standaard systeem-microfoon, geen speciale driver nodig).
2. Stuur het opgenomen audiobestand naar een Next.js API-route
   (`app/api/gesprekken/route.ts`), in memory, nooit naar disk.
3. Die route stuurt de audio door naar AssemblyAI met:
   - `language_code: "nl"`
   - `speaker_labels: true`
   - (géén multichannel — dit is een mono-opname)
4. Verwerk de AssemblyAI-response (`utterances`: speaker, text, start, end, words
   met confidence) als volgt:
   a. Bereken per speaker-label (A/B) het gemiddelde RMS-volumeniveau over alle
   bijbehorende audio-fragmenten (gebruik de start/end-timestamps om het
   betreffende stukje uit de originele audiobuffer te knippen).
   b. Het label met het hoogste gemiddelde RMS = "Praktijkmedewerker"
   (draagt de zender dicht bij de mond). Het andere label = "Klant".
   c. Bouw een chronologisch geordende array:
   `{ spreker: "Praktijkmedewerker" | "Klant", tekst: string, start: number, 
eind: number }[]`
5. Gooi de audiobuffer meteen weg na stap 4 — nooit persisteren.
6. Sla alleen de array uit stap 4c op in Postgres.

## Database-schema (Drizzle)

- `gesprekken`: id (uuid), aangemaaktOp (timestamp, default now),
  klantnaam (text, optioneel/nullable)
- `regels`: id (uuid), gesprekId (fk → gesprekken.id, cascade delete),
  spreker (enum: "praktijkmedewerker" | "klant"), tekst (text),
  startSeconden (real), eindSeconden (real), volgorde (integer)

Laat ruimte voor een latere, optionele LLM-nabewerkingsstap: geen kolom nu
toevoegen, maar zorg dat een aparte tabel (bv. `bewerkingen`, gekoppeld aan
gesprekId) er later zonder migratie-pijn bij kan.

## API routes

- `POST /api/gesprekken` — ontvangt audio (multipart/form-data), voert bovenstaande
  flow uit, retourneert het nieuwe gesprek met regels.
- `GET /api/gesprekken` — lijst van gesprekken (id, datum, klantnaam, eerste regel
  als preview).
- `GET /api/gesprekken/:id` — volledig transcript van één gesprek.
- `DELETE /api/gesprekken/:id` — handmatig verwijderen (voor de zekerheid, naast
  de automatische retentie).

## Retentie

- Vercel Cron job (`vercel.json` + `app/api/cron/retentie/route.ts`), dagelijks.
- Leest `RETENTIE_DAGEN` uit env (default 30).
- Verwijdert alle `gesprekken` (en cascaderend hun `regels`) ouder dan dat aantal
  dagen.

## Frontend (minimaal, geen uitgebreide styling nodig)

- `/` — lijst van gesprekken, nieuwste eerst, met datum + korte preview.
- `/gesprekken/[id]` — volledig transcript, per regel spreker-label + tekst,
  en een "Kopieer transcript"-knop (`navigator.clipboard.writeText`, hele
  transcript als platte tekst met sprekerlabels).
- Simpele opname-pagina: microfoon selecteren, start/stop-knop, upload na stoppen.

## Env vars

- `ASSEMBLYAI_API_KEY`
- `DATABASE_URL` (Neon connection string)
- `RETENTIE_DAGEN` (default: 30)

## Expliciet BUITEN scope voor deze versie

- Geen audio-opslag, ook niet tijdelijk op disk.
- Geen automatische samenvatting of LLM-verwerking (komt evt. later als los,
  handmatig te triggeren endpoint).
- Geen multi-user/auth-systeem — ga uit van één simpele, vertrouwde praktijk-login
  of zelfs (voor nu) geen auth, tenzij je zelf iets minimaals toevoegt met
  bijvoorbeeld NextAuth.

## Vraag vooraf

Stel voor het scaffolden eerst kort de projectstructuur voor (mapindeling,
belangrijkste bestanden) voordat je begint met genereren, zodat ik kan bijsturen
voordat je code schrijft.
