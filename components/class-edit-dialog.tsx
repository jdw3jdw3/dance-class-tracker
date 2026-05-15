"use client";

import { useMemo, useState, type FormEvent } from "react";

import { GymBadge } from "@/components/gym-badge";
import { scheduleConflictWarning } from "@/lib/schedule-conflict";

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

function swatchClassForColour(colour: string) {
  return COLOUR_SWATCH[colour] ?? COLOUR_SWATCH.violet;
}

export type ClassEditGym = {
  id: string;
  name: string;
  colour: string;
  pay_per_class_cents: number;
};

export type ClassEditTarget = {
  id: string;
  gym_id: string;
  title: string;
  class_date: string;
  start_time: string;
  end_time: string;
  recurring: boolean;
  taught: boolean;
  paid: boolean;
  earn_per_class_cents: number;
  gyms: {
    name: string;
    colour: string;
    pay_per_class_cents: number;
  } | null;
};

export type ClassEditSaveValues = {
  gymId: string;
  title: string;
  classDate: string;
  startTime: string;
  endTime: string;
  recurring: boolean;
  payPounds: string;
};

function timeFromDbForInput(t: string) {
  const part = t.includes("T") ? (t.split("T")[1] ?? t) : t;
  const [hh, mm] = part.split(":").map((x) => parseInt(x, 10));
  if (Number.isNaN(hh)) return "18:30";
  return `${String(hh).padStart(2, "0")}:${String(mm ?? 0).padStart(2, "0")}`;
}

function centsToPoundsInput(cents: number) {
  return String(cents / 100);
}

function formatGbp(cents: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(cents / 100);
}

export function ClassEditDialog({
  cls,
  gyms,
  allClasses,
  saveBusy,
  dateMin,
  onClose,
  onSave,
  onToggleTaught,
  onDelete,
}: {
  cls: ClassEditTarget;
  gyms: ClassEditGym[];
  allClasses: ClassEditTarget[];
  saveBusy: boolean;
  /** If set, date input cannot be before this (YYYY-MM-DD). */
  dateMin?: string;
  onClose: () => void;
  onSave: (values: ClassEditSaveValues) => void;
  onToggleTaught: () => void;
  onDelete: () => void;
}) {
  const [gymId, setGymId] = useState(cls.gym_id);
  const [title, setTitle] = useState(cls.title);
  const [classDate, setClassDate] = useState(cls.class_date);
  const [startTime, setStartTime] = useState(timeFromDbForInput(cls.start_time));
  const [endTime, setEndTime] = useState(timeFromDbForInput(cls.end_time));
  const [recurring, setRecurring] = useState(cls.recurring);
  const [payPounds, setPayPounds] = useState(
    centsToPoundsInput(cls.earn_per_class_cents),
  );

  const selectedGym = gyms.find((g) => g.id === gymId);

  const scheduleWarning = useMemo(
    () =>
      scheduleConflictWarning(
        allClasses,
        classDate,
        startTime,
        endTime,
        cls.id,
      ),
    [allClasses, classDate, startTime, endTime, cls.id],
  );

  function handleGymChange(nextGymId: string) {
    setGymId(nextGymId);
    const g = gyms.find((x) => x.id === nextGymId);
    if (g) setPayPounds(centsToPoundsInput(g.pay_per_class_cents));
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    onSave({
      gymId,
      title,
      classDate,
      startTime,
      endTime,
      recurring,
      payPounds,
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
      role="presentation"
      onClick={() => {
        if (!saveBusy) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="class-edit-title"
        className="max-h-[min(92dvh,40rem)] w-full max-w-md overflow-y-auto rounded-[22px] border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <h2
            id="class-edit-title"
            className="text-[17px] font-semibold text-zinc-900 dark:text-zinc-50"
          >
            Edit class
          </h2>
          <button
            type="button"
            disabled={saveBusy}
            onClick={onClose}
            className="shrink-0 rounded-full px-3 py-1 text-[13px] font-semibold text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <GymBadge
            name={cls.gyms?.name ?? "Gym"}
            colour={cls.gyms?.colour ?? "violet"}
          />
          {cls.taught ? (
            <span className="text-[12px] font-semibold text-emerald-700 dark:text-emerald-300">
              Taught
            </span>
          ) : null}
          {cls.taught && !cls.paid ? (
            <span className="text-[12px] font-semibold text-amber-700 dark:text-amber-300">
              Awaiting pay
            </span>
          ) : null}
          {cls.taught && cls.paid ? (
            <span className="text-[12px] font-semibold text-emerald-700 dark:text-emerald-300">
              Paid
            </span>
          ) : null}
        </div>

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-[13px] font-medium text-zinc-700 dark:text-zinc-300">
              Gym
            </label>
            <div className="flex items-stretch gap-3">
              <select
                value={gymId}
                onChange={(e) => handleGymChange(e.target.value)}
                className="min-w-0 flex-1 rounded-2xl border border-zinc-200 bg-zinc-50/80 px-3 py-3 text-[15px] text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-50"
              >
                {gyms.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
              <div
                className={`h-12 w-12 shrink-0 rounded-2xl shadow-inner ${swatchClassForColour(
                  selectedGym?.colour ?? "violet",
                )}`}
                aria-hidden
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-[13px] font-medium text-zinc-700 dark:text-zinc-300">
              Class name
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-2xl border border-zinc-200 bg-zinc-50/80 px-4 py-3 text-[16px] text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-50"
            />
          </div>
          <div>
            <label className="mb-1 block text-[13px] font-medium text-zinc-700 dark:text-zinc-300">
              Pay for this class (£)
            </label>
            <input
              inputMode="decimal"
              value={payPounds}
              onChange={(e) => setPayPounds(e.target.value)}
              className="w-full rounded-2xl border border-zinc-200 bg-zinc-50/80 px-4 py-3 text-[16px] text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-50"
              placeholder="e.g. 20 or 21.50"
            />
            {selectedGym ? (
              <p className="mt-1 text-[12px] text-zinc-500 dark:text-zinc-400">
                Gym default is {formatGbp(selectedGym.pay_per_class_cents)}
              </p>
            ) : null}
          </div>
          <div>
            <label className="mb-1 block text-[13px] font-medium text-zinc-700 dark:text-zinc-300">
              Date
            </label>
            <input
              type="date"
              min={dateMin}
              value={classDate}
              onChange={(e) => setClassDate(e.target.value)}
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
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-2xl border border-zinc-200 bg-zinc-50/80 px-3 py-3 text-[15px] text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-50"
              />
            </div>
            <div>
              <label className="mb-1 block text-[13px] font-medium text-zinc-700 dark:text-zinc-300">
                End time
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full rounded-2xl border border-zinc-200 bg-zinc-50/80 px-3 py-3 text-[15px] text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-50"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-[14px] text-zinc-700 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={recurring}
              onChange={(e) => setRecurring(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-300"
            />
            Recurring class
          </label>
          {scheduleWarning ? (
            <p
              role="status"
              className="rounded-2xl border border-amber-500/35 bg-amber-50/90 px-3 py-2.5 text-[13px] leading-snug text-amber-950 dark:border-amber-400/25 dark:bg-amber-950/35 dark:text-amber-100"
            >
              {scheduleWarning}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={saveBusy}
            className="rounded-2xl bg-blue-600 py-3 text-[15px] font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-400"
            style={{ WebkitTapHighlightColor: "transparent" }}
          >
            {saveBusy ? "Saving…" : "Save changes"}
          </button>
        </form>

        <div className="mt-3 flex flex-col gap-2 border-t border-zinc-200/80 pt-3 dark:border-zinc-700/60">
          <button
            type="button"
            disabled={saveBusy}
            onClick={onToggleTaught}
            aria-pressed={cls.taught}
            className={`w-full rounded-2xl py-3 text-[14px] font-semibold shadow-sm disabled:opacity-50 ${
              cls.taught
                ? "border border-emerald-500/25 bg-emerald-500/10 text-emerald-800 hover:bg-emerald-500/20 dark:text-emerald-200"
                : "bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400"
            }`}
            style={{ WebkitTapHighlightColor: "transparent" }}
          >
            {cls.taught ? "Undo taught" : "Mark as taught"}
          </button>
          <button
            type="button"
            disabled={saveBusy}
            onClick={onDelete}
            className="w-full rounded-2xl border border-rose-200/90 py-3 text-[14px] font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900/50 dark:text-rose-300 dark:hover:bg-rose-950/40"
            style={{ WebkitTapHighlightColor: "transparent" }}
          >
            Delete class
          </button>
        </div>
      </div>
    </div>
  );
}
