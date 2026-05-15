/** Minimal class shape for payment charts (matches loaded Supabase rows). */
export type ClassForPaymentsAnalytics = {
  class_date: string;
  taught: boolean;
  paid: boolean;
  earn_per_class_cents: number;
  gym_id: string;
  gyms: {
    name: string;
    colour: string;
    pay_per_class_cents: number;
  } | null;
};

export type MonthIncomeBucket = {
  key: string;
  label: string;
  paidCents: number;
  outstandingCents: number;
  taughtCount: number;
};

export type GymIncomeRow = {
  gymId: string;
  name: string;
  colour: string;
  paidCents: number;
  outstandingCents: number;
  taughtCount: number;
};

export type PaymentAnalytics = {
  monthly: MonthIncomeBucket[];
  cumulativePaid: { label: string; cumulativeCents: number }[];
  gymThisMonth: GymIncomeRow[];
  summary: {
    allTimePaidCents: number;
    allTimeOutstandingCents: number;
    thisMonthPaidCents: number;
    thisMonthOutstandingCents: number;
    thisMonthTaughtCount: number;
  };
};

function earnCents(c: ClassForPaymentsAnalytics): number {
  return c.earn_per_class_cents ?? c.gyms?.pay_per_class_cents ?? 0;
}

function monthKeyFromDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function formatMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  const dt = new Date(y, m - 1, 1);
  return dt.toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
}

function lastNMonthKeys(n: number, anchor = new Date()): string[] {
  const keys: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(anchor.getFullYear(), anchor.getMonth() - i, 1);
    keys.push(monthKeyFromDate(d));
  }
  return keys;
}

export function computePaymentAnalytics(
  classes: ClassForPaymentsAnalytics[],
  options?: { monthCount?: number; todayStr?: string },
): PaymentAnalytics {
  const monthCount = options?.monthCount ?? 6;
  const todayStr =
    options?.todayStr ??
    (() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    })();
  const thisMonthKey = todayStr.slice(0, 7);

  const monthKeys = lastNMonthKeys(monthCount);
  const monthly: MonthIncomeBucket[] = monthKeys.map((key) => ({
    key,
    label: formatMonthLabel(key),
    paidCents: 0,
    outstandingCents: 0,
    taughtCount: 0,
  }));
  const monthByKey = new Map(monthly.map((b) => [b.key, b]));

  const gymMap = new Map<string, GymIncomeRow>();

  let allTimePaidCents = 0;
  let allTimeOutstandingCents = 0;
  let thisMonthPaidCents = 0;
  let thisMonthOutstandingCents = 0;
  let thisMonthTaughtCount = 0;

  for (const c of classes) {
    if (!c.taught) continue;
    const amount = earnCents(c);
    const mKey = c.class_date.slice(0, 7);

    if (c.paid) allTimePaidCents += amount;
    else allTimeOutstandingCents += amount;

    if (mKey === thisMonthKey) {
      thisMonthTaughtCount += 1;
      if (c.paid) thisMonthPaidCents += amount;
      else thisMonthOutstandingCents += amount;
    }

    const bucket = monthByKey.get(mKey);
    if (bucket) {
      bucket.taughtCount += 1;
      if (c.paid) bucket.paidCents += amount;
      else bucket.outstandingCents += amount;
    }

    if (mKey === thisMonthKey) {
      const gymName = c.gyms?.name ?? "Gym";
      const colour = c.gyms?.colour ?? "violet";
      let row = gymMap.get(c.gym_id);
      if (!row) {
        row = {
          gymId: c.gym_id,
          name: gymName,
          colour,
          paidCents: 0,
          outstandingCents: 0,
          taughtCount: 0,
        };
        gymMap.set(c.gym_id, row);
      }
      row.taughtCount += 1;
      if (c.paid) row.paidCents += amount;
      else row.outstandingCents += amount;
    }
  }

  let running = 0;
  const cumulativePaid = monthly.map((b) => {
    running += b.paidCents;
    return { label: b.label, cumulativeCents: running };
  });

  const gymThisMonth = Array.from(gymMap.values()).sort(
    (a, b) => b.paidCents + b.outstandingCents - (a.paidCents + a.outstandingCents),
  );

  return {
    monthly,
    cumulativePaid,
    gymThisMonth,
    summary: {
      allTimePaidCents,
      allTimeOutstandingCents,
      thisMonthPaidCents,
      thisMonthOutstandingCents,
      thisMonthTaughtCount,
    },
  };
}
