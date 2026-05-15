"use client";

import { useMemo, useState } from "react";

import { GymBadge } from "@/components/gym-badge";
import { gymColourHex } from "@/lib/gym-colours";
import {
  computeWeekAheadSchedule,
  formatMinutesShort,
  type WeekAheadClassInput,
  type WeekAheadDay,
} from "@/lib/week-ahead-schedule";

const LANE_HEIGHT = 20;
const ROW_PAD = 6;
const EMPTY_ROW_HEIGHT = 40;

function visibleBlockOnRange(
  block: { startMin: number; endMin: number },
  rangeStart: number,
  rangeEnd: number,
): { startMin: number; endMin: number } | null {
  if (block.endMin <= rangeStart || block.startMin >= rangeEnd) return null;
  return {
    startMin: Math.max(block.startMin, rangeStart),
    endMin: Math.min(block.endMin, rangeEnd),
  };
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

function formatTimeRangeFromDb(start: string, end?: string | null) {
  if (end) return `${formatTimeFromDb(start)} – ${formatTimeFromDb(end)}`;
  return formatTimeFromDb(start);
}

function formatGbp(cents: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(cents / 100);
}

function formatClassDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function DayRow({
  day,
  onSelectClass,
}: {
  day: WeekAheadDay;
  onSelectClass: (id: string) => void;
}) {
  const span = Math.max(day.rangeEndMin - day.rangeStartMin, 1);
  const rowHeight = day.hasClasses
    ? day.laneCount * LANE_HEIGHT + ROW_PAD * 2
    : EMPTY_ROW_HEIGHT;

  return (
    <div className="flex gap-3">
      <div className="w-[4.5rem] shrink-0 pt-1">
        <p className="text-[13px] font-semibold leading-tight text-zinc-900 dark:text-zinc-50">
          {day.label}
        </p>
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
          {day.dateSub}
        </p>
      </div>

      <div className="min-w-0 flex-1">
        <div
          className={`relative w-full overflow-hidden rounded-xl border ${
            day.hasClasses
              ? "border-zinc-200/80 bg-zinc-100/70 dark:border-zinc-700/60 dark:bg-zinc-800/50"
              : "border-dashed border-zinc-200/90 bg-zinc-50/50 dark:border-zinc-700 dark:bg-zinc-800/30"
          }`}
          style={{ height: rowHeight }}
        >
          {day.hasClasses ? (
            day.classes.map((block) => {
              const visible = visibleBlockOnRange(
                block,
                day.rangeStartMin,
                day.rangeEndMin,
              );
              if (!visible) return null;

              const leftPct =
                ((visible.startMin - day.rangeStartMin) / span) * 100;
              const widthPct =
                ((visible.endMin - visible.startMin) / span) * 100;
              const fill = gymColourHex(block.colour);

              return (
                <button
                  key={block.id}
                  type="button"
                  className="absolute rounded-md shadow-sm ring-1 ring-black/10 transition hover:brightness-110 hover:ring-2 hover:ring-white/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 dark:ring-white/10 dark:hover:ring-white/40 dark:focus-visible:ring-offset-zinc-900"
                  style={{
                    left: `calc(${leftPct}% + 3px)`,
                    width: `calc(${Math.max(widthPct, 2)}% - 6px)`,
                    top: ROW_PAD + block.lane * LANE_HEIGHT,
                    height: LANE_HEIGHT - 4,
                    backgroundColor: fill,
                    opacity: block.taught ? 0.45 : 1,
                    WebkitTapHighlightColor: "transparent",
                  }}
                  onClick={() => onSelectClass(block.id)}
                  aria-label={`${block.title} at ${block.gymName}, ${formatMinutesShort(block.startMin)} to ${formatMinutesShort(block.endMin)}`}
                />
              );
            })
          ) : (
            <p className="flex h-full items-center justify-center text-[12px] text-zinc-400 dark:text-zinc-500">
              No classes
            </p>
          )}
        </div>
        <div className="mt-1 flex justify-between text-[10px] tabular-nums text-zinc-400 dark:text-zinc-500">
          <span>{formatMinutesShort(day.rangeStartMin)}</span>
          <span>{formatMinutesShort(day.rangeEndMin)}</span>
        </div>
      </div>
    </div>
  );
}

function ClassDetailDialog({
  cls,
  saveBusy,
  onClose,
  onMarkTaught,
  onAskDelete,
}: {
  cls: WeekAheadClassInput;
  saveBusy: boolean;
  onClose: () => void;
  onMarkTaught: () => void;
  onAskDelete: () => void;
}) {
  const gymName = cls.gyms?.name ?? "Gym";
  const gymColour = cls.gyms?.colour ?? "violet";
  const payCents =
    cls.earn_per_class_cents ?? cls.gyms?.pay_per_class_cents ?? 0;

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
        aria-labelledby="week-class-detail-title"
        className="w-full max-w-md rounded-[22px] border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="week-class-detail-title"
          className="text-[17px] font-semibold text-zinc-900 dark:text-zinc-50"
        >
          {cls.title}
        </h2>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <GymBadge name={gymName} colour={gymColour} className="text-[12px] py-1" />
          {cls.recurring ? (
            <span className="text-[12px] font-medium text-blue-600 dark:text-blue-400">
              Recurring
            </span>
          ) : null}
          {cls.taught ? (
            <span className="text-[12px] font-semibold text-emerald-700 dark:text-emerald-300">
              Taught
            </span>
          ) : null}
          {cls.taught && cls.paid ? (
            <span className="text-[12px] font-semibold text-emerald-700 dark:text-emerald-300">
              Paid
            </span>
          ) : null}
          {cls.taught && !cls.paid ? (
            <span className="text-[12px] font-semibold text-amber-700 dark:text-amber-300">
              Awaiting pay
            </span>
          ) : null}
        </div>

        <dl className="mt-4 flex flex-col gap-2.5 text-[14px]">
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-500 dark:text-zinc-400">Date</dt>
            <dd className="text-right font-medium text-zinc-900 dark:text-zinc-100">
              {formatClassDate(cls.class_date)}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-500 dark:text-zinc-400">Time</dt>
            <dd className="text-right font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
              {formatTimeRangeFromDb(cls.start_time, cls.end_time)}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-500 dark:text-zinc-400">Pay</dt>
            <dd className="text-right font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
              {formatGbp(payCents)}
            </dd>
          </div>
        </dl>

        <div className="mt-5 flex flex-col gap-2">
          {!cls.taught ? (
            <button
              type="button"
              disabled={saveBusy}
              onClick={onMarkTaught}
              className="w-full rounded-2xl bg-blue-600 py-3 text-[14px] font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-400"
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              Mark as taught
            </button>
          ) : null}
          <button
            type="button"
            disabled={saveBusy}
            onClick={onAskDelete}
            className="w-full rounded-2xl border border-rose-200/90 py-3 text-[14px] font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900/50 dark:text-rose-300 dark:hover:bg-rose-950/40"
            style={{ WebkitTapHighlightColor: "transparent" }}
          >
            Delete class
          </button>
          <button
            type="button"
            disabled={saveBusy}
            onClick={onClose}
            className="w-full rounded-2xl py-3 text-[14px] font-semibold text-zinc-600 hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800/80"
            style={{ WebkitTapHighlightColor: "transparent" }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export function WeekAheadChart({
  classes,
  todayStr,
  saveBusy = false,
  onMarkTaught,
  onAskDelete,
}: {
  classes: WeekAheadClassInput[];
  todayStr: string;
  saveBusy?: boolean;
  onMarkTaught?: (id: string) => void;
  onAskDelete?: (cls: WeekAheadClassInput) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const days = computeWeekAheadSchedule(classes, todayStr);

  const classById = useMemo(() => {
    const map = new Map<string, WeekAheadClassInput>();
    for (const c of classes) map.set(c.id, c);
    return map;
  }, [classes]);

  const selected = selectedId ? (classById.get(selectedId) ?? null) : null;

  return (
    <>
      <section aria-label="Week ahead schedule">
        <div className="flex flex-col gap-3">
          {days.map((day) => (
            <DayRow
              key={day.dateStr}
              day={day}
              onSelectClass={setSelectedId}
            />
          ))}
        </div>
        <p className="mt-3 text-[11px] text-zinc-500 dark:text-zinc-400">
          Tap a block for full class details. Faded blocks are already taught.
        </p>
      </section>

      {selected ? (
        <ClassDetailDialog
          cls={selected}
          saveBusy={saveBusy}
          onClose={() => setSelectedId(null)}
          onMarkTaught={() => {
            onMarkTaught?.(selected.id);
            setSelectedId(null);
          }}
          onAskDelete={() => {
            setSelectedId(null);
            onAskDelete?.(selected);
          }}
        />
      ) : null}
    </>
  );
}
