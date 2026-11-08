// Real GitHub contribution data (53 weeks × 7 days of [ISO date, count]), summarised at build time.
import raw from "@/data/contrib.json";

export type Day = { date: string; count: number };

const weeks = raw as [string, number][][];
export const days: Day[] = weeks.flat().map(([date, count]) => ({ date, count }));

function summarise(list: Day[]) {
  let total = 0, active = 0, longest = 0, run = 0;
  let best: Day = list[0];
  const months = new Map<string, number>();
  for (const d of list) {
    total += d.count;
    if (d.count > 0) { active++; run++; longest = Math.max(longest, run); } else run = 0;
    if (d.count > best.count) best = d;
    months.set(d.date.slice(0, 7), (months.get(d.date.slice(0, 7)) ?? 0) + d.count);
  }
  const [bestMonth, bestMonthCount] = [...months.entries()].sort((a, b) => b[1] - a[1])[0];
  return {
    total,
    active,
    span: list.length,
    longest,
    best,
    bestMonth,
    bestMonthCount,
    from: list[0].date,
    to: list[list.length - 1].date,
  };
}

export const contrib = summarise(days);

export const fmtDay = (iso: string) =>
  new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
export const fmtMonth = (ym: string) =>
  new Date(ym + "-01T00:00:00Z").toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
