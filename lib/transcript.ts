import type { Regel } from "@/db/schema";

export const LABEL_PER_SPREKER: Record<Regel["spreker"], string> = {
  praktijkmedewerker: "Praktijkmedewerker",
  klant: "Klant",
};

export function formatPlatteTekst(regels: { spreker: Regel["spreker"]; tekst: string }[]): string {
  return regels.map((regel) => `${LABEL_PER_SPREKER[regel.spreker]}: ${regel.tekst}`).join("\n");
}
