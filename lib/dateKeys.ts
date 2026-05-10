function pad(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

export function getLocalDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function getTodayKey(): string {
  return getLocalDateKey(new Date());
}

export function startOfWeekSunday(d: Date): Date {
  const x = new Date(d);
  const day = x.getDay();
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function endOfWeekSaturday(d: Date): Date {
  const s = startOfWeekSunday(d);
  const e = new Date(s);
  e.setDate(e.getDate() + 6);
  return e;
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

export function dateKeyInRange(key: string, start: Date, end: Date): boolean {
  const startK = getLocalDateKey(start);
  const endK = getLocalDateKey(end);
  return key >= startK && key <= endK;
}

export function formatDisplayDate(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}
