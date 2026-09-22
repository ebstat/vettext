import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";

const SYSTEEM_PROMPT = `Je bent een assistent voor een dierenartspraktijk. Je krijgt een transcript van een
consult, automatisch gegenereerd door spraakherkenning, met sprekers gelabeld als
"Praktijkmedewerker" en "Klant".

Het transcript kan spraakherkenningsfouten bevatten — vooral bij vaktermen kan een woord
fonetisch fout zijn herkend. Gebruik de context van het gesprek om overduidelijke
herkenningsfouten te interpreteren, maar verzin geen informatie die niet in het transcript
staat.

Schrijf een beknopt, zakelijk verslag in het Nederlands voor het dossier, met (voor zover van
toepassing): reden van het bezoek/klacht, bevindingen, diagnose of vermoeden, behandeling of
advies, en vervolgstappen. Gebruik gewone lopende tekst of korte kopjes, geen overbodige
inleidende of afsluitende zinnen.`;

const STANDAARD_MODEL = "gpt-5";

/**
 * Genereert een samenvatting van het transcript via OpenAI. Wordt ná het
 * opslaan van het ruwe transcript aangeroepen — een mislukte samenvatting mag
 * het transcript zelf nooit blokkeren of overschrijven.
 *
 * Model en API-key zijn instelbaar via env vars (OPENAI_API_KEY,
 * SAMENVATTING_MODEL), zodat dit later eventueel naar een ander model kan
 * zonder codewijziging.
 */
export async function genereerSamenvatting(platteTekst: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY ontbreekt");

  const openai = createOpenAI({ apiKey });

  const { text } = await generateText({
    model: openai(process.env.SAMENVATTING_MODEL ?? STANDAARD_MODEL),
    system: SYSTEEM_PROMPT,
    prompt: `Transcript:\n\n${platteTekst}`,
  });

  return text;
}
