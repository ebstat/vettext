import { eq } from "drizzle-orm";

import { db } from "@/db";
import { gesprekken, regels } from "@/db/schema";
import { haalTranscriptOp } from "@/lib/assemblyai";
import { bepaalSprekerLabels, VOLUME_VENSTER_MS } from "@/lib/audio";

type WebhookPayload = {
  transcript_id?: string;
  status?: "completed" | "error";
};

export async function POST(request: Request) {
  const verwachteSecret = process.env.ASSEMBLYAI_WEBHOOK_SECRET;
  if (verwachteSecret && request.headers.get("x-webhook-secret") !== verwachteSecret) {
    return new Response("Unauthorized", { status: 401 });
  }

  const payload = (await request.json()) as WebhookPayload;
  if (!payload.transcript_id) {
    return Response.json({ error: "transcript_id ontbreekt" }, { status: 400 });
  }

  const [gesprek] = await db
    .select()
    .from(gesprekken)
    .where(eq(gesprekken.transcriptId, payload.transcript_id));

  // Onbekend of al verwerkt (bv. dubbele aflevering) — 2xx zodat AssemblyAI niet blijft retryen.
  if (!gesprek) {
    return Response.json({ ok: true });
  }

  if (payload.status === "error") {
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

  return Response.json({ ok: true });
}
