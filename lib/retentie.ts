import { inArray, lt } from "drizzle-orm";

import { db } from "@/db";
import { gesprekken } from "@/db/schema";

/**
 * Verwijdert gesprekken op id. Regels verdwijnen automatisch mee via de
 * cascade delete op regels.gesprekId. Gedeeld door de cron-retentie en de
 * handmatige DELETE-route, zodat de verwijderlogica op één plek staat.
 */
export async function verwijderGesprekken(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  await db.delete(gesprekken).where(inArray(gesprekken.id, ids));
  return ids.length;
}

export async function verwijderVerlopenGesprekken(dagen: number): Promise<number> {
  const grens = new Date(Date.now() - dagen * 24 * 60 * 60 * 1000);
  const verlopen = await db.select({ id: gesprekken.id }).from(gesprekken).where(lt(gesprekken.gestartOp, grens));
  return verwijderGesprekken(verlopen.map((gesprek) => gesprek.id));
}
