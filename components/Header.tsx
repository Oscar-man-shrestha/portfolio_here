"use client";

import { useEffect, useState } from "react";
import { nav, person } from "@/lib/content";

function useClock(timeZone: string) {
  const [t, setT] = useState("--:--");
  useEffect(() => {
    const f = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone });
    const tick = () => setT(f.format(new Date()));
    tick();
    const id = setInterval(tick, 15000);
    return () => clearInterval(id);
  }, [timeZone]);
  return t;
}

/** `base` is "" on the home page and "/" on project pages, so section links still land on the home page. */
export default function Header({ base = "" }: { base?: string }) {
  const time = useClock(person.timeZone);
  const [open, setOpen] = useState(false);
  const [calm, setCalm] = useState(false); // "Motion off": no smooth scroll, glitches or loops

  useEffect(() => {
    setCalm(document.documentElement.classList.contains("reduce-motion"));
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.documentElement.classList.add("menu-open");
    return () => {
      document.removeEventListener("keydown", onKey);
      document.documentElement.classList.remove("menu-open");
    };
  }, [open]);

  const toggleMotion = () => {
    const next = !calm;
    setCalm(next);
    try { localStorage.setItem("oms.motion", next ? "off" : "on"); } catch {}
    document.documentElement.classList.toggle("reduce-motion", next);
    window.dispatchEvent(new CustomEvent("oms:motion", { detail: { reduce: next } }));
  };

  return (
    <>
      <header className="hdr" id="header">
        <a className="hdr__brand" href={base ? "/" : "#top"}>
          {/* the space between the spans is ignored by the flex layout but keeps the accessible name readable */}
          <span className="hdr__mark"><span>Oscar</span> <span>Man Shrestha</span></span>
          <span className="sr-only">{base ? ", home" : ", back to top"}</span>
        </a>
        <div className="hdr__crumbs hud" aria-hidden="true">
          {person.disciplines.map((d) => <span key={d}><i>▸</i> {d}</span>)}
        </div>
        <button className="hdr__motion hud" type="button" aria-pressed={calm} onClick={toggleMotion}>
          <span className="lbl">Motion {calm ? "off" : "on"}</span>
          <span className="sr-only">Reduce motion</span>
          <i className="tgl" aria-hidden="true" />
        </button>
        <nav className="hdr__nav hud" aria-label="Primary">
          {nav.map((n, i) => (
            <a key={n.id} href={`${base}#${n.id}`} data-nav={n.id}>
              {n.label}<sup>{String(i + 1).padStart(2, "0")}</sup>
            </a>
          ))}
        </nav>
        <div className="hdr__clock hud" aria-label={`Local time in ${person.base}: ${time}`}>
          <span>BLR</span><b className="mono">{time}</b>
        </div>
        <button className="hdr__menu" type="button" aria-expanded={open} aria-controls="menu" onClick={() => setOpen((o) => !o)}>
          <span aria-hidden="true" /><span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
        </button>
      </header>
      <div className={`menu${open ? " is-open" : ""}`} id="menu" inert={!open}>
        <ol>
          {nav.map((n, i) => (
            <li key={n.id}>
              <a href={`${base}#${n.id}`} onClick={() => setOpen(false)}>
                <small>{String(i + 1).padStart(2, "0")}</small>{n.label}
              </a>
            </li>
          ))}
        </ol>
        <p className="hud dim">{person.disciplines.join(" · ")} — {person.base}</p>
      </div>
    </>
  );
}
