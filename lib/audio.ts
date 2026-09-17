import { spawn } from "node:child_process";

import ffmpegPath from "ffmpeg-static";

const SAMPLE_RATE = 16000;
export const VOLUME_VENSTER_MS = 100;

/**
 * Decodeert een audiobuffer (elk formaat dat de browser oplevert, bv. webm/opus)
 * naar mono 16-bit PCM samples via ffmpeg. Alleen gebruikt om er meteen het
 * volumeprofiel hieronder uit te berekenen — het origineel gaat ongewijzigd naar
 * AssemblyAI en wordt hier nergens bewaard.
 */
async function decodeerNaarPcm(audio: Buffer): Promise<Int16Array> {
  const ffmpegBinary = ffmpegPath;
  if (!ffmpegBinary) throw new Error("ffmpeg-static binary niet gevonden");

  return new Promise((resolve, reject) => {
    const ffmpeg = spawn(ffmpegBinary, [
      "-i", "pipe:0",
      "-f", "s16le",
      "-ac", "1",
      "-ar", String(SAMPLE_RATE),
      "pipe:1",
    ]);

    const chunks: Buffer[] = [];
    let stderr = "";

    ffmpeg.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
    ffmpeg.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    ffmpeg.on("error", reject);
    ffmpeg.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`ffmpeg-decodering mislukt (code ${code}): ${stderr}`));
        return;
      }
      const pcmBuffer = Buffer.concat(chunks);
      resolve(new Int16Array(pcmBuffer.buffer, pcmBuffer.byteOffset, Math.floor(pcmBuffer.length / 2)));
    });

    ffmpeg.stdin.on("error", () => {
      // negeer EPIPE als ffmpeg al gestopt is voordat we klaar zijn met schrijven
    });
    ffmpeg.stdin.write(audio);
    ffmpeg.stdin.end();
  });
}

/**
 * Berekent een compact RMS-volumeprofiel (één getal per vensterMs) over de hele
 * opname. Dit is GEEN audio meer, slechts een reeks volumewaarden — bruikbaar om
 * later (zodra de AssemblyAI-webhook de sprekerlabels+tijdstempels aanlevert) te
 * bepalen wie de praktijkmedewerker is, zonder de ruwe audio te hoeven bewaren.
 */
export async function berekenVolumeProfiel(audio: Buffer, vensterMs = VOLUME_VENSTER_MS): Promise<number[]> {
  const pcm = await decodeerNaarPcm(audio);
  const vensterSamples = Math.max(1, Math.round((vensterMs / 1000) * SAMPLE_RATE));

  const profiel: number[] = [];
  for (let start = 0; start < pcm.length; start += vensterSamples) {
    const eind = Math.min(pcm.length, start + vensterSamples);
    let sumSquares = 0;
    for (let i = start; i < eind; i++) sumSquares += pcm[i] * pcm[i];
    profiel.push(Math.sqrt(sumSquares / (eind - start)));
  }

  return profiel;
}

/**
 * Bepaalt per AssemblyAI speaker-label (A/B/...) of het de praktijkmedewerker of
 * de klant is, op basis van het gemiddelde volume (uit het profiel) over alle
 * fragmenten van dat label. Het luidste label (zender dicht bij de mond) =
 * praktijkmedewerker. Puur rekenwerk op het profiel — geen audio nodig.
 */
export function bepaalSprekerLabels(
  profiel: number[],
  vensterMs: number,
  utterances: { speaker: string; start: number; end: number }[],
): Map<string, "praktijkmedewerker" | "klant"> {
  const rmsPerLabel = new Map<string, { totaal: number; aantal: number }>();

  for (const utterance of utterances) {
    const startVenster = Math.max(0, Math.floor(utterance.start / vensterMs));
    const eindVenster = Math.min(profiel.length, Math.ceil(utterance.end / vensterMs));
    if (eindVenster <= startVenster) continue;

    let totaal = 0;
    for (let i = startVenster; i < eindVenster; i++) totaal += profiel[i];
    const gemiddeld = totaal / (eindVenster - startVenster);

    const bestaand = rmsPerLabel.get(utterance.speaker) ?? { totaal: 0, aantal: 0 };
    bestaand.totaal += gemiddeld;
    bestaand.aantal += 1;
    rmsPerLabel.set(utterance.speaker, bestaand);
  }

  const gesorteerd = [...rmsPerLabel.entries()]
    .map(([label, { totaal, aantal }]) => ({ label, gemiddeld: totaal / aantal }))
    .sort((a, b) => b.gemiddeld - a.gemiddeld);

  const mapping = new Map<string, "praktijkmedewerker" | "klant">();
  gesorteerd.forEach(({ label }, index) => {
    mapping.set(label, index === 0 ? "praktijkmedewerker" : "klant");
  });
  return mapping;
}
