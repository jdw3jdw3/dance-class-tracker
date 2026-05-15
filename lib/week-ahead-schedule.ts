const LEGACY_DEFAULT_CLASS_MIN = 60;

/** Fixed timeline on week-ahead bars (6:30 AM – 10:00 PM). */
export const WEEK_AHEAD_RANGE_START_MIN = 6 * 60 + 30;
export const WEEK_AHEAD_RANGE_END_MIN = 22 * 60;

export type WeekAheadClassInput = {
  id: string;
  class_date: string;
  start_time: string;
  end_time?: string | null;
  title: string;
  taught: boolean;
  paid: boolean;
  recurring: boolean;
  earn_per_class_cents: number;
  gyms: { name: string; colour: string; pay_per_class_cents: number } | null;
};

export type WeekAheadClassBlock = {
  id: string;
  title: string;
  gymName: string;
  colour: string;
  startMin: number;
  endMin: number;
  lane: number;
  taught: boolean;
};

export type WeekAheadDay = {
  dateStr: string;
  label: string;
  dateSub: string;
  rangeStartMin: number;
  rangeEndMin: number;
  classes: WeekAheadClassBlock[];
  laneCount: number;
  hasClasses: boolean;
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

function intervalFromClass(c: {
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

function toLocalISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function weekAheadDateStrings(todayStr: string): string[] {
  const [y, m, d] = todayStr.split("-").map(Number);
  const out: string[] = [];
  for (let i = 0; i < 7; i++) {
    out.push(toLocalISODate(new Date(y, m - 1, d + i)));
  }
  return out;
}

function dayHeading(dateStr: string, todayStr: string): {
  label: string;
  dateSub: string;
} {
  const [y, mo, da] = dateStr.split("-").map(Number);
  const dt = new Date(y, mo - 1, da);
  const weekdayShort = dt.toLocaleDateString("en-GB", { weekday: "short" });
  const dateSub = dt.toLocaleDateString("en-GB", {
    month: "short",
    day: "numeric",
  });

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (dateStr === todayStr) return { label: "Today", dateSub: weekdayShort };
  if (dateStr === toLocalISODate(tomorrow))
    return { label: "Tomorrow", dateSub: weekdayShort };
  return { label: weekdayShort, dateSub };
}

function intervalsOverlap(
  a: { startMin: number; endMin: number },
  b: { startMin: number; endMin: number },
): boolean {
  return a.startMin < b.endMin && a.endMin > b.startMin;
}

function assignLanes(
  blocks: Omit<WeekAheadClassBlock, "lane">[],
): WeekAheadClassBlock[] {
  const sorted = [...blocks].sort((a, b) => a.startMin - b.startMin);
  const lanes: WeekAheadClassBlock[][] = [];

  for (const block of sorted) {
    let placed = false;
    for (let i = 0; i < lanes.length; i++) {
      const overlaps = lanes[i].some((existing) =>
        intervalsOverlap(existing, block),
      );
      if (!overlaps) {
        lanes[i].push({ ...block, lane: i });
        placed = true;
        break;
      }
    }
    if (!placed) {
      lanes.push([{ ...block, lane: lanes.length }]);
    }
  }

  return lanes.flat();
}

export function formatMinutesShort(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: m ? "2-digit" : undefined,
  });
}

export function computeWeekAheadSchedule(
  classes: WeekAheadClassInput[],
  todayStr: string,
): WeekAheadDay[] {
  const dates = weekAheadDateStrings(todayStr);
  const byDate = new Map<string, WeekAheadClassInput[]>();
  for (const c of classes) {
    if (!dates.includes(c.class_date)) continue;
    const list = byDate.get(c.class_date) ?? [];
    list.push(c);
    byDate.set(c.class_date, list);
  }

  return dates.map((dateStr) => {
    const { label, dateSub } = dayHeading(dateStr, todayStr);
    const dayClasses = byDate.get(dateStr) ?? [];
    const rawBlocks: Omit<WeekAheadClassBlock, "lane">[] = [];

    for (const c of dayClasses) {
      const iv = intervalFromClass(c);
      if (!iv) continue;
      rawBlocks.push({
        id: c.id,
        title: c.title,
        gymName: c.gyms?.name ?? "Gym",
        colour: c.gyms?.colour ?? "violet",
        startMin: iv.start,
        endMin: iv.end,
        taught: c.taught,
      });
    }

    const rangeStartMin = WEEK_AHEAD_RANGE_START_MIN;
    const rangeEndMin = WEEK_AHEAD_RANGE_END_MIN;

    if (rawBlocks.length === 0) {
      return {
        dateStr,
        label,
        dateSub,
        rangeStartMin,
        rangeEndMin,
        classes: [],
        laneCount: 1,
        hasClasses: false,
      };
    }

    const placed = assignLanes(rawBlocks);
    const laneCount = Math.max(1, ...placed.map((b) => b.lane + 1));

    return {
      dateStr,
      label,
      dateSub,
      rangeStartMin,
      rangeEndMin,
      classes: placed,
      laneCount,
      hasClasses: true,
    };
  });
}
