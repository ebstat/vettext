import { integer, jsonb, pgEnum, pgTable, real, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const sprekerEnum = pgEnum("spreker", ["praktijkmedewerker", "klant"]);

export const gesprekken = pgTable("gesprekken", {
  id: uuid("id").primaryKey().defaultRandom(),
  aangemaaktOp: timestamp("aangemaakt_op", { withTimezone: true }).notNull().defaultNow(),
  gestartOp: timestamp("gestart_op", { withTimezone: true }).notNull(),
  beeindigdOp: timestamp("beeindigd_op", { withTimezone: true }).notNull(),
  klantnaam: text("klantnaam"),
  // Onderstaande twee velden bestaan alleen tijdens de "bezig"-fase (tussen upload en
  // AssemblyAI-webhook) en worden na verwerking weer op null gezet.
  transcriptId: text("transcript_id"),
  volumeProfiel: jsonb("volume_profiel").$type<number[]>(),
  foutmelding: text("foutmelding"),
});

export const regels = pgTable("regels", {
  id: uuid("id").primaryKey().defaultRandom(),
  gesprekId: uuid("gesprek_id")
    .notNull()
    .references(() => gesprekken.id, { onDelete: "cascade" }),
  spreker: sprekerEnum("spreker").notNull(),
  tekst: text("tekst").notNull(),
  startSeconden: real("start_seconden").notNull(),
  eindSeconden: real("eind_seconden").notNull(),
  volgorde: integer("volgorde").notNull(),
});

export type Gesprek = typeof gesprekken.$inferSelect;
export type Regel = typeof regels.$inferSelect;
