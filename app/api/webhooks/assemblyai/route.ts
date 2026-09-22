import { eq } from "drizzle-orm";

import { db } from "@/db";
import { gesprekken, regels } from "@/db/schema";
import { haalTranscriptOp } from "@/lib/assemblyai";
import { bepaalSprekerLabels, VOLUME_VENSTER_MS } from "@/lib/audio";

export const maxDuration = 60;

type WebhookPayload = {
  transcript_id?: string;
  status?: "completed" | "error";
};

export async function POST(request: Request) {
  const begin = Date.now();

  try {
    const verwachteSecret = process.env.ASSEMBLYAI_WEBHOOK_SECRET;
    if (verwachteSecret && request.headers.get("x-webhook-secret") !== verwachteSecret) {
      console.error("[webhook] afgewezen: ontbrekend/onjuist x-webhook-secret");
      return new Response("Unauthorized", { status: 401 });
    }

    const payload = (await request.json()) as WebhookPayload;
    console.log(`[webhook] ontvangen: transcript ${payload.transcript_id}, status ${payload.status}`);

    if (!payload.transcript_id) {
      return Response.json({ error: "transcript_id ontbreekt" }, { status: 400 });
    }

    const [gesprek] = await db
      .select()
      .from(gesprekken)
      .where(eq(gesprekken.transcriptId, payload.transcript_id));

    // Onbekend of al verwerkt (bv. dubbele aflevering) — 2xx zodat AssemblyAI niet blijft retryen.
    if (!gesprek) {
      console.warn(`[webhook] geen gesprek gevonden voor transcript ${payload.transcript_id} — genegeerd`);
      return Response.json({ ok: true });
    }

    if (payload.status === "error") {
      console.error(`[webhook] AssemblyAI meldt status "error" voor transcript ${payload.transcript_id}`);
      await db
        .update(gesprekken)
        .set({ foutmelding: "Transcriptie is mislukt bij AssemblyAI.", volumeProfiel: null })
        .where(eq(gesprekken.id, gesprek.id));
      return Response.json({ ok: true });
    }

    if (payload.status !== "completed") {
      return Response.json({ ok: true });
    }

    const transcript = await haalTranscriptOp(payload.transcript_id);
    const utterances = transcript.utterances ?? [];
    console.log(`[webhook] transcript opgehaald: ${utterances.length} zinnen (${Date.now() - begin}ms)`);

    if (utterances.length === 0) {
      await db
        .update(gesprekken)
        .set({ foutmelding: "Geen spraak gedetecteerd in de opname.", volumeProfiel: null })
        .where(eq(gesprekken.id, gesprek.id));
      return Response.json({ ok: true });
    }

    const sprekerLabels = bepaalSprekerLabels(gesprek.volumeProfiel ?? [], VOLUME_VENSTER_MS, utterances);

    await db.insert(regels).values(
      utterances.map((utterance, index) => ({
        gesprekId: gesprek.id,
        spreker: sprekerLabels.get(utterance.speaker) ?? "klant",
        tekst: utterance.text,
        startSeconden: utterance.start / 1000,
        eindSeconden: utterance.end / 1000,
        volgorde: index,
      })),
    );

    await db.update(gesprekken).set({ volumeProfiel: null }).where(eq(gesprekken.id, gesprek.id));
    console.log(`[webhook] gesprek ${gesprek.id} afgerond (totaal ${Date.now() - begin}ms)`);

    return Response.json({ ok: true });
  } catch (error) {
    console.error(`[webhook] verwerking mislukt na ${Date.now() - begin}ms:`, error);
    return Response.json({ error: "Verwerking van de webhook is mislukt" }, { status: 500 });
  }
}
