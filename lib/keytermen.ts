/**
 * Vakjargon, medicijnnamen, rassen en andere woorden die het algemene taalmodel
 * van AssemblyAI soms verkeerd verstaat. Wordt meegestuurd als `keyterms_prompt`
 * bij elke transcriptie, zodat AssemblyAI deze woorden zwaarder laat meewegen.
 *
 * Dit is een algemene startset met veelgebruikt Nederlands dierenartsjargon —
 * niet gebaseerd op specifieke fouten uit jullie eigen transcripten. Vul vooral
 * aan met wat je in de praktijk misgaat: medicijn(merk)namen, rasnamen,
 * praktijk-eigen termen, namen van vaste klanten/dieren, etc.
 *
 * Uitbreiden: gewoon een regel toevoegen en opnieuw deployen. Maximaal 6 woorden
 * per term, maximaal 1000 termen (AssemblyAI-limiet).
 */
export const KEYTERMEN: string[] = [
  // Preventieve zorg
  "castratie",
  "sterilisatie",
  "vaccinatie",
  "herhalingsvaccinatie",
  "ontworming",
  "vlooienbehandeling",
  "tekenbehandeling",
  "chippen",
  "gebitscontrole",

  // Onderzoek en diagnostiek
  "bloedonderzoek",
  "echografie",
  "röntgenfoto",
  "urineonderzoek",
  "ontlastingsonderzoek",
  "vacht en huidonderzoek",
  "kreupelheidsonderzoek",

  // Behandelingen en ingrepen
  "narcose",
  "sedatie",
  "lokale verdoving",
  "hechtingen",
  "tandsteen verwijderen",
  "gebitsreiniging",
  "wondverzorging",
  "euthanasie",

  // Aandoeningen en klachten
  "oorontsteking",
  "blaasontsteking",
  "huidontsteking",
  "tandvleesontsteking",
  "nierfalen",
  "diabetes",
  "artrose",
  "voedselallergie",
  "schimmelinfectie",
  "gewrichtsklachten",
  "kreupelheid",
  "hartruis",
  "staar",

  // Anatomie
  "alvleesklier",
  "schildklier",

  // Medicatie
  "antibioticakuur",
  "ontstekingsremmer",
  "pijnstiller",
  "oogdruppels",
  "oordruppels",
];
