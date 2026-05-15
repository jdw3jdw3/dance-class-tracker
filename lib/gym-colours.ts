/** Hex fills for gym colour keys (charts, timelines). */
export const GYM_COLOUR_HEX: Record<string, string> = {
  violet: "#8b5cf6",
  emerald: "#10b981",
  amber: "#f59e0b",
  rose: "#f43f5e",
  sky: "#0ea5e9",
  orange: "#f97316",
  teal: "#14b8a6",
  indigo: "#6366f1",
  fuchsia: "#d946ef",
};

export function gymColourHex(colour: string): string {
  return GYM_COLOUR_HEX[colour] ?? GYM_COLOUR_HEX.violet;
}

/** Amber uses dark text on its fill; other gym colours use white. */
export function gymColourUsesLightForeground(colour: string): boolean {
  return colour !== "amber";
}
