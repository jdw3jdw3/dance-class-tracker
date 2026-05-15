"use client";

import type { Session, SupabaseClient } from "@supabase/supabase-js";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

import { createClient } from "@/lib/supabase";
import { getSupabasePublicEnvDiagnostics } from "@/lib/supabase/env";

/** Stored on each gym row; maps to Tailwind badge + swatch styles. */
const COLOUR_BADGE: Record<string, string> = {
  violet:
    "bg-violet-500/12 text-violet-700 ring-1 ring-violet-500/20 dark:bg-violet-400/15 dark:text-violet-200 dark:ring-violet-400/25",
  emerald:
    "bg-emerald-500/12 text-emerald-700 ring-1 ring-emerald-500/20 dark:bg-emerald-400/15 dark:text-emerald-200 dark:ring-emerald-400/25",
  amber:
    "bg-amber-500/15 text-amber-800 ring-1 ring-amber-500/25 dark:bg-amber-400/12 dark:text-amber-100 dark:ring-amber-400/20",
  rose: "bg-rose-500/12 text-rose-700 ring-1 ring-rose-500/20 dark:bg-rose-400/15 dark:text-rose-200 dark:ring-rose-400/25",
  sky: "bg-sky-500/12 text-sky-800 ring-1 ring-sky-500/20 dark:bg-sky-400/15 dark:text-sky-100 dark:ring-sky-400/25",
  orange:
    "bg-orange-500/12 text-orange-800 ring-1 ring-orange-500/20 dark:bg-orange-400/15 dark:text-orange-100 dark:ring-orange-400/25",
  teal: "bg-teal-500/12 text-teal-800 ring-1 ring-teal-500/20 dark:bg-teal-400/15 dark:text-teal-100 dark:ring-teal-400/25",
  indigo:
    "bg-indigo-500/12 text-indigo-800 ring-1 ring-indigo-500/20 dark:bg-indigo-400/15 dark:text-indigo-100 dark:ring-indigo-400/25",
  fuchsia:
    "bg-fuchsia-500/12 text-fuchsia-800 ring-1 ring-fuchsia-500/20 dark:bg-fuchsia-400/15 dark:text-fuchsia-100 dark:ring-fuchsia-400/25",
};

const COLOUR_SWATCH: Record<string, string> = {
  violet: "bg-violet-500 shadow-inner shadow-violet-900/20",
  emerald: "bg-emerald-500 shadow-inner shadow-emerald-900/20",
  amber: "bg-amber-500 shadow-inner shadow-amber-900/20",
  rose: "bg-rose-500 shadow-inner shadow-rose-900/20",
  sky: "bg-sky-500 shadow-inner shadow-sky-900/20",
  orange: "bg-orange-500 shadow-inner shadow-orange-900/20",
  teal: "bg-teal-500 shadow-inner shadow-teal-900/20",
  indigo: "bg-indigo-500 shadow-inner shadow-indigo-900/20",
  fuchsia: "bg-fuchsia-500 shadow-inner shadow-fuchsia-900/20",
};

/** Solid gym colour as badge background (Today tab). */
const COLOUR_BADGE_FILLED: Record<string, string> = {
  violet: "bg-violet-500 text-white ring-1 ring-violet-600/40",
  emerald: "bg-emerald-500 text-white ring-1 ring-emerald-600/40",
  amber: "bg-amber-400 text-amber-950 ring-1 ring-amber-500/50",
  rose: "bg-rose-500 text-white ring-1 ring-rose-600/40",
  sky: "bg-sky-500 text-white ring-1 ring-sky-600/40",
  orange: "bg-orange-500 text-white ring-1 ring-orange-600/40",
  teal: "bg-teal-500 text-white ring-1 ring-teal-600/40",
  indigo: "bg-indigo-500 text-white ring-1 ring-indigo-600/40",
  fuchsia: "bg-fuchsia-500 text-white ring-1 ring-fuchsia-600/40",
};

const GYM_COLOUR_OPTIONS = [
  { value: "violet", label: "Violet" },
  { value: "emerald", label: "Emerald" },
  { value: "amber", label: "Amber" },
  { value: "rose", label: "Rose" },
  { value: "sky", label: "Sky" },
  { value: "orange", label: "Orange" },
  { value: "teal", label: "Teal" },
  { value: "indigo", label: "Indigo" },
  { value: "fuchsia", label: "Fuchsia" },
] as const;

/** Warn when a new class’s [start, end) is within this many minutes of another’s (same calendar day). */
const MIN_SCHEDULE_GAP_MIN = 20;
/** If an old row ever lacked `end_time`, treat duration as this many minutes for overlap checks only. */
const LEGACY_DEFAULT_CLASS_MIN = 60;

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

/** True if intervals [aStart,aEnd) and [bStart,bEnd) overlap, touch, or are separated by less than `minGap` minutes. */
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

function badgeClassForColour(colour: string) {
  return COLOUR_BADGE[colour] ?? COLOUR_BADGE.violet;
}

function filledBadgeClassForColour(colour: string) {
  return COLOUR_BADGE_FILLED[colour] ?? COLOUR_BADGE_FILLED.violet;
}

function swatchClassForColour(colour: string) {
  return COLOUR_SWATCH[colour] ?? COLOUR_SWATCH.violet;
}

function GymColourPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <fieldset className="min-w-0 border-0 p-0">
      <legend className="mb-2 block text-[13px] font-medium text-zinc-700 dark:text-zinc-300">
        Colour
      </legend>
      <div className="flex flex-wrap gap-3" role="presentation">
        {GYM_COLOUR_OPTIONS.map((o) => {
          const selected = value === o.value;
          return (
            <button
              key={o.value}
              type="button"
              title={o.label}
              aria-label={`${o.label} colour`}
              aria-pressed={selected}
              onClick={() => onChange(o.value)}
              className={`h-12 w-12 shrink-0 rounded-2xl shadow-inner transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-100 dark:focus-visible:ring-offset-zinc-900 ${swatchClassForColour(o.value)} ${
                selected
                  ? "ring-2 ring-zinc-900 ring-offset-2 ring-offset-white dark:ring-zinc-100 dark:ring-offset-zinc-900"
                  : "ring-2 ring-transparent ring-offset-2 ring-offset-white hover:ring-zinc-300 dark:ring-offset-zinc-900 dark:hover:ring-zinc-600"
              }`}
            />
          );
        })}
      </div>
    </fieldset>
  );
}

type GymRow = {
  id: string;
  user_id: string;
  name: string;
  colour: string;
  pay_per_class_cents: number;
  created_at: string;
};

type ClassRow = {
  id: string;
  user_id: string;
  gym_id: string;
  title: string;
  class_date: string;
  start_time: string;
  end_time: string;
  recurring: boolean;
  taught: boolean;
  paid: boolean;
  /** Pay for this class when added; gym rate changes do not alter this row. */
  earn_per_class_cents: number;
  created_at: string;
  gyms: GymRow | null;
};

type ClassWithGym = ClassRow & { gyms: GymRow | null };

/** Same gym + name + recurring, scheduled on or after `anchor` (date then start_time). */
function collectRecurringSeriesIdsAtOrAfter(
  anchor: ClassWithGym,
  all: ClassWithGym[],
): string[] {
  if (!anchor.recurring) return [anchor.id];
  const titleNorm = anchor.title.trim();
  const { gym_id } = anchor;
  return all
    .filter((c) => {
      if (!c.recurring || c.gym_id !== gym_id || c.title.trim() !== titleNorm)
        return false;
      if (c.class_date > anchor.class_date) return true;
      if (c.class_date < anchor.class_date) return false;
      return c.start_time >= anchor.start_time;
    })
    .map((c) => c.id);
}

type TabId = "today" | "calendar" | "payments" | "settings";

function formatGbp(cents: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(cents / 100);
}

/** Local calendar date YYYY-MM-DD */
function toLocalISODate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Postgres `time` / ISO string → display like 6:30 PM */
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

function formatClassDateHeading(dateStr: string, todayStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const weekday = dt.toLocaleDateString("en-GB", { weekday: "long" });
  const sub = dt.toLocaleDateString("en-GB", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (dateStr === toLocalISODate(tomorrow))
    return { heading: `Tomorrow · ${weekday}`, sub, isPast: false };
  if (dateStr === todayStr)
    return { heading: `Today · ${weekday}`, sub, isPast: false };
  if (dateStr === toLocalISODate(yesterday))
    return { heading: `Yesterday · ${weekday}`, sub, isPast: true };
  const isPast = dateStr < todayStr;
  return { heading: weekday, sub, isPast };
}

function GymBadge({
  name,
  colour,
  filled = false,
}: {
  name: string;
  colour: string;
  /** Solid gym colour background (used on Today). */
  filled?: boolean;
}) {
  return (
    <span
      className={`inline-flex max-w-full shrink-0 truncate rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ${
        filled ? filledBadgeClassForColour(colour) : badgeClassForColour(colour)
      }`}
    >
      {name}
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

function IconSettings({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 15a3 3 0 100-6 3 3 0 000 6z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"
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

function ClassRowCalendar({
  title,
  gymName,
  gymColour,
  timeRangeLabel,
  recurring,
  taught,
  onMarkTaught,
  onAskDelete,
  saveBusy,
}: {
  title: string;
  gymName: string;
  gymColour: string;
  timeRangeLabel: string;
  recurring: boolean;
  taught: boolean;
  onMarkTaught: () => void;
  onAskDelete: () => void;
  saveBusy: boolean;
}) {
  return (
    <div className="flex flex-col gap-2.5 border-b border-zinc-100 py-3 last:border-b-0 dark:border-zinc-800/80 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <p
            className={`truncate text-[15px] font-medium text-zinc-900 dark:text-zinc-100 ${
              taught ? "text-zinc-500 line-through dark:text-zinc-500" : ""
            }`}
          >
            {title}
          </p>
          <GymBadge name={gymName} colour={gymColour} filled />
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {recurring ? (
            <span className="text-[12px] font-medium text-blue-600 dark:text-blue-400">
              Recurring
            </span>
          ) : null}
          {taught ? (
            <span className="text-[12px] font-semibold text-emerald-700 dark:text-emerald-300">
              Taught
            </span>
          ) : null}
        </div>
        <p className="mt-1.5 text-[14px] font-semibold tabular-nums text-zinc-700 dark:text-zinc-300">
          {timeRangeLabel}
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-col sm:items-stretch">
        <button
          type="button"
          onClick={onMarkTaught}
          disabled={taught || saveBusy}
          className={`rounded-xl px-3 py-2 text-[13px] font-semibold transition active:scale-[0.98] ${
            taught
              ? "cursor-default border border-emerald-500/25 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
              : "bg-blue-600 text-white shadow-sm hover:bg-blue-700 disabled:opacity-60 dark:bg-blue-500 dark:hover:bg-blue-400"
          }`}
          style={{ WebkitTapHighlightColor: "transparent" }}
        >
          {taught ? "Taught" : "Mark taught"}
        </button>
        <button
          type="button"
          onClick={onAskDelete}
          disabled={saveBusy}
          className="rounded-xl border border-rose-200/90 px-3 py-2 text-[13px] font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900/50 dark:text-rose-300 dark:hover:bg-rose-950/40"
          style={{ WebkitTapHighlightColor: "transparent" }}
        >
          Delete
        </button>
      </div>
    </div>
  );
}

type AuthView = "login" | "signup";

function AuthScreen({
  supabase,
  view,
  onViewChange,
}: {
  supabase: SupabaseClient;
  view: AuthView;
  onViewChange: (view: AuthView) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  function switchView(next: AuthView) {
    onViewChange(next);
    setError(null);
    setInfo(null);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      if (view === "login") {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInError) setError(signInError.message);
      } else {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
          },
        });
        if (signUpError) {
          setError(signUpError.message);
        } else if (data.session) {
          setInfo("You are signed in.");
        } else {
          setInfo(
            "Check your email to confirm your account, then come back and sign in.",
          );
        }
      }
    } finally {
      setBusy(false);
    }
  }

  const isLogin = view === "login";

  return (
    <div className="flex min-h-dvh flex-col justify-center bg-[#F2F2F7] px-4 py-10 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] dark:bg-zinc-950">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-[26px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Dance Class Tracker
          </h1>
          <p className="mt-2 text-[15px] text-zinc-500 dark:text-zinc-400">
            {isLogin ? "Welcome back" : "Create your account"}
          </p>
        </div>

        <div className="rounded-[22px] border border-zinc-200/80 bg-white/95 p-1 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_32px_-10px_rgba(0,0,0,0.15)] backdrop-blur-sm dark:border-zinc-800/80 dark:bg-zinc-900/95 dark:shadow-[0_1px_2px_rgba(0,0,0,0.2),0_12px_36px_-12px_rgba(0,0,0,0.5)]">
          <div className="flex rounded-[18px] bg-zinc-100/90 p-1 dark:bg-zinc-800/80">
            <button
              type="button"
              onClick={() => switchView("login")}
              className={`flex-1 rounded-[14px] py-2.5 text-[14px] font-semibold transition ${
                isLogin
                  ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-zinc-50"
                  : "text-zinc-500 dark:text-zinc-400"
              }`}
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              Log in
            </button>
            <button
              type="button"
              onClick={() => switchView("signup")}
              className={`flex-1 rounded-[14px] py-2.5 text-[14px] font-semibold transition ${
                !isLogin
                  ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-zinc-50"
                  : "text-zinc-500 dark:text-zinc-400"
              }`}
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              Sign up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 p-5 pt-4">
            <div>
              <label
                htmlFor="auth-email"
                className="mb-1.5 block text-[13px] font-medium text-zinc-700 dark:text-zinc-300"
              >
                Email
              </label>
              <input
                id="auth-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-2xl border border-zinc-200 bg-zinc-50/80 px-4 py-3.5 text-[16px] text-zinc-900 outline-none ring-zinc-300/50 transition placeholder:text-zinc-400 focus:border-blue-500 focus:bg-white focus:ring-2 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:focus:border-blue-400 dark:focus:bg-zinc-900 dark:focus:ring-blue-500/30"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label
                htmlFor="auth-password"
                className="mb-1.5 block text-[13px] font-medium text-zinc-700 dark:text-zinc-300"
              >
                Password
              </label>
              <input
                id="auth-password"
                name="password"
                type="password"
                autoComplete={isLogin ? "current-password" : "new-password"}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-2xl border border-zinc-200 bg-zinc-50/80 px-4 py-3.5 text-[16px] text-zinc-900 outline-none ring-zinc-300/50 transition placeholder:text-zinc-400 focus:border-blue-500 focus:bg-white focus:ring-2 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:focus:border-blue-400 dark:focus:bg-zinc-900 dark:focus:ring-blue-500/30"
                placeholder="At least 6 characters"
              />
            </div>

            {error ? (
              <p
                className="rounded-2xl bg-red-500/10 px-3 py-2.5 text-[13px] font-medium text-red-700 dark:bg-red-500/15 dark:text-red-200"
                role="alert"
              >
                {error}
              </p>
            ) : null}
            {info ? (
              <p className="rounded-2xl bg-emerald-500/10 px-3 py-2.5 text-[13px] font-medium text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200">
                {info}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center rounded-2xl bg-blue-600 py-3.5 text-[15px] font-semibold text-white shadow-lg shadow-blue-600/25 transition hover:bg-blue-700 active:scale-[0.99] disabled:opacity-60 dark:bg-blue-500 dark:hover:bg-blue-400"
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              {busy ? "Please wait…" : isLogin ? "Log in" : "Create account"}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-[12px] leading-relaxed text-zinc-500 dark:text-zinc-500">
          Use the email and password you set in Supabase Auth. If sign-up requires
          email confirmation, check your inbox before logging in.
        </p>
      </div>
    </div>
  );
}

function MissingSupabaseEnvScreen() {
  const clientDiag = useMemo(() => getSupabasePublicEnvDiagnostics(), []);
  const [serverDiag, setServerDiag] = useState<{
    serverProcessSeesUrl: boolean;
    serverProcessSeesKey: boolean;
    serverValidPair: boolean;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dev/supabase-env-status")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data) setServerDiag(data);
      })
      .catch(() => {
        if (!cancelled) setServerDiag(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex min-h-dvh flex-col justify-center bg-[#F2F2F7] px-4 py-10 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] dark:bg-zinc-950">
      <div className="mx-auto w-full max-w-md">
        <h1 className="text-center text-[22px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Supabase is not configured
        </h1>
        <p className="mt-3 text-center text-[15px] leading-relaxed text-zinc-600 dark:text-zinc-400">
          This screen means the app cannot read both{" "}
          <code className="rounded bg-zinc-200/80 px-1 py-0.5 text-[12px] dark:bg-zinc-800">
            NEXT_PUBLIC_SUPABASE_URL
          </code>{" "}
          and{" "}
          <code className="rounded bg-zinc-200/80 px-1 py-0.5 text-[12px] dark:bg-zinc-800">
            NEXT_PUBLIC_SUPABASE_ANON_KEY
          </code>{" "}
          (names must match exactly, including{" "}
          <code className="rounded bg-zinc-200/80 px-1 py-0.5 text-[12px] dark:bg-zinc-800">
            NEXT_PUBLIC_
          </code>
          ).
        </p>

        <div className="mt-6 rounded-[22px] border border-zinc-200/80 bg-white/95 p-5 shadow-lg dark:border-zinc-800 dark:bg-zinc-900/95">
          <p className="text-[13px] font-semibold text-zinc-800 dark:text-zinc-200">
            What this browser build sees
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-400">
            URL value length:{" "}
            <span className="font-mono font-medium text-zinc-900 dark:text-zinc-100">
              {clientDiag.urlChars}
            </span>{" "}
            · Key value length:{" "}
            <span className="font-mono font-medium text-zinc-900 dark:text-zinc-100">
              {clientDiag.keyChars}
            </span>
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-400">
            Valid pair after cleanup:{" "}
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">
              {clientDiag.validPair ? "yes" : "no"}
            </span>
          </p>
          {serverDiag ? (
            <div className="mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-700">
              <p className="text-[13px] font-semibold text-zinc-800 dark:text-zinc-200">
                What the dev server sees (Node)
              </p>
              <p className="mt-2 text-[13px] text-zinc-600 dark:text-zinc-400">
                URL set:{" "}
                <span className="font-medium text-zinc-900 dark:text-zinc-100">
                  {serverDiag.serverProcessSeesUrl ? "yes" : "no"}
                </span>{" "}
                · Key set:{" "}
                <span className="font-medium text-zinc-900 dark:text-zinc-100">
                  {serverDiag.serverProcessSeesKey ? "yes" : "no"}
                </span>{" "}
                · Valid pair:{" "}
                <span className="font-medium text-zinc-900 dark:text-zinc-100">
                  {serverDiag.serverValidPair ? "yes" : "no"}
                </span>
              </p>
              {serverDiag.serverValidPair && !clientDiag.validPair ? (
                <p className="mt-3 rounded-xl bg-amber-500/15 px-3 py-2 text-[13px] font-medium text-amber-900 dark:bg-amber-500/10 dark:text-amber-100">
                  The server sees your keys, but this tab’s JavaScript bundle does not.
                  Stop the dev server, delete the{" "}
                  <code className="rounded bg-amber-950/20 px-1 font-mono text-[12px] dark:bg-amber-400/20">
                    .next
                  </code>{" "}
                  folder, then run{" "}
                  <code className="rounded bg-amber-950/20 px-1 font-mono text-[12px] dark:bg-amber-400/20">
                    npm run dev
                  </code>{" "}
                  again so Next can embed the new env values.
                </p>
              ) : null}
              {!serverDiag.serverValidPair ? (
                <p className="mt-3 rounded-xl bg-zinc-100 px-3 py-2 text-[13px] text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                  The dev server still does not see both variables. The file must be
                  named{" "}
                  <code className="rounded bg-zinc-200 px-1 font-mono text-[12px] dark:bg-zinc-700">
                    .env.local
                  </code>{" "}
                  (not{" "}
                  <code className="rounded bg-zinc-200 px-1 font-mono text-[12px] dark:bg-zinc-700">
                    .env.local.txt
                  </code>
                  ) next to <code className="font-mono text-[12px]">package.json</code>,
                  then fully restart{" "}
                  <code className="font-mono text-[12px]">npm run dev</code>.
                </p>
              ) : null}
            </div>
          ) : (
            <p className="mt-3 text-[12px] text-zinc-500 dark:text-zinc-500">
              Could not load dev server check (ignore if you are not running{" "}
              <code className="font-mono">next dev</code>).
            </p>
          )}
        </div>

        <div className="mt-6 rounded-[22px] border border-zinc-200/80 bg-white/95 p-5 shadow-lg dark:border-zinc-800 dark:bg-zinc-900/95">
          <p className="text-[13px] font-medium text-zinc-700 dark:text-zinc-300">
            Example <code className="font-mono text-[12px]">.env.local</code> (no spaces
            around <code className="font-mono text-[12px]">=</code>):
          </p>
          <pre className="mt-3 overflow-x-auto rounded-2xl bg-zinc-900 p-4 text-left text-[12px] leading-relaxed text-zinc-100">
            {`NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...`}
          </pre>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [missingSupabaseEnv, setMissingSupabaseEnv] = useState(false);
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authView, setAuthView] = useState<AuthView>("login");

  const [tab, setTab] = useState<TabId>("today");
  const [gyms, setGyms] = useState<GymRow[]>([]);
  const [classes, setClasses] = useState<ClassWithGym[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [dataBanner, setDataBanner] = useState<string | null>(null);
  const [saveBusy, setSaveBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ClassWithGym | null>(null);

  const [newGymName, setNewGymName] = useState("");
  const [newGymColour, setNewGymColour] = useState<string>(
    GYM_COLOUR_OPTIONS[0].value,
  );
  const [newGymPay, setNewGymPay] = useState("");

  const [editingGymId, setEditingGymId] = useState<string | null>(null);
  const [editGymName, setEditGymName] = useState("");
  const [editGymColour, setEditGymColour] = useState("");
  const [editGymPay, setEditGymPay] = useState("");

  const [newClassGymId, setNewClassGymId] = useState("");
  const [newClassTitle, setNewClassTitle] = useState("");
  const [newClassDate, setNewClassDate] = useState(() =>
    toLocalISODate(new Date()),
  );
  const [newClassTime, setNewClassTime] = useState("18:30");
  const [newClassEndTime, setNewClassEndTime] = useState("19:30");
  const [newClassRecurring, setNewClassRecurring] = useState(false);

  const userId = session?.user.id ?? "";

  const todayStr = useMemo(() => toLocalISODate(new Date()), []);

  const today = new Date();
  const dateLine = today.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const todayClasses = useMemo(
    () =>
      classes
        .filter((c) => c.class_date === todayStr)
        .sort((a, b) => a.start_time.localeCompare(b.start_time)),
    [classes, todayStr],
  );

  const newClassScheduleWarning = useMemo(() => {
    const newStart = parseClockToMinutes(newClassTime);
    const newEnd = parseClockToMinutes(newClassEndTime);
    if (
      newStart === null ||
      newEnd === null ||
      newEnd <= newStart
    ) {
      return null;
    }
    const sameDay = classes.filter((c) => c.class_date === newClassDate);
    const hits: ClassWithGym[] = [];
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
        `${c.title} (${formatTimeRangeFromDb(c.start_time, c.end_time)})${
          c.gyms?.name ? ` — ${c.gyms.name}` : ""
        }`,
    );
    return `This slot is within ${MIN_SCHEDULE_GAP_MIN} minutes of another class on that day: ${bits.join("; ")}. You can still save if you meant to.`;
  }, [classes, newClassDate, newClassTime, newClassEndTime]);

  const calendarGroups = useMemo(() => {
    const sorted = [...classes].sort(
      (a, b) =>
        b.class_date.localeCompare(a.class_date) ||
        a.start_time.localeCompare(b.start_time),
    );
    const map = new Map<string, ClassWithGym[]>();
    for (const c of sorted) {
      const list = map.get(c.class_date) ?? [];
      list.push(c);
      map.set(c.class_date, list);
    }
    return Array.from(map.entries()).map(([dateStr, items]) => {
      const { heading, sub, isPast } = formatClassDateHeading(dateStr, todayStr);
      return { dateStr, heading, subheading: sub, isPast, items };
    });
  }, [classes, todayStr]);

  const calendarUntaughtCount = useMemo(
    () => classes.filter((c) => !c.taught).length,
    [classes],
  );

  const unpaid = useMemo(() => {
    return classes
      .filter((c) => c.taught && !c.paid && c.gyms)
      .map((c) => ({
        id: c.id,
        classTitle: c.title,
        gymName: c.gyms!.name,
        gymColour: c.gyms!.colour,
        taughtOn: new Date(`${c.class_date}T12:00:00`).toLocaleDateString(
          "en-US",
          { month: "short", day: "numeric" },
        ),
        amountCents:
          c.earn_per_class_cents ??
          c.gyms?.pay_per_class_cents ??
          0,
      }));
  }, [classes]);

  const taughtTodayCount = useMemo(
    () => todayClasses.filter((c) => c.taught).length,
    [todayClasses],
  );

  const outstandingCents = useMemo(
    () => unpaid.reduce((sum, p) => sum + p.amountCents, 0),
    [unpaid],
  );

  const deleteSeriesIdList = useMemo(
    () =>
      deleteTarget
        ? collectRecurringSeriesIdsAtOrAfter(deleteTarget, classes)
        : [],
    [deleteTarget, classes],
  );

  const addClassSelectedGym = useMemo(
    () => gyms.find((g) => g.id === newClassGymId),
    [gyms, newClassGymId],
  );

  const loadData = useCallback(async () => {
    if (!supabase) return;
    setDataError(null);
    setDataLoading(true);
    try {
      const [gRes, cRes] = await Promise.all([
        supabase.from("gyms").select("*").order("name"),
        supabase
          .from("classes")
          .select("*, gyms(*)")
          .order("class_date", { ascending: true }),
      ]);
      if (gRes.error) throw gRes.error;
      if (cRes.error) throw cRes.error;
      setGyms((gRes.data as GymRow[]) ?? []);
      setClasses((cRes.data as ClassWithGym[]) ?? []);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Could not load data.";
      setDataError(
        msg.toLowerCase().includes("relation") ||
          msg.toLowerCase().includes("schema cache") ||
          msg.toLowerCase().includes("does not exist")
          ? "Database tables or columns are out of date. In Supabase → SQL Editor, run supabase/migrations/001_gyms_and_classes.sql (full file). If you already ran an older 001, run 002–007 as needed; if you see class_name errors, run 007_classes_rename_class_name_to_title.sql."
          : msg,
      );
      setGyms([]);
      setClasses([]);
    } finally {
      setDataLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    if (!session || !supabase) return;
    queueMicrotask(() => {
      void loadData();
    });
  }, [session, supabase, loadData]);

  useEffect(() => {
    if (gyms.length === 0) return;
    queueMicrotask(() => {
      setNewClassGymId((prev) =>
        prev && gyms.some((g) => g.id === prev) ? prev : gyms[0].id,
      );
    });
  }, [gyms]);

  useEffect(() => {
    if (tab !== "settings") {
      queueMicrotask(() => setEditingGymId(null));
    }
  }, [tab]);

  const headerSubtitle = useMemo(() => {
    switch (tab) {
      case "today":
        return dateLine;
      case "calendar":
        return "Past and upcoming classes — mark as taught";
      case "payments":
        return "Taught classes awaiting payout";
      case "settings":
        return "Add classes and manage gyms";
      default:
        return "";
    }
  }, [tab, dateLine]);

  async function markTaught(id: string) {
    if (!supabase) return;
    setSaveBusy(true);
    setDataBanner(null);
    const { error } = await supabase
      .from("classes")
      .update({ taught: true })
      .eq("id", id);
    if (error) setDataBanner(error.message);
    await loadData();
    setSaveBusy(false);
  }

  async function markPaid(id: string) {
    if (!supabase) return;
    setSaveBusy(true);
    setDataBanner(null);
    const { error } = await supabase
      .from("classes")
      .update({ paid: true })
      .eq("id", id);
    if (error) setDataBanner(error.message);
    await loadData();
    setSaveBusy(false);
  }

  const deleteClassesByIds = useCallback(
    async (ids: string[]) => {
      if (!supabase || ids.length === 0) return;
      setSaveBusy(true);
      setDataBanner(null);
      const chunk = 50;
      try {
        for (let i = 0; i < ids.length; i += chunk) {
          const slice = ids.slice(i, i + chunk);
          const { error } = await supabase.from("classes").delete().in("id", slice);
          if (error) {
            setDataBanner(error.message);
            return;
          }
        }
        setDeleteTarget(null);
        await loadData();
      } finally {
        setSaveBusy(false);
      }
    },
    [supabase, loadData],
  );

  async function handleCreateGym(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase || !userId) return;
    const pounds = parseFloat(newGymPay);
    if (!newGymName.trim()) {
      setDataBanner("Enter a gym name.");
      return;
    }
    if (Number.isNaN(pounds) || pounds < 0) {
      setDataBanner("Enter a valid pay per class (e.g. 75 or 68.50).");
      return;
    }
    const cents = Math.round(pounds * 100);
    setSaveBusy(true);
    setDataBanner(null);
    const { error } = await supabase.from("gyms").insert({
      user_id: userId,
      name: newGymName.trim(),
      colour: newGymColour,
      pay_per_class_cents: cents,
    });
    if (error) setDataBanner(error.message);
    else {
      setNewGymName("");
      setNewGymPay("");
      setNewGymColour(GYM_COLOUR_OPTIONS[0].value);
    }
    await loadData();
    setSaveBusy(false);
  }

  async function handleUpdateGym(e: FormEvent<HTMLFormElement>, gymId: string) {
    e.preventDefault();
    if (!supabase || !userId) return;
    const pounds = parseFloat(editGymPay);
    if (!editGymName.trim()) {
      setDataBanner("Enter a gym name.");
      return;
    }
    if (Number.isNaN(pounds) || pounds < 0) {
      setDataBanner("Enter a valid pay per class (e.g. 75 or 68.50).");
      return;
    }
    const cents = Math.round(pounds * 100);
    setSaveBusy(true);
    setDataBanner(null);
    const { error } = await supabase
      .from("gyms")
      .update({
        name: editGymName.trim(),
        colour: editGymColour,
        pay_per_class_cents: cents,
      })
      .eq("id", gymId);
    if (error) setDataBanner(error.message);
    else setEditingGymId(null);
    await loadData();
    setSaveBusy(false);
  }

  async function handleCreateClass(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase || !userId) return;
    if (!newClassGymId) {
      setDataBanner("Add a gym first, then pick it for this class.");
      return;
    }
    if (!newClassTitle.trim()) {
      setDataBanner("Enter a class name.");
      return;
    }
    const startSql =
      newClassTime.length === 5 ? `${newClassTime}:00` : newClassTime;
    const endSql =
      newClassEndTime.length === 5 ? `${newClassEndTime}:00` : newClassEndTime;
    const startM = parseClockToMinutes(newClassTime);
    const endM = parseClockToMinutes(newClassEndTime);
    if (startM === null || endM === null) {
      setDataBanner("Enter valid start and end times.");
      return;
    }
    if (endM <= startM) {
      setDataBanner("End time must be after start time.");
      return;
    }
    setSaveBusy(true);
    setDataBanner(null);
    const earnCents =
      gyms.find((g) => g.id === newClassGymId)?.pay_per_class_cents ?? 0;
    const { error } = await supabase.from("classes").insert({
      user_id: userId,
      gym_id: newClassGymId,
      title: newClassTitle.trim(),
      class_date: newClassDate,
      start_time: startSql,
      end_time: endSql,
      recurring: newClassRecurring,
      earn_per_class_cents: earnCents,
    });
    if (error) setDataBanner(error.message);
    else {
      setNewClassTitle("");
      setNewClassRecurring(false);
    }
    await loadData();
    setSaveBusy(false);
  }

  function classesThisMonthForGym(gymId: string) {
    const now = new Date();
    const y = now.getFullYear();
    const m0 = now.getMonth();
    return classes.filter((c) => {
      if (c.gym_id !== gymId) return false;
      const [yy, mm] = c.class_date.split("-").map(Number);
      return yy === y && mm - 1 === m0;
    }).length;
  }

  useEffect(() => {
    const client = createClient();
    if (!client) {
      queueMicrotask(() => {
        setMissingSupabaseEnv(true);
        setAuthReady(true);
      });
      return;
    }

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });

    client.auth
      .getSession()
      .then(({ data: { session: s } }) => {
        setSession(s);
      })
      .finally(() => {
        setSupabase(client);
        setAuthReady(true);
      });

    return () => subscription.unsubscribe();
  }, []);

  if (!authReady) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-[#F2F2F7] dark:bg-zinc-950">
        <div
          className="h-9 w-9 animate-spin rounded-full border-2 border-zinc-200 border-t-blue-600 dark:border-zinc-700 dark:border-t-blue-400"
          aria-hidden
        />
        <p className="text-[14px] font-medium text-zinc-500 dark:text-zinc-400">
          Loading…
        </p>
      </div>
    );
  }

  if (missingSupabaseEnv) {
    return <MissingSupabaseEnvScreen />;
  }

  if (!session) {
    if (!supabase) {
      return (
        <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-[#F2F2F7] dark:bg-zinc-950">
          <div
            className="h-9 w-9 animate-spin rounded-full border-2 border-zinc-200 border-t-blue-600 dark:border-zinc-700 dark:border-t-blue-400"
            aria-hidden
          />
          <p className="text-[14px] font-medium text-zinc-500 dark:text-zinc-400">
            Loading…
          </p>
        </div>
      );
    }
    return (
      <AuthScreen
        supabase={supabase}
        view={authView}
        onViewChange={setAuthView}
      />
    );
  }

  return (
    <div className="relative min-h-dvh bg-[#F2F2F7] pb-28 pt-[max(0.75rem,env(safe-area-inset-top))] dark:bg-zinc-950">
      <div className="mx-auto w-full max-w-lg px-4 pt-3 sm:px-5 sm:pt-5">
        <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-zinc-900 sm:text-[30px] dark:text-zinc-50">
              Dance Class Tracker
            </h1>
            <p className="mt-1.5 text-[15px] font-medium text-zinc-500 dark:text-zinc-400">
              {headerSubtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void supabase?.auth.signOut()}
            className="shrink-0 self-start rounded-full border border-zinc-200/90 bg-white px-4 py-2 text-[13px] font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50 active:scale-[0.98] dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700/80"
            style={{ WebkitTapHighlightColor: "transparent" }}
          >
            Log out
          </button>
        </header>

        {dataError ? (
          <div
            className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-medium text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
            role="alert"
          >
            {dataError}
          </div>
        ) : null}
        {dataBanner ? (
          <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] font-medium text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
            {dataBanner}
          </div>
        ) : null}
        {dataLoading ? (
          <p className="mb-4 text-center text-[13px] text-zinc-500 dark:text-zinc-400">
            Syncing with Supabase…
          </p>
        ) : null}

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
              {todayClasses.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-zinc-200/90 bg-zinc-50/50 px-4 py-8 text-center text-[14px] text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/30 dark:text-zinc-400">
                  No classes today. Add one in the{" "}
                  <button
                    type="button"
                    className="font-semibold text-blue-600 underline dark:text-blue-400"
                    onClick={() => setTab("settings")}
                  >
                    Settings
                  </button>{" "}
                  tab.
                </p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {todayClasses.map((c) => {
                    const g = c.gyms;
                    return (
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
                              {g ? (
                                <GymBadge name={g.name} colour={g.colour} filled />
                              ) : null}
                            </div>
                            {c.recurring ? (
                              <p className="mt-1 text-[12px] font-medium text-blue-600 dark:text-blue-400">
                                Recurring
                              </p>
                            ) : null}
                            <p className="mt-2 text-[18px] font-semibold tabular-nums leading-snug text-zinc-900 dark:text-zinc-50">
                              {formatTimeRangeFromDb(c.start_time, c.end_time)}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-stretch justify-end gap-2 sm:shrink-0">
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(c)}
                              disabled={saveBusy}
                              className="rounded-2xl border border-rose-200/90 bg-white px-4 py-2.5 text-[14px] font-semibold text-rose-700 shadow-sm hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900/50 dark:bg-zinc-900 dark:text-rose-300 dark:hover:bg-rose-950/40"
                              style={{ WebkitTapHighlightColor: "transparent" }}
                            >
                              Delete
                            </button>
                            <button
                              type="button"
                              onClick={() => void markTaught(c.id)}
                              disabled={c.taught || saveBusy}
                              className={`rounded-2xl px-4 py-2.5 text-[14px] font-semibold transition active:scale-[0.98] sm:min-w-[9.5rem] ${
                                c.taught
                                  ? "cursor-default border border-emerald-500/25 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                                  : "bg-blue-600 text-white shadow-sm shadow-blue-600/25 hover:bg-blue-700 disabled:opacity-60 dark:bg-blue-500 dark:hover:bg-blue-400"
                              }`}
                              style={{ WebkitTapHighlightColor: "transparent" }}
                            >
                              {c.taught ? "Taught" : "Mark as taught"}
                            </button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </SectionCard>
          </div>
        ) : null}

        {tab === "calendar" ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between rounded-2xl border border-zinc-200/70 bg-white/70 px-4 py-3 text-[13px] text-zinc-600 shadow-sm backdrop-blur-sm dark:border-zinc-800/70 dark:bg-zinc-900/60 dark:text-zinc-300">
              <span>
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {classes.length}
                </span>{" "}
                scheduled
              </span>
              <span className="tabular-nums text-zinc-500 dark:text-zinc-400">
                {calendarUntaughtCount} not taught
              </span>
            </div>
            {calendarGroups.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-zinc-200/90 bg-zinc-50/50 px-4 py-8 text-center text-[14px] text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/30 dark:text-zinc-400">
                No classes yet. Add one in{" "}
                <button
                  type="button"
                  className="font-semibold text-blue-600 underline dark:text-blue-400"
                  onClick={() => setTab("settings")}
                >
                  Settings
                </button>
                .
              </p>
            ) : (
              calendarGroups.map((group) => (
                <SectionCard
                  key={group.dateStr}
                  title={group.heading}
                  subtitle={group.subheading}
                >
                  <div>
                    {group.items.map((c) => (
                      <ClassRowCalendar
                        key={c.id}
                        title={c.title}
                        gymName={c.gyms?.name ?? "Gym"}
                        gymColour={c.gyms?.colour ?? "violet"}
                        timeRangeLabel={formatTimeRangeFromDb(
                          c.start_time,
                          c.end_time,
                        )}
                        recurring={c.recurring}
                        taught={c.taught}
                        onMarkTaught={() => void markTaught(c.id)}
                        onAskDelete={() => setDeleteTarget(c)}
                        saveBusy={saveBusy}
                      />
                    ))}
                  </div>
                </SectionCard>
              ))
            )}
          </div>
        ) : null}

        {tab === "payments" ? (
          <div className="flex flex-col gap-4">
            <div className="overflow-hidden rounded-[22px] border border-amber-500/25 bg-gradient-to-br from-amber-50 to-white p-4 shadow-sm dark:from-amber-950/40 dark:to-zinc-900 dark:border-amber-400/20">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-800/90 dark:text-amber-200/90">
                Total outstanding
              </p>
              <p className="mt-1 text-[32px] font-semibold tabular-nums tracking-tight text-amber-950 dark:text-amber-50">
                {formatGbp(outstandingCents)}
              </p>
              <p className="mt-1 text-[13px] text-amber-900/70 dark:text-amber-200/70">
                {unpaid.length === 0
                  ? "You are all caught up."
                  : `${unpaid.length} class${unpaid.length === 1 ? "" : "es"} at each gym’s pay rate`}
              </p>
            </div>

            <SectionCard
              title="Taught, not paid"
              subtitle="Amount uses the rate stored on each class when it was added. Changing a gym’s pay only affects new classes."
            >
              {unpaid.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-200/90 bg-zinc-50/50 px-4 py-10 text-center dark:border-zinc-700 dark:bg-zinc-800/30">
                  <p className="text-[15px] font-medium text-zinc-700 dark:text-zinc-200">
                    Nothing outstanding
                  </p>
                  <p className="mt-1 text-[13px] text-zinc-500 dark:text-zinc-400">
                    Mark classes as taught, then paid, to clear this list.
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
                            <GymBadge name={p.gymName} colour={p.gymColour} />
                            <span className="text-[12px] text-zinc-500 dark:text-zinc-400">
                              Taught {p.taughtOn}
                            </span>
                          </div>
                          <p className="mt-2 text-[18px] font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
                            {formatGbp(p.amountCents)}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-stretch justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const row = classes.find((x) => x.id === p.id);
                              if (row) setDeleteTarget(row);
                            }}
                            disabled={saveBusy}
                            className="shrink-0 rounded-2xl border border-rose-200/90 bg-white px-4 py-2.5 text-[14px] font-semibold text-rose-700 shadow-sm hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900/50 dark:bg-zinc-900 dark:text-rose-300 dark:hover:bg-rose-950/40"
                            style={{ WebkitTapHighlightColor: "transparent" }}
                          >
                            Delete
                          </button>
                          <button
                            type="button"
                            onClick={() => void markPaid(p.id)}
                            disabled={saveBusy}
                            className="shrink-0 rounded-2xl border border-zinc-200/90 bg-white px-4 py-2.5 text-[14px] font-semibold text-zinc-900 shadow-sm hover:bg-zinc-50 active:scale-[0.98] disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700/80"
                            style={{ WebkitTapHighlightColor: "transparent" }}
                          >
                            Mark as paid
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          </div>
        ) : null}

        {tab === "settings" ? (
          <div className="flex flex-col gap-4">
            <SectionCard
              title="Add a class"
              subtitle="Pick gym, date, start and end time. Recurring is saved as a flag for your records."
            >
              <form onSubmit={handleCreateClass} className="flex flex-col gap-3">
                <div>
                  <label className="mb-1 block text-[13px] font-medium text-zinc-700 dark:text-zinc-300">
                    Gym
                  </label>
                  <div className="flex items-stretch gap-3">
                    <select
                      value={newClassGymId}
                      onChange={(e) => setNewClassGymId(e.target.value)}
                      className="min-w-0 flex-1 rounded-2xl border border-zinc-200 bg-zinc-50/80 px-3 py-3 text-[15px] text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-50"
                      disabled={gyms.length === 0}
                    >
                      {gyms.length === 0 ? (
                        <option value="">Add a gym first</option>
                      ) : (
                        gyms.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.name}
                          </option>
                        ))
                      )}
                    </select>
                    {gyms.length > 0 ? (
                      <div
                        className={`h-12 w-12 shrink-0 rounded-2xl shadow-inner ${swatchClassForColour(
                          addClassSelectedGym?.colour ?? "violet",
                        )}`}
                        title={
                          addClassSelectedGym
                            ? `${addClassSelectedGym.name} colour`
                            : "Gym colour"
                        }
                        aria-hidden
                      />
                    ) : null}
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-[13px] font-medium text-zinc-700 dark:text-zinc-300">
                    Class name
                  </label>
                  <input
                    value={newClassTitle}
                    onChange={(e) => setNewClassTitle(e.target.value)}
                    className="w-full rounded-2xl border border-zinc-200 bg-zinc-50/80 px-4 py-3 text-[16px] text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-50"
                    placeholder="e.g. Intermediate Hip Hop"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[13px] font-medium text-zinc-700 dark:text-zinc-300">
                    Date
                  </label>
                  <input
                    type="date"
                    value={newClassDate}
                    onChange={(e) => setNewClassDate(e.target.value)}
                    className="w-full rounded-2xl border border-zinc-200 bg-zinc-50/80 px-3 py-3 text-[15px] text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-50"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-[13px] font-medium text-zinc-700 dark:text-zinc-300">
                      Start time
                    </label>
                    <input
                      type="time"
                      value={newClassTime}
                      onChange={(e) => setNewClassTime(e.target.value)}
                      className="w-full rounded-2xl border border-zinc-200 bg-zinc-50/80 px-3 py-3 text-[15px] text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-50"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[13px] font-medium text-zinc-700 dark:text-zinc-300">
                      End time
                    </label>
                    <input
                      type="time"
                      value={newClassEndTime}
                      onChange={(e) => setNewClassEndTime(e.target.value)}
                      className="w-full rounded-2xl border border-zinc-200 bg-zinc-50/80 px-3 py-3 text-[15px] text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-50"
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-[14px] text-zinc-700 dark:text-zinc-300">
                  <input
                    type="checkbox"
                    checked={newClassRecurring}
                    onChange={(e) => setNewClassRecurring(e.target.checked)}
                    className="h-4 w-4 rounded border-zinc-300"
                  />
                  Recurring class
                </label>
                {newClassScheduleWarning ? (
                  <p
                    role="status"
                    className="rounded-2xl border border-amber-500/35 bg-amber-50/90 px-3 py-2.5 text-[13px] leading-snug text-amber-950 dark:border-amber-400/25 dark:bg-amber-950/35 dark:text-amber-100"
                  >
                    {newClassScheduleWarning}
                  </p>
                ) : null}
                <button
                  type="submit"
                  disabled={saveBusy || gyms.length === 0}
                  className="rounded-2xl bg-blue-600 py-3 text-[15px] font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-400"
                >
                  {saveBusy ? "Saving…" : "Save class"}
                </button>
              </form>
            </SectionCard>

            <SectionCard
              title="Add a gym"
              subtitle="Name, colour tag, and what you earn per class there."
            >
              <form onSubmit={handleCreateGym} className="flex flex-col gap-3">
                <div>
                  <label className="mb-1 block text-[13px] font-medium text-zinc-700 dark:text-zinc-300">
                    Gym name
                  </label>
                  <input
                    value={newGymName}
                    onChange={(e) => setNewGymName(e.target.value)}
                    className="w-full rounded-2xl border border-zinc-200 bg-zinc-50/80 px-4 py-3 text-[16px] text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-50"
                    placeholder="e.g. Rhythm Studio"
                  />
                </div>
                <GymColourPicker value={newGymColour} onChange={setNewGymColour} />
                <div>
                  <label className="mb-1 block text-[13px] font-medium text-zinc-700 dark:text-zinc-300">
                    Pay per class (£)
                  </label>
                  <input
                    inputMode="decimal"
                    value={newGymPay}
                    onChange={(e) => setNewGymPay(e.target.value)}
                    className="w-full rounded-2xl border border-zinc-200 bg-zinc-50/80 px-4 py-3 text-[16px] text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-50"
                    placeholder="e.g. 20 or 21.50"
                  />
                </div>
                <button
                  type="submit"
                  disabled={saveBusy}
                  className="rounded-2xl bg-blue-600 py-3 text-[15px] font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-400"
                >
                  {saveBusy ? "Saving…" : "Save gym"}
                </button>
              </form>
            </SectionCard>

            {gyms.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-zinc-200/90 bg-zinc-50/50 px-4 py-8 text-center text-[14px] text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/30 dark:text-zinc-400">
                No gyms yet. Add your first gym above.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {gyms.map((g) => {
                  const editing = editingGymId === g.id;
                  const colourOk = GYM_COLOUR_OPTIONS.some((o) => o.value === g.colour);
                  return (
                    <section
                      key={g.id}
                      className="rounded-[22px] border border-zinc-200/80 bg-white/90 p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-8px_rgba(0,0,0,0.12)] backdrop-blur-sm dark:border-zinc-800/80 dark:bg-zinc-900/80 dark:shadow-[0_1px_2px_rgba(0,0,0,0.2),0_8px_28px_-10px_rgba(0,0,0,0.45)]"
                    >
                      {editing ? (
                        <form
                          onSubmit={(e) => void handleUpdateGym(e, g.id)}
                          className="flex flex-col gap-3"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-50">
                              Edit gym
                            </p>
                            <button
                              type="button"
                              disabled={saveBusy}
                              onClick={() => setEditingGymId(null)}
                              className="shrink-0 rounded-full px-3 py-1 text-[13px] font-semibold text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                            >
                              Cancel
                            </button>
                          </div>
                          <div>
                            <label className="mb-1 block text-[13px] font-medium text-zinc-700 dark:text-zinc-300">
                              Gym name
                            </label>
                            <input
                              value={editGymName}
                              onChange={(e) => setEditGymName(e.target.value)}
                              className="w-full rounded-2xl border border-zinc-200 bg-zinc-50/80 px-4 py-3 text-[16px] text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-50"
                            />
                          </div>
                          <GymColourPicker
                            value={editGymColour}
                            onChange={setEditGymColour}
                          />
                          <div>
                            <label className="mb-1 block text-[13px] font-medium text-zinc-700 dark:text-zinc-300">
                              Pay per class (£)
                            </label>
                            <input
                              inputMode="decimal"
                              value={editGymPay}
                              onChange={(e) => setEditGymPay(e.target.value)}
                              className="w-full rounded-2xl border border-zinc-200 bg-zinc-50/80 px-4 py-3 text-[16px] text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-50"
                            />
                          </div>
                          <button
                            type="submit"
                            disabled={saveBusy}
                            className="rounded-2xl bg-blue-600 py-3 text-[15px] font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-400"
                          >
                            {saveBusy ? "Saving…" : "Save changes"}
                          </button>
                        </form>
                      ) : (
                        <>
                          <div className="flex gap-3">
                            <div
                              className={`mt-0.5 h-11 w-11 shrink-0 rounded-2xl ${swatchClassForColour(g.colour)}`}
                              aria-hidden
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div className="flex min-w-0 flex-wrap items-center gap-2">
                                  <h2 className="text-[17px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                                    {g.name}
                                  </h2>
                                  <GymBadge name={g.name} colour={g.colour} />
                                </div>
                                <button
                                  type="button"
                                  disabled={saveBusy}
                                  onClick={() => {
                                    setEditingGymId(g.id);
                                    setEditGymName(g.name);
                                    setEditGymColour(
                                      colourOk
                                        ? g.colour
                                        : GYM_COLOUR_OPTIONS[0].value,
                                    );
                                    setEditGymPay(
                                      String(g.pay_per_class_cents / 100),
                                    );
                                    setDataBanner(null);
                                  }}
                                  className="shrink-0 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-[13px] font-semibold text-zinc-800 shadow-sm hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700/80"
                                  style={{
                                    WebkitTapHighlightColor: "transparent",
                                  }}
                                >
                                  Edit
                                </button>
                              </div>
                              <div className="mt-4 grid grid-cols-2 gap-3">
                                <div className="rounded-2xl bg-zinc-50/90 p-3 ring-1 ring-zinc-200/60 dark:bg-zinc-800/50 dark:ring-zinc-700/50">
                                  <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                                    Pay / class
                                  </p>
                                  <p className="mt-1 text-[15px] font-semibold text-zinc-900 dark:text-zinc-50">
                                    {formatGbp(g.pay_per_class_cents)}
                                  </p>
                                </div>
                                <div className="rounded-2xl bg-zinc-50/90 p-3 ring-1 ring-zinc-200/60 dark:bg-zinc-800/50 dark:ring-zinc-700/50">
                                  <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                                    This month
                                  </p>
                                  <p className="mt-1 text-[15px] font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
                                    {classesThisMonthForGym(g.id)} classes
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                    </section>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}
      </div>

      {deleteTarget ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
          role="presentation"
          onClick={() => {
            if (!saveBusy) setDeleteTarget(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-class-title"
            className="w-full max-w-md rounded-[22px] border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="delete-class-title"
              className="text-[17px] font-semibold text-zinc-900 dark:text-zinc-50"
            >
              Delete class?
            </h2>
            <p className="mt-2 text-[14px] leading-snug text-zinc-600 dark:text-zinc-400">
              <span className="font-medium text-zinc-800 dark:text-zinc-200">
                {deleteTarget.title}
              </span>
              {deleteTarget.gyms ? (
                <>
                  {" "}
                  <span className="text-zinc-500">at</span> {deleteTarget.gyms.name}
                </>
              ) : null}
              <span className="mt-1 block text-[13px] text-zinc-500 dark:text-zinc-500">
                {new Date(`${deleteTarget.class_date}T12:00:00`).toLocaleDateString(
                  "en-GB",
                  { weekday: "short", day: "numeric", month: "short", year: "numeric" },
                )}{" "}
                · {formatTimeRangeFromDb(deleteTarget.start_time, deleteTarget.end_time)}
              </span>
            </p>
            {deleteTarget.recurring ? (
              <>
                <p className="mt-3 text-[13px] leading-snug text-zinc-600 dark:text-zinc-400">
                  This entry is marked recurring. Remove only this date, or every
                  matching recurring class from this slot onward (same gym and
                  name, on or after this date and start time).
                </p>
                <p className="mt-2 text-[12px] font-medium text-zinc-500 dark:text-zinc-500">
                  {deleteSeriesIdList.length} matching row
                  {deleteSeriesIdList.length === 1 ? "" : "s"} in your data.
                </p>
              </>
            ) : (
              <p className="mt-3 text-[13px] text-zinc-600 dark:text-zinc-400">
                This removes the class from your schedule.
              </p>
            )}
            {deleteTarget.taught && !deleteTarget.paid ? (
              <p className="mt-3 rounded-xl border border-amber-200/80 bg-amber-50/90 px-3 py-2 text-[12px] font-medium text-amber-950 dark:border-amber-400/25 dark:bg-amber-950/35 dark:text-amber-100">
                This class is taught and not paid yet — deleting removes it from
                outstanding pay too.
              </p>
            ) : null}
            <div className="mt-5 flex flex-col gap-2">
              {deleteTarget.recurring ? (
                <>
                  <button
                    type="button"
                    disabled={saveBusy}
                    onClick={() => void deleteClassesByIds([deleteTarget.id])}
                    className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 py-3 text-[14px] font-semibold text-zinc-900 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700/80"
                    style={{ WebkitTapHighlightColor: "transparent" }}
                  >
                    Only this one
                  </button>
                  <button
                    type="button"
                    disabled={saveBusy}
                    onClick={() => void deleteClassesByIds(deleteSeriesIdList)}
                    className="w-full rounded-2xl bg-rose-600 py-3 text-[14px] font-semibold text-white shadow-sm hover:bg-rose-700 disabled:opacity-50 dark:bg-rose-500 dark:hover:bg-rose-400"
                    style={{ WebkitTapHighlightColor: "transparent" }}
                  >
                    This and all future matching ({deleteSeriesIdList.length})
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  disabled={saveBusy}
                  onClick={() => void deleteClassesByIds([deleteTarget.id])}
                  className="w-full rounded-2xl bg-rose-600 py-3 text-[14px] font-semibold text-white shadow-sm hover:bg-rose-700 disabled:opacity-50 dark:bg-rose-500 dark:hover:bg-rose-400"
                  style={{ WebkitTapHighlightColor: "transparent" }}
                >
                  Delete class
                </button>
              )}
              <button
                type="button"
                disabled={saveBusy}
                onClick={() => setDeleteTarget(null)}
                className="w-full rounded-2xl py-3 text-[14px] font-semibold text-zinc-600 hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800/80"
                style={{ WebkitTapHighlightColor: "transparent" }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

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
              { id: "settings" as const, label: "Settings", Icon: IconSettings },
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
