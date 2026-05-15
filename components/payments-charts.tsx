import type {
  GymIncomeRow,
  MonthIncomeBucket,
  PaymentAnalytics,
} from "@/lib/payments-analytics";

const PAID = "#10b981";
const OUTSTANDING = "#f59e0b";

const COLOUR_CHART: Record<string, string> = {
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

function formatGbp(cents: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatGbpCompact(cents: number) {
  const pounds = cents / 100;
  if (pounds >= 1000) return `£${(pounds / 1000).toFixed(1)}k`;
  return formatGbp(cents);
}

function ChartLegend({
  items,
}: {
  items: { colour: string; label: string }[];
}) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-sm"
            style={{ backgroundColor: item.colour }}
            aria-hidden
          />
          <span className="text-[11px] text-zinc-600 dark:text-zinc-400">
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <p className="rounded-xl border border-dashed border-zinc-200/90 bg-zinc-50/50 px-4 py-8 text-center text-[13px] text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800/30 dark:text-zinc-400">
      {message}
    </p>
  );
}

function MonthlyIncomeChart({ buckets }: { buckets: MonthIncomeBucket[] }) {
  const hasData = buckets.some((b) => b.taughtCount > 0);
  if (!hasData) {
    return (
      <EmptyChart message="Mark classes as taught to see monthly income here." />
    );
  }

  const max = Math.max(
    ...buckets.map((b) => b.paidCents + b.outstandingCents),
    1,
  );
  const w = 280;
  const h = 112;
  const padX = 8;
  const padTop = 8;
  const padBottom = 22;
  const chartH = h - padTop - padBottom;
  const barW = (w - padX * 2) / buckets.length;
  const innerW = barW * 0.55;

  return (
    <div>
      <ChartLegend
        items={[
          { colour: PAID, label: "Paid" },
          { colour: OUTSTANDING, label: "Awaiting pay" },
        ]}
      />
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="mt-3 w-full text-zinc-400 dark:text-zinc-500"
        role="img"
        aria-label="Monthly income from taught classes, split by paid and awaiting payment"
      >
        <line
          x1={padX}
          y1={padTop + chartH}
          x2={w - padX}
          y2={padTop + chartH}
          stroke="currentColor"
          strokeOpacity={0.35}
        />
        {buckets.map((b, i) => {
          const total = b.paidCents + b.outstandingCents;
          const x = padX + i * barW + (barW - innerW) / 2;
          const paidH = (b.paidCents / max) * chartH;
          const outH = (b.outstandingCents / max) * chartH;
          const baseY = padTop + chartH;
          return (
            <g key={b.key}>
              {total > 0 ? (
                <>
                  {b.paidCents > 0 ? (
                    <rect
                      x={x}
                      y={baseY - paidH}
                      width={innerW}
                      height={Math.max(paidH, 2)}
                      rx={3}
                      fill={PAID}
                    />
                  ) : null}
                  {b.outstandingCents > 0 ? (
                    <rect
                      x={x}
                      y={baseY - paidH - outH}
                      width={innerW}
                      height={Math.max(outH, 2)}
                      rx={3}
                      fill={OUTSTANDING}
                    />
                  ) : null}
                </>
              ) : (
                <rect
                  x={x}
                  y={baseY - 2}
                  width={innerW}
                  height={2}
                  rx={1}
                  fill="currentColor"
                  opacity={0.2}
                />
              )}
              <text
                x={x + innerW / 2}
                y={h - 6}
                textAnchor="middle"
                className="fill-current text-[9px]"
              >
                {b.label}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="mt-1 grid grid-cols-3 gap-2 text-center">
        {buckets
          .filter((b) => b.taughtCount > 0)
          .slice(-3)
          .map((b) => (
            <div key={b.key} className="rounded-lg bg-zinc-50/80 px-2 py-1.5 dark:bg-zinc-800/50">
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                {b.label}
              </p>
              <p className="text-[12px] font-semibold tabular-nums text-zinc-800 dark:text-zinc-200">
                {formatGbp(b.paidCents + b.outstandingCents)}
              </p>
            </div>
          ))}
      </div>
    </div>
  );
}

function CumulativePaidChart({
  points,
}: {
  points: { label: string; cumulativeCents: number }[];
}) {
  const hasData = points.some((p) => p.cumulativeCents > 0);
  if (!hasData) {
    return (
      <EmptyChart message="Paid income will build up here as you mark classes paid." />
    );
  }

  const w = 280;
  const h = 112;
  const padX = 12;
  const padY = 12;
  const padBottom = 22;
  const chartW = w - padX * 2;
  const chartH = h - padY - padBottom;
  const max = Math.max(...points.map((p) => p.cumulativeCents), 1);

  const coords = points.map((p, i) => {
    const x =
      points.length === 1
        ? padX + chartW / 2
        : padX + (i / (points.length - 1)) * chartW;
    const y = padY + chartH - (p.cumulativeCents / max) * chartH;
    return { ...p, x, y };
  });

  const linePath = coords
    .map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${c.y}`)
    .join(" ");
  const areaPath = `${linePath} L ${coords[coords.length - 1].x} ${padY + chartH} L ${coords[0].x} ${padY + chartH} Z`;

  return (
    <div>
      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
        Running total of paid classes (by class date)
      </p>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="mt-2 w-full"
        role="img"
        aria-label="Cumulative paid income over recent months"
      >
        <defs>
          <linearGradient id="paidArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={PAID} stopOpacity={0.35} />
            <stop offset="100%" stopColor={PAID} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <line
          x1={padX}
          y1={padY + chartH}
          x2={w - padX}
          y2={padY + chartH}
          stroke="currentColor"
          className="text-zinc-300 dark:text-zinc-600"
          strokeOpacity={0.5}
        />
        <path d={areaPath} fill="url(#paidArea)" />
        <path
          d={linePath}
          fill="none"
          stroke={PAID}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {coords.map((c) => (
          <g key={c.label}>
            <circle cx={c.x} cy={c.y} r={3.5} fill={PAID} />
            <text
              x={c.x}
              y={h - 6}
              textAnchor="middle"
              className="fill-zinc-500 text-[9px] dark:fill-zinc-400"
            >
              {c.label}
            </text>
          </g>
        ))}
      </svg>
      <p className="mt-1 text-right text-[13px] font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
        {formatGbp(points[points.length - 1]?.cumulativeCents ?? 0)} total paid
      </p>
    </div>
  );
}

function ClassesPerMonthChart({ buckets }: { buckets: MonthIncomeBucket[] }) {
  const hasData = buckets.some((b) => b.taughtCount > 0);
  if (!hasData) return null;

  const max = Math.max(...buckets.map((b) => b.taughtCount), 1);
  const w = 280;
  const h = 72;
  const padX = 8;
  const barW = (w - padX * 2) / buckets.length;
  const innerW = barW * 0.5;

  return (
    <div className="mt-4 border-t border-zinc-200/70 pt-4 dark:border-zinc-700/60">
      <p className="text-[13px] font-medium text-zinc-700 dark:text-zinc-300">
        Classes taught per month
      </p>
      <svg viewBox={`0 0 ${w} ${h}`} className="mt-2 w-full" aria-hidden>
        {buckets.map((b, i) => {
          const barH = (b.taughtCount / max) * (h - 16);
          const x = padX + i * barW + (barW - innerW) / 2;
          return (
            <rect
              key={b.key}
              x={x}
              y={h - 12 - barH}
              width={innerW}
              height={Math.max(barH, b.taughtCount > 0 ? 3 : 0)}
              rx={3}
              className="fill-blue-500/80"
            />
          );
        })}
      </svg>
    </div>
  );
}

function GymIncomeChart({ rows }: { rows: GymIncomeRow[] }) {
  if (rows.length === 0) {
    return <EmptyChart message="No taught classes this month yet." />;
  }

  const max = Math.max(
    ...rows.map((r) => r.paidCents + r.outstandingCents),
    1,
  );

  return (
    <div>
      <ChartLegend
        items={[
          { colour: PAID, label: "Paid" },
          { colour: OUTSTANDING, label: "Awaiting pay" },
        ]}
      />
      <ul className="mt-3 flex flex-col gap-3">
        {rows.map((row) => {
          const total = row.paidCents + row.outstandingCents;
          const paidPct = (row.paidCents / max) * 100;
          const outPct = (row.outstandingCents / max) * 100;
          const fill = COLOUR_CHART[row.colour] ?? COLOUR_CHART.violet;
          return (
            <li key={row.gymId}>
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="truncate text-[13px] font-medium text-zinc-800 dark:text-zinc-200">
                  {row.name}
                </span>
                <span className="shrink-0 text-[12px] font-semibold tabular-nums text-zinc-700 dark:text-zinc-300">
                  {formatGbp(total)}
                </span>
              </div>
              <div
                className="flex h-2.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800"
                role="presentation"
              >
                {row.paidCents > 0 ? (
                  <div
                    style={{ width: `${paidPct}%`, backgroundColor: PAID }}
                    title={`Paid ${formatGbp(row.paidCents)}`}
                  />
                ) : null}
                {row.outstandingCents > 0 ? (
                  <div
                    style={{
                      width: `${outPct}%`,
                      backgroundColor: OUTSTANDING,
                    }}
                    title={`Awaiting ${formatGbp(row.outstandingCents)}`}
                  />
                ) : null}
                {total === 0 ? (
                  <div className="h-full w-full bg-zinc-200/60 dark:bg-zinc-700/60" />
                ) : null}
              </div>
              <p className="mt-0.5 text-[11px] text-zinc-500">
                {row.taughtCount} class{row.taughtCount === 1 ? "" : "es"}
                <span
                  className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle"
                  style={{ backgroundColor: fill }}
                  aria-hidden
                />
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function SummaryTiles({
  summary,
}: {
  summary: PaymentAnalytics["summary"];
}) {
  const tiles = [
    {
      label: "Paid this month",
      value: formatGbp(summary.thisMonthPaidCents),
      hint: `${summary.thisMonthTaughtCount} taught`,
    },
    {
      label: "Awaiting pay (month)",
      value: formatGbp(summary.thisMonthOutstandingCents),
      hint: "Taught, not paid",
    },
    {
      label: "All-time paid",
      value: formatGbp(summary.allTimePaidCents),
      hint: `${formatGbpCompact(summary.allTimeOutstandingCents)} still owed`,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      {tiles.map((t) => (
        <div
          key={t.label}
          className="rounded-2xl border border-zinc-200/70 bg-white/80 px-3 py-2.5 dark:border-zinc-700/60 dark:bg-zinc-800/40"
        >
          <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            {t.label}
          </p>
          <p className="mt-0.5 text-[18px] font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
            {t.value}
          </p>
          <p className="text-[11px] text-zinc-500">{t.hint}</p>
        </div>
      ))}
    </div>
  );
}

export function PaymentsChartsSection({
  analytics,
}: {
  analytics: PaymentAnalytics;
}) {
  return (
    <div className="flex flex-col gap-4">
      <SummaryTiles summary={analytics.summary} />

      <section className="rounded-[22px] border border-zinc-200/80 bg-white/90 p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-8px_rgba(0,0,0,0.12)] backdrop-blur-sm dark:border-zinc-800/80 dark:bg-zinc-900/80">
        <h2 className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-50">
          Income per month
        </h2>
        <p className="mt-0.5 text-[13px] text-zinc-500 dark:text-zinc-400">
          Taught classes by calendar month (last 6 months)
        </p>
        <div className="mt-3">
          <MonthlyIncomeChart buckets={analytics.monthly} />
          <ClassesPerMonthChart buckets={analytics.monthly} />
        </div>
      </section>

      <section className="rounded-[22px] border border-zinc-200/80 bg-white/90 p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-8px_rgba(0,0,0,0.12)] backdrop-blur-sm dark:border-zinc-800/80 dark:bg-zinc-900/80">
        <h2 className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-50">
          Payment history
        </h2>
        <p className="mt-0.5 text-[13px] text-zinc-500 dark:text-zinc-400">
          Cumulative paid earnings over time
        </p>
        <div className="mt-3">
          <CumulativePaidChart points={analytics.cumulativePaid} />
        </div>
      </section>

      <section className="rounded-[22px] border border-zinc-200/80 bg-white/90 p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-8px_rgba(0,0,0,0.12)] backdrop-blur-sm dark:border-zinc-800/80 dark:bg-zinc-900/80">
        <h2 className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-50">
          This month by gym
        </h2>
        <p className="mt-0.5 text-[13px] text-zinc-500 dark:text-zinc-400">
          Where this month&apos;s taught-class pay comes from
        </p>
        <div className="mt-3">
          <GymIncomeChart rows={analytics.gymThisMonth} />
        </div>
      </section>
    </div>
  );
}
