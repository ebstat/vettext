import { and, asc, desc, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { gesprekken, regels } from "@/db/schema";

export type GesprekStatus = "bezig" | "klaar" | "mislukt";

function bepaalStatus(foutmelding: string | null, heeftRegels: boolean): GesprekStatus {
  if (foutmelding) return "mislukt";
  return heeftRegels ? "klaar" : "bezig";
}

export async function haalGesprekkenLijstOp() {
  const lijst = await db.select().from(gesprekken).orderBy(desc(gesprekken.gestartOp));
  const ids = lijst.map((gesprek) => gesprek.id);

  const eersteRegels = ids.length
    ? await db
        .select()
        .from(regels)
        .where(and(inArray(regels.gesprekId, ids), eq(regels.volgorde, 0)))
    : [];

  const previewPerGesprek = new Map(eersteRegels.map((regel) => [regel.gesprekId, regel.tekst]));

  return lijst.map((gesprek) => {
    const preview = previewPerGesprek.get(gesprek.id) ?? null;
    return {
      ...gesprek,
      preview,
      status: bepaalStatus(gesprek.foutmelding, preview !== null),
    };
  });
}

export async function haalGesprekMetRegelsOp(id: string) {
  const [gesprek] = await db.select().from(gesprekken).where(eq(gesprekken.id, id));
  if (!gesprek) return null;

  const gesprekRegels = await db
    .select()
    .from(regels)
    .where(eq(regels.gesprekId, id))
    .orderBy(asc(regels.volgorde));

  return {
    ...gesprek,
    regels: gesprekRegels,
    status: bepaalStatus(gesprek.foutmelding, gesprekRegels.length > 0),
  };
}
