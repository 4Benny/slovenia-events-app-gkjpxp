export function safeParseDate(value?: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return null;
  return parsed;
}

export function toISO(date: Date): string {
  return new Date(date.getTime()).toISOString();
}

export function formatDateSL(date: Date): string {
  return date.toLocaleDateString("sl-SI", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    timeZone: "UTC",
  });
}

export function formatTimeSL(date: Date): string {
  return date.toLocaleTimeString("sl-SI", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  });
}

export function isPast(date: Date): boolean {
  return date.getTime() < Date.now();
}

export function eventStarted(startsAtISO?: string | null): boolean {
  const startsAt = safeParseDate(startsAtISO);
  if (!startsAt) return false;
  return startsAt.getTime() <= Date.now();
}

export function eventEnded(endsAtISO?: string | null): boolean {
  const endsAt = safeParseDate(endsAtISO);
  if (!endsAt) return false;
  return endsAt.getTime() <= Date.now();
}

export function normalizeLineup(raw?: string | null): string {
  return (raw || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .join(", ");
}

export function lineupToMultiline(raw?: string | null): string {
  return normalizeLineup(raw)
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .join("\n");
}
