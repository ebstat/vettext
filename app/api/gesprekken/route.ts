import { del, get } from "@vercel/blob";

import { db } from "@/db";
import { gesprekken } from "@/db/schema";
import { dienTranscriptieIn, uploadAudio } from "@/lib/assemblyai";
import { berekenVolumeProfiel } from "@/lib/audio";
import { haalGesprekkenLijstOp } from "@/lib/gesprekken";

// Vercel's default function-timeout is 30s op het Hobby-plan zonder deze instelling.
// Het decoderen (ffmpeg) en uploaden van een langere opname kan daar overheen gaan.
export const maxDuration = 300;

function appUrl(): string {
  const url = process.env.APP_URL;
  if (!url) throw new Error("APP_URL ontbreekt (nodig voor de AssemblyAI-webhook)");
  const zonderSlash = url.replace(/\/$/, "");
  // APP_URL wordt vaak zonder protocol ingevuld (bv. naar analogie van Vercel's eigen
  // VERCEL_URL, die ook altijd zonder "https://" is) — vul dat dan automatisch aan.
  return /^https?:\/\//.test(zonderSlash) ? zonderSlash : `https://${zonderSlash}`;
}

function webhookSecret(): string {
  const secret = process.env.ASSEMBLYAI_WEBHOOK_SECRET;
  if (!secret) throw new Error("ASSEMBLYAI_WEBHOOK_SECRET ontbreekt");
  return secret;
}

type GesprekBody = {
  blobUrl?: string;
  klantnaam?: string;
  gestartOp?: string;
  beeindigdOp?: string;
};

export async function POST(request: Request) {
  const begin = Date.now();
  let blobUrl: string | undefined;

  try {
    const body = (await request.json()) as GesprekBody;
    blobUrl = body.blobUrl;

    if (!blobUrl) {
      return Response.json({ error: "blobUrl ontbreekt" }, { status: 400 });
    }

    if (typeof body.gestartOp !== "string" || typeof body.beeindigdOp !== "string") {
      return Response.json({ error: "gestartOp/beeindigdOp ontbreken" }, { status: 400 });
    }

    const gestartOp = new Date(body.gestartOp);
    const beeindigdOp = new Date(body.beeindigdOp);
    if (Number.isNaN(gestartOp.getTime()) || Number.isNaN(beeindigdOp.getTime())) {
      return Response.json({ error: "gestartOp/beeindigdOp zijn geen geldige datums" }, { status: 400 });
    }

    const duurSeconden = Math.round((beeindigdOp.getTime() - gestartOp.getTime()) / 1000);
    console.log(`[gesprekken] audio ophalen van Blob, opnameduur ~${duurSeconden}s`);

    // De browser heeft de opname al rechtstreeks naar Vercel Blob geupload (zie
    // app/api/gesprekken/upload-url) — dat omzeilt de harde 4,5MB-limiet op de
    // request-body van een Vercel Function. De blob is private, dus we lezen 'm
    // hier terug met de SDK (geauthenticeerd) i.p.v. een kale fetch() op de URL.
    const blobResultaat = await get(blobUrl, { access: "private" });
    if (!blobResultaat || blobResultaat.statusCode !== 200 || !blobResultaat.stream) {
      throw new Error(`Opname ophalen van Blob mislukt (status ${blobResultaat?.statusCode ?? "onbekend"})`);
    }
    const audioBuffer = Buffer.from(await new Response(blobResultaat.stream).arrayBuffer());
    console.log(`[gesprekken] audio opgehaald: ${audioBuffer.byteLength} bytes (${Date.now() - begin}ms)`);

    // Bereken eerst het (kleine) volumeprofiel — dat is alles wat we straks nog
    // nodig hebben om de sprekerlabels te bepalen zodra de webhook binnenkomt.
    const volumeProfiel = await berekenVolumeProfiel(audioBuffer);
    console.log(`[gesprekken] volumeprofiel berekend: ${volumeProfiel.length} vensters (${Date.now() - begin}ms)`);

    const audioUrl = await uploadAudio(audioBuffer);
    // Vanaf hier is de audiobuffer niet meer nodig — er wordt nergens naar disk geschreven.
    console.log(`[gesprekken] audio geupload naar AssemblyAI (${Date.now() - begin}ms)`);

    const transcriptId = await dienTranscriptieIn(audioUrl, {
      webhookUrl: `${appUrl()}/api/webhooks/assemblyai`,
      webhookSecret: webhookSecret(),
    });
    console.log(`[gesprekken] transcriptie ingediend bij AssemblyAI: ${transcriptId} (${Date.now() - begin}ms)`);

    const [nieuwGesprek] = await db
      .insert(gesprekken)
      .values({
        gestartOp,
        beeindigdOp,
        klantnaam: typeof body.klantnaam === "string" && body.klantnaam.length > 0 ? body.klantnaam : null,
        transcriptId,
        volumeProfiel,
      })
      .returning();
    console.log(`[gesprekken] gesprek opgeslagen: ${nieuwGesprek.id} (totaal ${Date.now() - begin}ms)`);

    return Response.json({ ...nieuwGesprek, status: "bezig" }, { status: 202 });
  } catch (error) {
    console.error(`[gesprekken] POST mislukt na ${Date.now() - begin}ms:`, error);
    const message = error instanceof Error ? error.message : "Onbekende fout";
    return Response.json({ error: `Verwerken van de opname is mislukt: ${message}` }, { status: 500 });
  } finally {
    if (blobUrl) {
      // De opname staat nu bij AssemblyAI (of de poging is mislukt) — de tijdelijke
      // Blob mag hoe dan ook weg, we bewaren nergens audio.
      await del(blobUrl).catch((error) => console.error("[gesprekken] blob verwijderen mislukt:", error));
    }
  }
}

export async function GET() {
  const lijst = await haalGesprekkenLijstOp();
  return Response.json(lijst);
}
