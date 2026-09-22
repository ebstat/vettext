import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";

const STANDAARD_MODEL = "gpt-5";

/**
 * Genereert een samenvatting van het transcript via OpenAI. Wordt ná het
 * opslaan van het ruwe transcript aangeroepen — een mislukte samenvatting mag
 * het transcript zelf nooit blokkeren of overschrijven.
 *
 * Model en API-key zijn instelbaar via env vars (OPENAI_API_KEY,
 * SAMENVATTING_MODEL).
 */
export async function genereerSamenvatting(platteTekst: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY ontbreekt");

  const openai = createOpenAI({ apiKey });

  const { text } = await generateText({
    model: openai(process.env.SAMENVATTING_MODEL ?? STANDAARD_MODEL),
    prompt: `Vat dit gesprek samen:\n\n${platteTekst}`,
  });

  return text;
}
