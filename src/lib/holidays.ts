// Nager.Date — free, no key, 90+ countries, India supported ✓
// https://date.nager.at

export interface PublicHoliday {
  date: string;        // YYYY-MM-DD
  name: string;
  localName: string;
  countryCode: string;
}

const cache: Record<number, Set<string>> = {};

export async function fetchIndiaHolidays(year?: number): Promise<Set<string>> {
  const y = year ?? new Date().getFullYear();
  if (cache[y]) return cache[y];

  try {
    const res  = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${y}/IN`);
    if (!res.ok) return new Set();
    const data: PublicHoliday[] = await res.json();
    const dates = new Set(data.map((h) => h.date));
    cache[y] = dates;
    return dates;
  } catch {
    return new Set();
  }
}

export function isHoliday(dateStr: string, holidays: Set<string>): boolean {
  return holidays.has(dateStr);
}

// Get today's holiday name (if any)
export async function getTodayHoliday(): Promise<string | null> {
  const today = new Date().toISOString().slice(0, 10);
  const holidays = await fetchIndiaHolidays();
  if (!holidays.has(today)) return null;

  try {
    const res  = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${new Date().getFullYear()}/IN`);
    const data: PublicHoliday[] = await res.json();
    return data.find((h) => h.date === today)?.name ?? null;
  } catch {
    return null;
  }
}
