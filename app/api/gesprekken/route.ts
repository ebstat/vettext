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

export async function POST(request: Request) {
  const begin = Date.now();

  try {
    const formData = await request.formData();
    const audioBestand = formData.get("audio");
    const klantnaam = formData.get("klantnaam");
    const gestartOpRaw = formData.get("gestartOp");
    const beeindigdOpRaw = formData.get("beeindigdOp");

    if (!(audioBestand instanceof Blob) || audioBestand.size === 0) {
      return Response.json({ error: "Geen audiobestand ontvangen" }, { status: 400 });
    }

    if (typeof gestartOpRaw !== "string" || typeof beeindigdOpRaw !== "string") {
      return Response.json({ error: "gestartOp/beeindigdOp ontbreken" }, { status: 400 });
    }

    const gestartOp = new Date(gestartOpRaw);
    const beeindigdOp = new Date(beeindigdOpRaw);
    if (Number.isNaN(gestartOp.getTime()) || Number.isNaN(beeindigdOp.getTime())) {
      return Response.json({ error: "gestartOp/beeindigdOp zijn geen geldige datums" }, { status: 400 });
    }

    const duurSeconden = Math.round((beeindigdOp.getTime() - gestartOp.getTime()) / 1000);
    console.log(
      `[gesprekken] audio ontvangen: ${audioBestand.size} bytes, opnameduur ~${duurSeconden}s, type ${audioBestand.type}`,
    );

    const audioBuffer = Buffer.from(await audioBestand.arrayBuffer());

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
        klantnaam: typeof klantnaam === "string" && klantnaam.length > 0 ? klantnaam : null,
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
  }
}

export async function GET() {
  const lijst = await haalGesprekkenLijstOp();
  return Response.json(lijst);
}
