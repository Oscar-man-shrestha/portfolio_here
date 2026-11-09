"use client";

// Contribution City time-travel: a scrubber (and a play button) that rebuilds the year day by day, with a running
// total, and a day panel. Tapping a tower (or "Details" for the scrubbed day) lists that day's public commits,
// fetched from GitHub's public search in the visitor's browser when asked (no key; GitHub allows a few searches a
// minute). Contributions also count pull requests, reviews and private work, so a busy day can show few commits.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fmtDay, type Day } from "@/lib/contrib";
import { GITHUB_USER } from "@/lib/site";

type Commit = { repo: string; message: string; url: string };
type DayInfo = { index: number; state: "loading" | "done" | "error"; commits: Commit[]; total: number; note?: string };

const cache = new Map<string, { commits: Commit[]; total: number }>();

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
    if (hit) { setInfo({ index, state: "done", ...hit }); return; }
    if (d.count === 0) { setInfo({ index, state: "done", commits: [], total: 0 }); return; }
    setInfo({ index, state: "loading", commits: [], total: 0 });
    try {
      const q = encodeURIComponent(`author:${GITHUB_USER} author-date:${d.date}`);
      const res = await fetch(`https://api.github.com/search/commits?q=${q}&sort=author-date&order=desc&per_page=8`, { headers: { Accept: "application/vnd.github+json" } });
      if (res.status === 403 || res.status === 429) { setInfo({ index, state: "error", commits: [], total: 0, note: "GitHub's limit for searches without an account is a few a minute. Try again in a moment." }); return; }
      if (!res.ok) throw new Error(String(res.status));
      const j = (await res.json()) as { total_count: number; items: { html_url: string; repository: { full_name: string }; commit: { message: string } }[] };
      const commits = j.items.map((c) => ({ repo: c.repository.full_name.split("/")[1], message: c.commit.message.split("\n")[0], url: c.html_url }));
      cache.set(d.date, { commits, total: j.total_count });
      setInfo((cur) => (cur?.index === index ? { index, state: "done", commits, total: j.total_count } : cur));
    } catch {
      setInfo({ index, state: "error", commits: [], total: 0, note: "Couldn't reach GitHub just now." });
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
          {info.state === "loading" && <p className="ctime__msg">Asking GitHub for that day&apos;s public commits…</p>}
          {info.state === "error" && <p className="ctime__msg">{info.note}</p>}
          {info.state === "done" && (info.commits.length ? (
            <>
              <ul className="ctime__list">
                {info.commits.map((c) => (
                  <li key={c.url}><a href={c.url} target="_blank" rel="noopener noreferrer"><span className="mono">{c.repo}</span>{c.message}<span className="sr-only"> (opens in a new tab)</span></a></li>
                ))}
              </ul>
              <p className="ctime__msg">{info.total > info.commits.length ? `${info.total} public commits that day; the newest ${info.commits.length} shown. ` : ""}Pull requests, reviews and private work count too.</p>
            </>
          ) : (
            <p className="ctime__msg">{sel.count ? "No public commits dated that day. Contributions also count pull requests, reviews and private work." : "No contributions that day."}</p>
          ))}
        </div>
      )}
    </div>
  );
}
