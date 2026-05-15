/** How far ahead to keep weekly recurring instances populated. */
export const RECURRING_HORIZON_WEEKS = 52;

export type RecurringClassTemplate = {
  user_id: string;
  gym_id: string;
  title: string;
  start_time: string;
  end_time: string;
  earn_per_class_cents: number;
};

export type ClassForRecurringSync = RecurringClassTemplate & {
  id: string;
  class_date: string;
  recurring: boolean;
};

export type RecurringClassInsert = RecurringClassTemplate & {
  class_date: string;
  recurring: true;
  taught: boolean;
  paid: boolean;
};

function normalizeTimeForKey(t: string): string {
  const part = t.includes("T") ? (t.split("T")[1]?.split(/[.+Zz]/)[0] ?? t) : t;
  const [hh, mm, ss] = part.split(":");
  const h = parseInt(hh ?? "", 10);
  const m = parseInt(mm ?? "", 10);
  const s = parseInt(ss ?? "0", 10);
  if (Number.isNaN(h)) return part;
  return `${String(h).padStart(2, "0")}:${String(m || 0).padStart(2, "0")}:${String(s || 0).padStart(2, "0")}`;
}

export function recurringSeriesKey(c: {
  gym_id: string;
  title: string;
  start_time: string;
  end_time: string;
}): string {
  return `${c.gym_id}|${c.title.trim().toLowerCase()}|${normalizeTimeForKey(c.start_time)}|${normalizeTimeForKey(c.end_time)}`;
}

export function matchesRecurringSeries(
  c: ClassForRecurringSync,
  anchor: ClassForRecurringSync,
): boolean {
  if (!c.recurring || !anchor.recurring) return false;
  return recurringSeriesKey(c) === recurringSeriesKey(anchor);
}

export function toLocalISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDaysToDateStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return toLocalISODate(new Date(y, m - 1, d + days));
}

export function recurringHorizonDateStr(todayStr: string): string {
  return addDaysToDateStr(todayStr, RECURRING_HORIZON_WEEKS * 7);
}

/** Weekly dates from anchor (inclusive) through `throughDateStr` (inclusive). */
export function generateWeeklyDatesFromAnchor(
  anchorDateStr: string,
  throughDateStr: string,
): string[] {
  const dates: string[] = [];
  let cur = anchorDateStr;
  while (cur <= throughDateStr) {
    dates.push(cur);
    cur = addDaysToDateStr(cur, 7);
  }
  return dates;
}

export function buildRecurringInsertRow(
  template: RecurringClassTemplate,
  classDate: string,
): RecurringClassInsert {
  return {
    user_id: template.user_id,
    gym_id: template.gym_id,
    title: template.title.trim(),
    class_date: classDate,
    start_time: template.start_time,
    end_time: template.end_time,
    recurring: true,
    taught: false,
    paid: false,
    earn_per_class_cents: template.earn_per_class_cents,
  };
}

export function buildRecurringCreatesFromAnchor(
  template: RecurringClassTemplate,
  anchorDateStr: string,
  todayStr: string,
): RecurringClassInsert[] {
  const minThrough = addDaysToDateStr(
    anchorDateStr,
    (RECURRING_HORIZON_WEEKS - 1) * 7,
  );
  const horizon = recurringHorizonDateStr(todayStr);
  const throughDateStr =
    horizon > minThrough ? horizon : minThrough;
  const dates = generateWeeklyDatesFromAnchor(anchorDateStr, throughDateStr);
  return dates.map((d) => buildRecurringInsertRow(template, d));
}

export function planMissingRecurringInstances(
  classes: ClassForRecurringSync[],
  userId: string,
  todayStr: string,
): RecurringClassInsert[] {
  const horizon = recurringHorizonDateStr(todayStr);
  const bySeries = new Map<string, ClassForRecurringSync[]>();

  for (const c of classes) {
    if (!c.recurring) continue;
    const key = recurringSeriesKey(c);
    const list = bySeries.get(key) ?? [];
    list.push(c);
    bySeries.set(key, list);
  }

  const toInsert: RecurringClassInsert[] = [];

  for (const group of bySeries.values()) {
    const sorted = [...group].sort((a, b) =>
      a.class_date.localeCompare(b.class_date),
    );
    const seed = sorted[0];
    const existingDates = new Set(group.map((c) => c.class_date));
    const template: RecurringClassTemplate = {
      user_id: userId,
      gym_id: seed.gym_id,
      title: seed.title,
      start_time: seed.start_time,
      end_time: seed.end_time,
      earn_per_class_cents: seed.earn_per_class_cents,
    };
    const dates = generateWeeklyDatesFromAnchor(seed.class_date, horizon);
    for (const date of dates) {
      if (!existingDates.has(date)) {
        toInsert.push(buildRecurringInsertRow(template, date));
      }
    }
  }

  return toInsert;
}

export function collectRecurringSeriesIdsAtOrAfter(
  anchor: ClassForRecurringSync,
  all: ClassForRecurringSync[],
): string[] {
  if (!anchor.recurring) return [anchor.id];
  return all
    .filter((c) => {
      if (!matchesRecurringSeries(c, anchor)) return false;
      if (c.class_date > anchor.class_date) return true;
      if (c.class_date < anchor.class_date) return false;
      return c.start_time >= anchor.start_time;
    })
    .map((c) => c.id);
}

export const RECURRING_INSERT_CHUNK = 50;
