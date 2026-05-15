export const MIN_SCHEDULE_GAP_MIN = 20;
const LEGACY_DEFAULT_CLASS_MIN = 60;

export type ClassForScheduleCheck = {
  id: string;
  class_date: string;
  start_time: string;
  end_time?: string | null;
  title: string;
  gyms: { name: string } | null;
};

function parseClockToMinutes(t: string): number | null {
  const raw = t.includes("T")
    ? (t.split("T")[1]?.split(/[.+Zz]/)[0] ?? t)
    : t;
  const [hStr, mStr] = raw.split(":");
  const h = parseInt(hStr ?? "", 10);
  const m = parseInt(mStr ?? "", 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

function classIntervalFromRow(c: {
  start_time: string;
  end_time?: string | null;
}): { start: number; end: number } | null {
  const start = parseClockToMinutes(c.start_time);
  if (start === null) return null;
  const endRaw = c.end_time != null ? parseClockToMinutes(c.end_time) : null;
  if (endRaw != null && endRaw > start) return { start, end: endRaw };
  if (endRaw != null && endRaw <= start) return null;
  return { start, end: start + LEGACY_DEFAULT_CLASS_MIN };
}

function classIntervalsTooClose(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
  minGap: number,
): boolean {
  if (aStart < bEnd && aEnd > bStart) return true;
  if (aEnd <= bStart) {
    const gap = bStart - aEnd;
    return gap >= 0 && gap < minGap;
  }
  const gap = aStart - bEnd;
  return gap >= 0 && gap < minGap;
}

function formatTimeFromDb(t: string) {
  const part = t.includes("T") ? (t.split("T")[1] ?? t) : t;
  const [hh, mm] = part.split(":").map((x) => parseInt(x, 10));
  if (Number.isNaN(hh)) return t;
  const d = new Date();
  d.setHours(hh, mm || 0, 0, 0);
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatTimeRangeFromDb(start: string, end: string) {
  return `${formatTimeFromDb(start)} – ${formatTimeFromDb(end)}`;
}

export function scheduleConflictWarning(
  classes: ClassForScheduleCheck[],
  date: string,
  startTime: string,
  endTime: string,
  excludeId?: string,
): string | null {
  const newStart = parseClockToMinutes(startTime);
  const newEnd = parseClockToMinutes(endTime);
  if (newStart === null || newEnd === null || newEnd <= newStart) return null;
  const sameDay = classes.filter(
    (c) => c.class_date === date && c.id !== excludeId,
  );
  const hits: ClassForScheduleCheck[] = [];
  for (const c of sameDay) {
    const ex = classIntervalFromRow(c);
    if (!ex) continue;
    if (
      classIntervalsTooClose(
        newStart,
        newEnd,
        ex.start,
        ex.end,
        MIN_SCHEDULE_GAP_MIN,
      )
    ) {
      hits.push(c);
    }
  }
  if (hits.length === 0) return null;
  const bits = hits.map(
    (c) =>
      `${c.title} (${formatTimeRangeFromDb(c.start_time, c.end_time ?? "")})${
        c.gyms?.name ? ` — ${c.gyms.name}` : ""
      }`,
  );
  return `This slot is within ${MIN_SCHEDULE_GAP_MIN} minutes of another class on that day: ${bits.join("; ")}. You can still save if you meant to.`;
}
