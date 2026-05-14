"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";

const GYM_STYLES: Record<string, string> = {
  "Pulse Dance Co":
    "bg-violet-500/12 text-violet-700 ring-1 ring-violet-500/20 dark:bg-violet-400/15 dark:text-violet-200 dark:ring-violet-400/25",
  "Rhythm Studio":
    "bg-emerald-500/12 text-emerald-700 ring-1 ring-emerald-500/20 dark:bg-emerald-400/15 dark:text-emerald-200 dark:ring-emerald-400/25",
  "Urban Movement Hub":
    "bg-amber-500/15 text-amber-800 ring-1 ring-amber-500/25 dark:bg-amber-400/12 dark:text-amber-100 dark:ring-amber-400/20",
};

const GYM_SWATCH: Record<keyof typeof GYM_STYLES, string> = {
  "Pulse Dance Co": "bg-violet-500 shadow-inner shadow-violet-900/20",
  "Rhythm Studio": "bg-emerald-500 shadow-inner shadow-emerald-900/20",
  "Urban Movement Hub": "bg-amber-500 shadow-inner shadow-amber-900/20",
};

type GymName = keyof typeof GYM_STYLES;

type ClassItem = {
  id: string;
  title: string;
  gym: GymName;
  time: string;
  room?: string;
  instructor: string;
};

type TodayClass = ClassItem & { taught: boolean };

const INITIAL_TODAY_CLASSES: TodayClass[] = [
  {
    id: "t1",
    title: "Intermediate Hip Hop",
    gym: "Pulse Dance Co",
    time: "6:30 PM",
    room: "Studio A",
    instructor: "Marcus Lee",
    taught: false,
  },
  {
    id: "t2",
    title: "Contemporary Flow",
    gym: "Rhythm Studio",
    time: "8:15 PM",
    room: "Main floor",
    instructor: "Sofia Reyes",
    taught: false,
  },
];

type CalendarGroup = {
  heading: string;
  subheading?: string;
  items: ClassItem[];
};

const CALENDAR_GROUPS: CalendarGroup[] = [
  {
    heading: "Tomorrow",
    subheading: "Wed, May 15",
    items: [
      {
        id: "c1",
        title: "Beginner Jazz",
        gym: "Urban Movement Hub",
        time: "5:45 PM",
        room: "Room 2",
        instructor: "Jamie Ortiz",
      },
      {
        id: "c2",
        title: "Senior Tap",
        gym: "Pulse Dance Co",
        time: "7:30 PM",
        room: "Studio A",
        instructor: "Marcus Lee",
      },
    ],
  },
  {
    heading: "Saturday",
    subheading: "May 16",
    items: [
      {
        id: "c3",
        title: "Advanced Ballet",
        gym: "Rhythm Studio",
        time: "7:00 PM",
        room: "Studio B",
        instructor: "Elena Park",
      },
      {
        id: "c4",
        title: "Lyrical Open Level",
        gym: "Rhythm Studio",
        time: "8:30 PM",
        room: "Main floor",
        instructor: "Sofia Reyes",
      },
    ],
  },
  {
    heading: "Sunday",
    subheading: "May 17",
    items: [
      {
        id: "c5",
        title: "Heels Technique",
        gym: "Pulse Dance Co",
        time: "9:00 PM",
        room: "Studio C",
        instructor: "Avery Kim",
      },
    ],
  },
  {
    heading: "Tuesday",
    subheading: "May 20",
    items: [
      {
        id: "c6",
        title: "Company Rehearsal",
        gym: "Urban Movement Hub",
        time: "6:00 PM",
        room: "Theatre",
        instructor: "Jamie Ortiz",
      },
    ],
  },
];

type UnpaidPayment = {
  id: string;
  classTitle: string;
  gym: GymName;
  taughtOn: string;
  amountCents: number;
};

const INITIAL_UNPAID: UnpaidPayment[] = [
  {
    id: "p1",
    classTitle: "Open Level Waacking",
    gym: "Urban Movement Hub",
    taughtOn: "May 9",
    amountCents: 8500,
  },
  {
    id: "p2",
    classTitle: "Kids Hip Hop (ages 8–10)",
    gym: "Pulse Dance Co",
    taughtOn: "May 11",
    amountCents: 12000,
  },
  {
    id: "p3",
    classTitle: "Contemporary Company",
    gym: "Rhythm Studio",
    taughtOn: "May 12",
    amountCents: 22000,
  },
];

type GymProfile = {
  id: GymName;
  payPerClass: string;
  classesThisMonth: number;
  area: string;
};

const GYM_PROFILES: GymProfile[] = [
  {
    id: "Pulse Dance Co",
    payPerClass: "$75 / class",
    classesThisMonth: 9,
    area: "Downtown",
  },
  {
    id: "Rhythm Studio",
    payPerClass: "$68 / class",
    classesThisMonth: 6,
    area: "Westside",
  },
  {
    id: "Urban Movement Hub",
    payPerClass: "$85 / class",
    classesThisMonth: 5,
    area: "Arts District",
  },
];

type TabId = "today" | "calendar" | "payments" | "gyms";

function formatUsd(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function GymBadge({ gym }: { gym: GymName }) {
  return (
    <span
      className={`inline-flex max-w-full shrink-0 truncate rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ${GYM_STYLES[gym]}`}
    >
      {gym}
    </span>
  );
}

function IconToday({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8 2v3M16 2v3M4 9h16M6 4h12a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9 14h.01M12 14h.01M15 14h.01M9 17h.01M12 17h.01"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconCalendar({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8 2v3M16 2v3M4 9h16M6 4h12a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 13h8M8 17h5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconPayments({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="3"
        y="5"
        width="18"
        height="14"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path
        d="M3 10h18M7 15h4"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconGyms({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 21V10l8-5 8 5v11"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9 21v-6h6v6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[22px] border border-zinc-200/80 bg-white/90 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-8px_rgba(0,0,0,0.12)] backdrop-blur-sm dark:border-zinc-800/80 dark:bg-zinc-900/80 dark:shadow-[0_1px_2px_rgba(0,0,0,0.2),0_8px_28px_-10px_rgba(0,0,0,0.45)]">
      <div className="p-4">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              {title}
            </h2>
            {subtitle ? (
              <p className="mt-0.5 text-[13px] leading-snug text-zinc-500 dark:text-zinc-400">
                {subtitle}
              </p>
            ) : null}
          </div>
        </div>
        {children}
      </div>
    </section>
  );
}

function ClassRowCalendar({ item }: { item: ClassItem }) {
  return (
    <div className="flex gap-3 border-b border-zinc-100 py-3 last:border-b-0 dark:border-zinc-800/80">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-[15px] font-medium text-zinc-900 dark:text-zinc-100">
            {item.title}
          </p>
          <GymBadge gym={item.gym} />
        </div>
        <p className="text-[13px] text-zinc-500 dark:text-zinc-400">
          {item.instructor}
          {item.room ? ` · ${item.room}` : ""}
        </p>
      </div>
      <p className="shrink-0 text-[15px] font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
        {item.time}
      </p>
    </div>
  );
}

export default function Home() {
  const [tab, setTab] = useState<TabId>("today");
  const [todayClasses, setTodayClasses] =
    useState<TodayClass[]>(INITIAL_TODAY_CLASSES);
  const [unpaid, setUnpaid] = useState<UnpaidPayment[]>(INITIAL_UNPAID);

  const today = new Date();
  const dateLine = today.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const taughtTodayCount = useMemo(
    () => todayClasses.filter((c) => c.taught).length,
    [todayClasses],
  );

  const outstandingCents = useMemo(
    () => unpaid.reduce((sum, p) => sum + p.amountCents, 0),
    [unpaid],
  );

  const headerSubtitle = useMemo(() => {
    switch (tab) {
      case "today":
        return dateLine;
      case "calendar":
        return "Upcoming classes by day";
      case "payments":
        return "Taught classes awaiting payout";
      case "gyms":
        return "Rates and volume this month";
      default:
        return "";
    }
  }, [tab, dateLine]);

  function markTaught(id: string) {
    setTodayClasses((prev) =>
      prev.map((c) => (c.id === id ? { ...c, taught: true } : c)),
    );
  }

  function markPaid(id: string) {
    setUnpaid((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <div className="relative min-h-dvh bg-[#F2F2F7] pb-28 pt-[max(0.75rem,env(safe-area-inset-top))] dark:bg-zinc-950">
      <div className="mx-auto w-full max-w-lg px-4 pt-3 sm:px-5 sm:pt-5">
        <header className="mb-5">
          <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-zinc-900 sm:text-[30px] dark:text-zinc-50">
            Dance Class Tracker
          </h1>
          <p className="mt-1.5 text-[15px] font-medium text-zinc-500 dark:text-zinc-400">
            {headerSubtitle}
          </p>
        </header>

        {tab === "today" ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between rounded-2xl border border-zinc-200/70 bg-white/70 px-4 py-3 text-[13px] text-zinc-600 shadow-sm backdrop-blur-sm dark:border-zinc-800/70 dark:bg-zinc-900/60 dark:text-zinc-300">
              <span>
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {todayClasses.length}
                </span>{" "}
                on your schedule
              </span>
              <span className="tabular-nums text-zinc-500 dark:text-zinc-400">
                {taughtTodayCount}/{todayClasses.length} taught
              </span>
            </div>

            <SectionCard
              title="Today's classes"
              subtitle="Tap when you finish teaching."
            >
              <ul className="flex flex-col gap-3">
                {todayClasses.map((c) => (
                  <li
                    key={c.id}
                    className="rounded-2xl border border-zinc-200/70 bg-zinc-50/80 p-3.5 ring-1 ring-zinc-100 dark:border-zinc-700/60 dark:bg-zinc-800/40 dark:ring-zinc-700/40"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-[16px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                            {c.title}
                          </p>
                          <GymBadge gym={c.gym} />
                        </div>
                        <p className="mt-1 text-[14px] text-zinc-500 dark:text-zinc-400">
                          {c.instructor}
                          {c.room ? ` · ${c.room}` : ""}
                        </p>
                        <p className="mt-2 text-[18px] font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
                          {c.time}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => markTaught(c.id)}
                        disabled={c.taught}
                        className={`shrink-0 rounded-2xl px-4 py-2.5 text-[14px] font-semibold transition active:scale-[0.98] sm:min-w-[9.5rem] ${
                          c.taught
                            ? "cursor-default border border-emerald-500/25 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                            : "bg-blue-600 text-white shadow-sm shadow-blue-600/25 hover:bg-blue-700 disabled:opacity-100 dark:bg-blue-500 dark:hover:bg-blue-400"
                        }`}
                        style={{ WebkitTapHighlightColor: "transparent" }}
                      >
                        {c.taught ? "Taught" : "Mark as taught"}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </SectionCard>
          </div>
        ) : null}

        {tab === "calendar" ? (
          <div className="flex flex-col gap-4">
            {CALENDAR_GROUPS.map((group) => (
              <SectionCard
                key={group.heading + (group.subheading ?? "")}
                title={group.heading}
                subtitle={group.subheading}
              >
                <div>
                  {group.items.map((item) => (
                    <ClassRowCalendar key={item.id} item={item} />
                  ))}
                </div>
              </SectionCard>
            ))}
          </div>
        ) : null}

        {tab === "payments" ? (
          <div className="flex flex-col gap-4">
            <div className="overflow-hidden rounded-[22px] border border-amber-500/25 bg-gradient-to-br from-amber-50 to-white p-4 shadow-sm dark:from-amber-950/40 dark:to-zinc-900 dark:border-amber-400/20">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-800/90 dark:text-amber-200/90">
                Total outstanding
              </p>
              <p className="mt-1 text-[32px] font-semibold tabular-nums tracking-tight text-amber-950 dark:text-amber-50">
                {formatUsd(outstandingCents)}
              </p>
              <p className="mt-1 text-[13px] text-amber-900/70 dark:text-amber-200/70">
                {unpaid.length === 0
                  ? "You are all caught up."
                  : `${unpaid.length} class${unpaid.length === 1 ? "" : "es"} waiting on payment`}
              </p>
            </div>

            <SectionCard
              title="Taught, not paid"
              subtitle="Confirm when the gym settles up."
            >
              {unpaid.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-200/90 bg-zinc-50/50 px-4 py-10 text-center dark:border-zinc-700 dark:bg-zinc-800/30">
                  <p className="text-[15px] font-medium text-zinc-700 dark:text-zinc-200">
                    Nothing outstanding
                  </p>
                  <p className="mt-1 text-[13px] text-zinc-500 dark:text-zinc-400">
                    New payouts will show up here.
                  </p>
                </div>
              ) : (
                <ul className="flex flex-col gap-3">
                  {unpaid.map((p) => (
                    <li
                      key={p.id}
                      className="rounded-2xl border border-zinc-200/70 bg-zinc-50/80 p-3.5 dark:border-zinc-700/60 dark:bg-zinc-800/40"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="truncate text-[15px] font-semibold text-zinc-900 dark:text-zinc-50">
                            {p.classTitle}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <GymBadge gym={p.gym} />
                            <span className="text-[12px] text-zinc-500 dark:text-zinc-400">
                              Taught {p.taughtOn}
                            </span>
                          </div>
                          <p className="mt-2 text-[18px] font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
                            {formatUsd(p.amountCents)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => markPaid(p.id)}
                          className="shrink-0 rounded-2xl border border-zinc-200/90 bg-white px-4 py-2.5 text-[14px] font-semibold text-zinc-900 shadow-sm hover:bg-zinc-50 active:scale-[0.98] dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700/80"
                          style={{ WebkitTapHighlightColor: "transparent" }}
                        >
                          Mark as paid
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          </div>
        ) : null}

        {tab === "gyms" ? (
          <div className="flex flex-col gap-3">
            {GYM_PROFILES.map((g) => (
              <section
                key={g.id}
                className="rounded-[22px] border border-zinc-200/80 bg-white/90 p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-8px_rgba(0,0,0,0.12)] backdrop-blur-sm dark:border-zinc-800/80 dark:bg-zinc-900/80 dark:shadow-[0_1px_2px_rgba(0,0,0,0.2),0_8px_28px_-10px_rgba(0,0,0,0.45)]"
              >
                <div className="flex gap-3">
                  <div
                    className={`mt-0.5 h-11 w-11 shrink-0 rounded-2xl ${GYM_SWATCH[g.id]}`}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-[17px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                        {g.id}
                      </h2>
                      <GymBadge gym={g.id} />
                    </div>
                    <p className="mt-0.5 text-[13px] text-zinc-500 dark:text-zinc-400">
                      {g.area}
                    </p>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-2xl bg-zinc-50/90 p-3 ring-1 ring-zinc-200/60 dark:bg-zinc-800/50 dark:ring-zinc-700/50">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                          Pay / class
                        </p>
                        <p className="mt-1 text-[15px] font-semibold text-zinc-900 dark:text-zinc-50">
                          {g.payPerClass}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-zinc-50/90 p-3 ring-1 ring-zinc-200/60 dark:bg-zinc-800/50 dark:ring-zinc-700/50">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                          This month
                        </p>
                        <p className="mt-1 text-[15px] font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
                          {g.classesThisMonth} classes
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            ))}
          </div>
        ) : null}
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-10 border-t border-zinc-200/80 bg-white/85 px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl dark:border-zinc-800/80 dark:bg-zinc-950/85"
        aria-label="Primary"
      >
        <div className="mx-auto flex max-w-lg items-stretch justify-between gap-1">
          {(
            [
              { id: "today" as const, label: "Today", Icon: IconToday },
              { id: "calendar" as const, label: "Calendar", Icon: IconCalendar },
              { id: "payments" as const, label: "Payments", Icon: IconPayments },
              { id: "gyms" as const, label: "Gyms", Icon: IconGyms },
            ] as const
          ).map(({ id, label, Icon }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                aria-current={active ? "page" : undefined}
                className={`flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl py-2 transition-colors ${
                  active
                    ? "text-blue-600 dark:text-blue-400"
                    : "text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
                }`}
                style={{ WebkitTapHighlightColor: "transparent" }}
              >
                <Icon className="h-6 w-6" />
                <span
                  className={`text-[10px] ${active ? "font-semibold" : "font-medium"}`}
                >
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
