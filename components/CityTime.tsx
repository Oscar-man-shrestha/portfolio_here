"use client";

// Contribution City time-travel: a scrubber (and a play button) that rebuilds the year day by day, with a running
// total, and a day panel. Tapping a tower (or "Details" for the scrubbed day) lists that day's public commits and
// the pull requests and issues opened that day, from this site's /api/day (which asks GitHub and caches the answer,
// so privacy blockers and GitHub's per-visitor limits don't get in the way). Contributions also count reviews and
// private work, so a busy day can show little here.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DayActivity } from "@/app/api/day/route";
import { fmtDay, type Day } from "@/lib/contrib";

type Found = Pick<DayActivity, "commits" | "commitTotal" | "opened">;
type DayInfo = { index: number; state: "loading" | "done" | "error"; found?: Found; note?: string };

const cache = new Map<string, Found>();

export default function CityTime({ days }: { days: Day[] }) {
  const last = days.length - 1;
  const [upto, setUpto] = useState(last);
  const [playing, setPlaying] = useState(false);
  const [info, setInfo] = useState<DayInfo | null>(null);
  const raf = useRef(0);
  const running = useMemo(() => { let s = 0; return days.map((d) => (s += d.count)); }, [days]);

  const push = (u: number) => dispatchEvent(new CustomEvent("oms:city-upto", { detail: { upto: u >= last ? null : u } }));

  // play: the whole year in about six seconds
  useEffect(() => {
    if (!playing) return;
    const t0 = performance.now(), from = upto >= last ? 0 : upto;
    const step = (t: number) => {
      const u = Math.min(last, from + ((t - t0) / 6000) * days.length);
      push(u);
      setUpto(Math.floor(u));
      if (u >= last) { setPlaying(false); return; }
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  const show = useCallback(async (index: number) => {
    const d = days[index];
    dispatchEvent(new CustomEvent("oms:city-sel", { detail: { index } }));
    const hit = cache.get(d.date);
    if (hit) { setInfo({ index, state: "done", found: hit }); return; }
    if (d.count === 0) { setInfo({ index, state: "done", found: { commits: [], commitTotal: 0, opened: [] } }); return; }
    setInfo({ index, state: "loading" });
    try {
      const res = await fetch(`/api/day?date=${d.date}`);
      const j = (await res.json()) as DayActivity & { error?: string };
      if (!res.ok) { setInfo((cur) => (cur?.index === index ? { index, state: "error", note: j.error ?? "Couldn't reach GitHub just now." } : cur)); return; }
      const found = { commits: j.commits, commitTotal: j.commitTotal, opened: j.opened };
      cache.set(d.date, found);
      setInfo((cur) => (cur?.index === index ? { index, state: "done", found } : cur));
    } catch {
      setInfo((cur) => (cur?.index === index ? { index, state: "error", note: "Couldn't reach GitHub just now." } : cur));
    }
  }, [days]);

  useEffect(() => {
    const onDay = (e: Event) => show((e as CustomEvent<{ index: number }>).detail.index);
    addEventListener("oms:city-day", onDay);
    return () => removeEventListener("oms:city-day", onDay);
  }, [show]);

  const d = days[upto];
  const sel = info ? days[info.index] : null;
  return (
    <div className="ctime">
      <div className="ctime__bar">
        <button type="button" className="ctime__play hud" onClick={() => setPlaying((p) => !p)} aria-label={playing ? "Pause the replay" : "Replay the year"}>
          {playing ? "❚❚" : "▶"}<span>{playing ? "Pause" : "Replay year"}</span>
        </button>
        <input
          className="ctime__range" type="range" min={0} max={last} step={1} value={upto}
          aria-label="Scrub through the year" aria-valuetext={`${fmtDay(d.date)}: ${running[upto]} contributions so far`}
          onChange={(e) => { const u = +e.target.value; setPlaying(false); setUpto(u); push(u); }}
        />
        <p className="ctime__now hud" aria-live="off">
          <span>{fmtDay(d.date)}</span> <b>{running[upto].toLocaleString("en-US")}</b> so far
        </p>
        <button type="button" className="ctime__go hud" onClick={() => show(upto)}>Details ↘</button>
      </div>
      {info && sel && (
        <div className="ctime__day" aria-live="polite">
          <div className="ctime__head hud">
            <span><b>{sel.count}</b> contribution{sel.count === 1 ? "" : "s"} · {fmtDay(sel.date)}</span>
            <button type="button" className="ctime__x" aria-label="Close the day" onClick={() => { setInfo(null); dispatchEvent(new CustomEvent("oms:city-sel", { detail: { index: null } })); }}>×</button>
          </div>
          {info.state === "loading" && <p className="ctime__msg">Asking GitHub for that day&apos;s public activity…</p>}
          {info.state === "error" && <p className="ctime__msg">{info.note}</p>}
          {info.state === "done" && info.found && (info.found.commits.length || info.found.opened.length ? (
            <>
              <ul className="ctime__list">
                {info.found.opened.map((o) => (
                  <li key={o.url}><a href={o.url} target="_blank" rel="noopener noreferrer"><span className="mono">{o.kind === "pr" ? "PR" : "Issue"} · {o.repo}</span>{o.title}<span className="sr-only"> (opens in a new tab)</span></a></li>
                ))}
                {info.found.commits.map((c) => (
                  <li key={c.url}><a href={c.url} target="_blank" rel="noopener noreferrer"><span className="mono">{c.repo}</span>{c.message}<span className="sr-only"> (opens in a new tab)</span></a></li>
                ))}
              </ul>
              <p className="ctime__msg">{info.found.commitTotal > info.found.commits.length ? `${info.found.commitTotal} public commits that day; the newest ${info.found.commits.length} shown. ` : ""}Reviews and private work count too.</p>
            </>
          ) : (
            <p className="ctime__msg">{sel.count ? "No public commits, pull requests or issues found for that day. GitHub also counts reviews and work in private repositories." : "No contributions that day."}</p>
          ))}
        </div>
      )}
    </div>
  );
}
