import type { ReactNode } from "react";

import { GymBadge } from "@/components/gym-badge";
import {
  gymColourHex,
  gymColourUsesLightForeground,
} from "@/lib/gym-colours";

/** Lifts buttons off gym-coloured card backgrounds (especially when hues match). */
const BTN_ELEVATION =
  "shadow-[0_1px_2px_rgba(0,0,0,0.22),0_5px_16px_rgba(0,0,0,0.32)] ring-1 ring-black/15";

const BTN_ELEVATION_STRONG =
  "shadow-[0_1px_3px_rgba(0,0,0,0.28),0_6px_20px_rgba(0,0,0,0.4)] ring-1 ring-black/20";

export const classCardDeleteButtonClass = `rounded-2xl border border-rose-200/90 bg-white px-4 py-2.5 text-[14px] font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50 ${BTN_ELEVATION}`;

export const classCardNeutralButtonClass = `rounded-2xl border border-zinc-200/90 bg-white px-4 py-2.5 text-[14px] font-semibold text-zinc-900 hover:bg-zinc-50 active:scale-[0.98] disabled:opacity-50 ${BTN_ELEVATION}`;

export function classCardTaughtButtonClass(taught: boolean) {
  const base =
    "rounded-2xl px-4 py-2.5 text-[14px] font-semibold transition active:scale-[0.98] sm:min-w-[9.5rem] disabled:opacity-60";
  if (taught) {
    return `${base} border border-emerald-600/35 bg-white text-emerald-800 hover:bg-emerald-50 ${BTN_ELEVATION}`;
  }
  return `${base} bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400 ${BTN_ELEVATION_STRONG}`;
}

export function ClassSplitCard({
  title,
  gymName,
  gymColour,
  highlight,
  detail,
  titleStrikethrough = false,
  onInfoClick,
  actions,
  className = "",
}: {
  title: string;
  gymName: string;
  gymColour: string;
  /** Large text at the bottom of the coloured panel (time, pay amount, etc.). */
  highlight?: string;
  detail?: ReactNode;
  titleStrikethrough?: boolean;
  onInfoClick?: () => void;
  actions: ReactNode;
  className?: string;
}) {
  const lightFg = gymColourUsesLightForeground(gymColour);
  const titleClass = lightFg ? "text-white" : "text-amber-950";
  const highlightClass = lightFg ? "text-white" : "text-amber-950";
  const ringClass = lightFg ? "ring-white/25" : "ring-amber-950/20";

  const infoPanel = (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <p
          className={`text-[16px] font-semibold tracking-tight ${titleClass} ${
            titleStrikethrough ? "opacity-70 line-through" : ""
          }`}
        >
          {title}
        </p>
        <GymBadge name={gymName} colour={gymColour} variant="onColour" />
      </div>
      {detail ? (
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[12px] font-medium">
          {detail}
        </div>
      ) : null}
      {highlight ? (
        <p
          className={`mt-3 text-[18px] font-semibold tabular-nums leading-snug ${highlightClass}`}
        >
          {highlight}
        </p>
      ) : null}
    </>
  );

  return (
    <article
      className={`flex flex-col gap-3 overflow-hidden rounded-2xl p-3.5 shadow-sm ring-1 sm:flex-row sm:items-center sm:justify-between sm:p-4 ${ringClass} ${className}`}
      style={{ backgroundColor: gymColourHex(gymColour) }}
    >
      {onInfoClick ? (
        <button
          type="button"
          onClick={onInfoClick}
          className="min-w-0 flex-1 text-left"
          style={{ WebkitTapHighlightColor: "transparent" }}
        >
          {infoPanel}
        </button>
      ) : (
        <div className="min-w-0 flex-1">{infoPanel}</div>
      )}
      <div className="flex shrink-0 flex-col items-stretch justify-center gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
        {actions}
      </div>
    </article>
  );
}

/** Recurring label styled for the coloured panel. */
export function ClassSplitRecurringLabel({
  lightForeground,
}: {
  lightForeground: boolean;
}) {
  return (
    <span
      className={
        lightForeground
          ? "text-sky-200"
          : "text-blue-800"
      }
    >
      Recurring
    </span>
  );
}
