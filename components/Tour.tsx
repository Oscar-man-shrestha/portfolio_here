"use client";

// The 60-second tour (lib/tour.ts writes the steps). Each stop moves the page there (the same "oms:guide" and
// "oms:scroll" events OMS-mini uses), waits for it to settle, frames the evidence with a spotlight, and shows
// what OMS-mini says in a card beside the figure. It moves on by itself; the visitor can pause, step back and forth
// (arrow keys too) or leave (Esc). Started from the hero's button, from OMS-mini ("give me the tour") or by
// opening the site with ?tour, which is the link to put on a CV.
import { useCallback, useEffect, useRef, useState } from "react";
import type { TourStep } from "@/lib/tour";

const START = "oms:tour-start";
/** Ask the tour to start from anywhere on the page. */
export const startTour = () => window.dispatchEvent(new CustomEvent(START));
/** Tells the figure and the guide panel what the tour is doing. */
const announce = (detail: { active: boolean; step?: number; last?: boolean }) => window.dispatchEvent(new CustomEvent("oms:tour", { detail }));

// a stop lasts about as long as its line takes to read, counted from the moment the page starts moving there,
// with at least READ ms on screen once it has arrived; eight timed stops come to about a minute
const durationOf = (text: string) => Math.min(7600, Math.max(5000, text.replace(/\*\*/g, "").length * 36));
const READ = 3800;

function bold(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/).map((part, i) => (part.startsWith("**") ? <b key={i}>{part.slice(2, -2)}</b> : part));
}

export default function Tour({ steps, email }: { steps: TourStep[]; email: string }) {
  const [step, setStep] = useState(-1); // -1: not running
  const [paused, setPaused] = useState(false);
  const [arrived, setArrived] = useState(false);
  const arrivedAt = useRef<number | null>(null);
  const [rect, setRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const barRef = useRef<HTMLSpanElement>(null);
  const active = step >= 0;
  const last = step === steps.length - 1;

  const end = useCallback(() => {
    setStep(-1); setPaused(false); setArrived(false); setRect(null);
    announce({ active: false });
    try { const u = new URL(location.href); if (u.searchParams.has("tour")) { u.searchParams.delete("tour"); history.replaceState(null, "", u.pathname + u.search + u.hash); } } catch {}
    requestAnimationFrame(() => opener.current?.focus?.());
  }, []);

  const begin = useCallback(() => {
    opener.current = document.activeElement as HTMLElement | null;
    setPaused(false);
    setStep(0);
  }, []);

  // entry points: the event, and ?tour once the intro is over
  useEffect(() => {
    const onStart = () => begin();
    const onClick = (e: MouseEvent) => { const b = (e.target as HTMLElement)?.closest?.("[data-tour-start]"); if (b) { e.preventDefault(); opener.current = b as HTMLElement; setPaused(false); setStep(0); } };
    window.addEventListener(START, onStart);
    document.addEventListener("click", onClick);
    let t: ReturnType<typeof setTimeout> | undefined;
    if (new URLSearchParams(location.search).has("tour")) {
      const wait = () => (document.documentElement.classList.contains("is-loading") ? (t = setTimeout(wait, 300)) : (t = setTimeout(begin, 900)));
      wait();
    }
    return () => { window.removeEventListener(START, onStart); document.removeEventListener("click", onClick); clearTimeout(t); };
  }, [begin]);

  // each stop: move the page there, then wait until it has come to rest
  useEffect(() => {
    if (!active) return;
    const s = steps[step];
    setArrived(false);
    arrivedAt.current = null;
    announce({ active: true, step, last });
    if ("section" in s.go) window.dispatchEvent(new CustomEvent("oms:guide", { detail: { name: "show_section", target: s.go.section } }));
    else if ("project" in s.go) window.dispatchEvent(new CustomEvent("oms:guide", { detail: { name: "show_project", target: s.go.project } }));
    else window.dispatchEvent(new CustomEvent("oms:scroll", { detail: { selector: s.go.selector } }));
    let lastY = -1, still = 0, waited = 0, raf = 0;
    const settle = () => {
      const y = scrollY;
      still = Math.abs(y - lastY) < 0.5 ? still + 1 : 0;
      lastY = y;
      waited++;
      if ((still > 14 && waited > 20) || waited > 200) { arrivedAt.current = performance.now(); setArrived(true); }
      else raf = requestAnimationFrame(settle);
    };
    raf = requestAnimationFrame(settle);
    return () => cancelAnimationFrame(raf);
  }, [active, step, steps, last]);

  // the spotlight follows its target (the wheel and the page keep moving a little)
  useEffect(() => {
    if (!active || !arrived) { setRect(null); return; }
    const sel = steps[step].spot;
    let raf = 0;
    const track = () => {
      let el = document.querySelector<HTMLElement>(sel);
      el = el?.closest<HTMLElement>(".mission__card") ?? el;
      if (el) {
        const b = el.getBoundingClientRect(), pad = 12;
        const x = Math.max(6, b.left - pad), y = Math.max(6, b.top - pad);
        const w = Math.min(innerWidth - 6, b.right + pad) - x, h = Math.min(innerHeight - 6, b.bottom + pad) - y;
        setRect((r) => (r && Math.abs(r.x - x) < 0.5 && Math.abs(r.y - y) < 0.5 && Math.abs(r.w - w) < 0.5 && Math.abs(r.h - h) < 0.5 ? r : { x, y, w, h }));
      }
      raf = requestAnimationFrame(track);
    };
    track();
    return () => cancelAnimationFrame(raf);
  }, [active, arrived, step, steps]);

  // the timer: starts with the stop (the scroll counts), never runs on the last stop, pauses when asked
  useEffect(() => {
    if (!active || last || paused) return;
    const total = durationOf(steps[step].text);
    const bar = barRef.current;
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const f = Math.min(1, (t - t0) / total);
      if (bar) bar.style.transform = `scaleX(${f})`;
      const at = arrivedAt.current;
      if (f >= 1 && at !== null && t - at >= READ) setStep((i) => Math.min(i + 1, steps.length - 1));
      else raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, last, paused, step, steps]);
  useEffect(() => { if (barRef.current) barRef.current.style.transform = "scaleX(0)"; }, [step]);

  // the visitor takes over: scrolling by hand pauses; keys step through; Esc leaves
  useEffect(() => {
    if (!active) return;
    const takeOver = () => setPaused(true);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); end(); }
      else if (e.key === "ArrowRight") { e.preventDefault(); setStep((i) => Math.min(i + 1, steps.length - 1)); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); setStep((i) => Math.max(i - 1, 0)); }
      else if (e.key === " " && (e.target as HTMLElement)?.closest?.(".tour__card") == null) { e.preventDefault(); setPaused((p) => !p); }
      else if (["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End"].includes(e.key)) setPaused(true);
    };
    addEventListener("wheel", takeOver, { passive: true });
    addEventListener("touchmove", takeOver, { passive: true });
    addEventListener("keydown", onKey);
    return () => { removeEventListener("wheel", takeOver); removeEventListener("touchmove", takeOver); removeEventListener("keydown", onKey); };
  }, [active, end, steps.length]);

  useEffect(() => { if (active) cardRef.current?.focus({ preventScroll: true }); }, [active]);

  if (!active) return null;
  const s = steps[step];
  return (
    <div className={`tour${arrived ? " is-arrived" : ""}${paused ? " is-paused" : ""}`}>
      <div className="tour__spot" aria-hidden="true" style={rect ? { transform: `translate(${rect.x}px, ${rect.y}px)`, width: rect.w, height: rect.h } : { opacity: 0 }} />
      <div className="tour__card" ref={cardRef} tabIndex={-1} role="dialog" aria-modal="false" aria-label="60-second tour of Oscar's work">
        <div className="tour__top hud">
          <span>Tour <b>{String(step + 1).padStart(2, "0")}</b>/{String(steps.length).padStart(2, "0")} · {s.label}</span>
          <button type="button" className="tour__x" onClick={end} aria-label="End the tour">×</button>
        </div>
        <ol className="tour__rail" aria-hidden="true">
          {steps.map((x, i) => (
            <li key={x.id} className={i < step ? "is-done" : i === step ? "is-now" : ""}>
              {i === step ? <span ref={barRef} /> : null}
            </li>
          ))}
        </ol>
        <p className="tour__text" aria-live="polite">{bold(s.text)}</p>
        {last ? (
          <div className="tour__end">
            <a className="btn btn--signal" href={`mailto:${email}`} onClick={end}><span>Email Oscar</span></a>
            <button type="button" className="btn" onClick={() => { end(); window.dispatchEvent(new CustomEvent("oms:guide-open")); }}><span>Ask OMS-mini</span></button>
            <button type="button" className="tour__link hud" onClick={() => setStep(0)}>↺ Replay</button>
          </div>
        ) : (
          <div className="tour__ctl">
            <button type="button" className="hud" onClick={() => setStep((i) => Math.max(i - 1, 0))} disabled={step === 0} aria-label="Previous stop">◂</button>
            <button type="button" className="hud" onClick={() => setPaused((p) => !p)}>{paused ? "▶ Play" : "❚❚ Pause"}</button>
            <button type="button" className="hud tour__next" onClick={() => setStep((i) => Math.min(i + 1, steps.length - 1))}>Next ▸</button>
            <span className="tour__keys hud" aria-hidden="true">← → · Esc</span>
          </div>
        )}
      </div>
    </div>
  );
}
