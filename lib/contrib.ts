// GitHub contribution days (fetched live by lib/github) and the stats the site shows about them.
export type Day = { date: string; count: number };

export function summarise(list: Day[]) {
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

export type ContribStats = ReturnType<typeof summarise>;

export const fmtDay = (iso: string) =>
  new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
export const fmtMonth = (ym: string) =>
  new Date(ym + "-01T00:00:00Z").toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
