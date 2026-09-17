const TIJDZONE = "Europe/Amsterdam";

export function formatTijd(datum: Date): string {
  return datum.toLocaleTimeString("nl-NL", { timeZone: TIJDZONE, hour: "2-digit", minute: "2-digit" });
}

export function formatDatum(datum: Date): string {
  return datum.toLocaleDateString("nl-NL", { timeZone: TIJDZONE, day: "numeric", month: "short", year: "numeric" });
}

export function formatTijdspanne(gestartOp: Date, beeindigdOp: Date): string {
  return `${formatTijd(gestartOp)}–${formatTijd(beeindigdOp)}`;
}

export function formatDatumTijdspanne(gestartOp: Date, beeindigdOp: Date): string {
  return `${formatDatum(gestartOp)} · ${formatTijdspanne(gestartOp, beeindigdOp)}`;
}
