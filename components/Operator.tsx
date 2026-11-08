"use client";

// Interactive parts of the operator profile: the plain-image fallback (shown until WebGL is ready), the view rail,
// the character card and the view buttons. The pinned scroll in Experience sets the current view by dispatching
// "oms:view"; the buttons ask Experience to scroll to a view with "oms:goto-view".
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { images, person } from "@/lib/content";
import { useSite } from "@/lib/store";

const ProfileGL = dynamic(() => import("./gl/ProfileGL"), { ssr: false });
const VIEWS = images.turnaround;

function ProfileGLMount() {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const phase = useSite((s) => s.phase);
  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setNear(true), { rootMargin: "120% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [near]);
  return <div className="op__gl" ref={ref}>{near && phase !== "intro" ? <ProfileGL /> : null}</div>;
}

export const cards = [
  { n: "01", title: "Class", rows: [["Role", person.role], ["Spec", person.disciplines.join(" · ")]] },
  { n: "02", title: "Base", rows: [["Name", person.name], ["Base", person.base]] },
  { n: "03", title: "Brief", text: person.about },
  { n: "04", title: "Off the clock", rows: [["Side quests", person.offClock.join(" · ")]] },
] as const;

export default function Operator() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const on = (e: Event) => setI((e as CustomEvent<number>).detail);
    window.addEventListener("oms:view", on);
    return () => window.removeEventListener("oms:view", on);
  }, []);
  const go = (k: number) => window.dispatchEvent(new CustomEvent("oms:goto-view", { detail: Math.max(0, Math.min(3, k)) }));

  return (
    <>
      <div className="op__stage" id="opStage">
        {VIEWS.map((v, k) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={v.src} className={`op__fallback${k === i ? " is-on" : ""}`} src={v.src} alt={k === i ? v.alt : ""} width={images.turnW} height={images.turnH} loading="lazy" decoding="async" />
        ))}
        <ProfileGLMount />
      </div>

      <ol className="op__rail hud" aria-hidden="true">
        {VIEWS.map((v, k) => (
          <li key={v.src} className={k === i ? "on" : ""}><b>{String(k + 1).padStart(3, "0")}</b><span>{v.label}</span></li>
        ))}
      </ol>

      <div className="op__card" aria-hidden="true">
        {cards.map((c, k) => (
          <div key={c.n} className={`op__slide${k === i ? " is-on" : ""}`}>
            <span className="op__num">{c.n}</span>
            <p className="hud op__ttl">{c.title}</p>
            {"text" in c ? <p className="op__text">{c.text}</p> : (
              <dl>{c.rows.map(([a, b]) => <div key={a}><dt className="hud">{a}</dt><dd>{b}</dd></div>)}</dl>
            )}
          </div>
        ))}
      </div>

      <div className="op__ui hud">
        <button type="button" onClick={() => go(i - 1)} aria-label="Previous view">◂</button>
        <span className="readout" aria-live="polite">View <b>{String(i + 1).padStart(2, "0")}</b>/04 · {VIEWS[i].label}</span>
        <span className="op__dots" aria-hidden="true">{VIEWS.map((v, k) => <i key={v.src} className={k === i ? "on" : ""} />)}</span>
        <button type="button" onClick={() => go(i + 1)} aria-label="Next view">▸</button>
      </div>
    </>
  );
}
