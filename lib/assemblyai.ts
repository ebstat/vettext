import { KEYTERMEN } from "./keytermen";

const ASSEMBLYAI_BASE_URL = "https://api.eu.assemblyai.com";

export type AssemblyAiUtterance = {
  speaker: string;
  text: string;
  start: number;
  end: number;
  confidence: number;
};

export type AssemblyAiTranscript = {
  id: string;
  status: "queued" | "processing" | "completed" | "error";
  error?: string;
  utterances: AssemblyAiUtterance[] | null;
};

function apiKey(): string {
  const key = process.env.ASSEMBLYAI_API_KEY;
  if (!key) throw new Error("ASSEMBLYAI_API_KEY ontbreekt");
  return key;
}

export async function uploadAudio(audio: Buffer): Promise<string> {
  const response = await fetch(`${ASSEMBLYAI_BASE_URL}/v2/upload`, {
    method: "POST",
    headers: { authorization: apiKey() },
    body: new Uint8Array(audio),
  });

  if (!response.ok) {
    throw new Error(`AssemblyAI upload mislukt (${response.status}): ${await response.text()}`);
  }

  const data = (await response.json()) as { upload_url: string };
  return data.upload_url;
}

/**
 * Dient een transcriptie-opdracht in met een webhook: AssemblyAI verwerkt de
 * opname op de achtergrond en meldt zich bij `webhookUrl` zodra het klaar is
 * (zie app/api/webhooks/assemblyai/route.ts). Geen polling nodig.
 */
export async function dienTranscriptieIn(
  audioUrl: string,
  opties: { webhookUrl: string; webhookSecret: string },
): Promise<string> {
  const response = await fetch(`${ASSEMBLYAI_BASE_URL}/v2/transcript`, {
    method: "POST",
    headers: {
      authorization: apiKey(),
      "content-type": "application/json",
    },
    body: JSON.stringify({
      audio_url: audioUrl,
      language_code: "nl",
      speaker_labels: true,
      ...(KEYTERMEN.length > 0 ? { keyterms_prompt: KEYTERMEN } : {}),
      webhook_url: opties.webhookUrl,
      webhook_auth_header_name: "x-webhook-secret",
      webhook_auth_header_value: opties.webhookSecret,
    }),
  });

  if (!response.ok) {
    throw new Error(`AssemblyAI transcript-aanvraag mislukt (${response.status}): ${await response.text()}`);
  }

  const data = (await response.json()) as { id: string };
  return data.id;
}

export async function haalTranscriptOp(id: string): Promise<AssemblyAiTranscript> {
  const response = await fetch(`${ASSEMBLYAI_BASE_URL}/v2/transcript/${id}`, {
    headers: { authorization: apiKey() },
  });

  if (!response.ok) {
    throw new Error(`AssemblyAI transcript ophalen mislukt (${response.status}): ${await response.text()}`);
  }

  return (await response.json()) as AssemblyAiTranscript;
}
