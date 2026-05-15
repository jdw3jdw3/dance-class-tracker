import { gymColourUsesLightForeground } from "@/lib/gym-colours";

/** Solid gym-colour tags (matches colour swatch palette). */
const GYM_BADGE_CLASS: Record<string, string> = {
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

function badgeClassForColour(colour: string) {
  return GYM_BADGE_CLASS[colour] ?? GYM_BADGE_CLASS.violet;
}

export function GymBadge({
  name,
  colour,
  variant = "default",
  className = "",
}: {
  name: string;
  colour: string;
  variant?: "default" | "onColour";
  className?: string;
}) {
  const onColour = variant === "onColour";
  const lightFg = gymColourUsesLightForeground(colour);
  const onColourClass = onColour
    ? lightFg
      ? "bg-black/15 text-white ring-1 ring-white/45"
      : "bg-black/10 text-amber-950 ring-1 ring-amber-950/35"
    : badgeClassForColour(colour);

  return (
    <span
      className={`inline-flex max-w-full shrink-0 truncate rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ${onColourClass} ${className}`}
    >
      {name}
    </span>
  );
}
