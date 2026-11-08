"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { images } from "@/lib/content";
import { fx } from "@/lib/fx";

const VIEWS = images.turnaround;
const SLICES = 9;

// The four views from Oscar's own turnaround sheet. Drag (or use the buttons / arrow keys) to step through them;
// each change plays a short slice-glitch built from the incoming image. Views are never mirrored or generated.
export default function Turnaround() {
  const [i, setI] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const slices = useRef<HTMLDivElement>(null);
  const drag = useRef({ on: false, x: 0, acc: 0 });

  const go = useCallback((next: number) => {
    const n = (next + VIEWS.length) % VIEWS.length;
    setI((cur) => {
      if (cur === n) return cur;
      const box = slices.current;
      if (box && !fx.reduce) {
        box.innerHTML = "";
        const r = box.getBoundingClientRect();
        for (let s = 0; s < SLICES; s++) {
          const el = document.createElement("i");
          const top = (s / SLICES) * 100, h = 100 / SLICES;
          el.style.cssText = `top:${top}%;height:${h + 0.4}%;background-image:url(${VIEWS[n].src});background-size:auto ${r.height}px;background-position:50% ${-(s / SLICES) * r.height}px;`;
          const dx = (Math.random() - 0.5) * 60;
          el.animate(
            [
              { transform: `translateX(${dx}px)`, opacity: 0.9, filter: "drop-shadow(4px 0 0 rgba(255,46,76,.8)) drop-shadow(-4px 0 0 rgba(140,145,128,.8))" },
              { transform: `translateX(${-dx * 0.3}px)`, opacity: 1, offset: 0.55 },
              { transform: "translateX(0)", opacity: 0, filter: "none" },
            ],
            { duration: 420, delay: Math.random() * 90, easing: "cubic-bezier(.16,1,.3,1)", fill: "forwards" },
          );
          box.appendChild(el);
        }
        window.setTimeout(() => { if (box) box.innerHTML = ""; }, 650);
      }
      return n;
    });
  }, []);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const d = drag.current;
    const down = (e: PointerEvent) => { d.on = true; d.x = e.clientX; d.acc = 0; };
    const move = (e: PointerEvent) => {
      if (!d.on) return;
      d.acc += e.clientX - d.x; d.x = e.clientX;
      if (Math.abs(d.acc) > 70) { go(i + (d.acc < 0 ? 1 : -1)); d.acc = 0; }
    };
    const up = () => { d.on = false; };
    el.addEventListener("pointerdown", down);
    addEventListener("pointermove", move, { passive: true });
    addEventListener("pointerup", up);
    addEventListener("pointercancel", up);
    const auto = () => go(i + 1);
    el.addEventListener("oms:spin", auto);
    return () => {
      el.removeEventListener("pointerdown", down);
      removeEventListener("pointermove", move);
      removeEventListener("pointerup", up);
      removeEventListener("pointercancel", up);
      el.removeEventListener("oms:spin", auto);
    };
  }, [go, i]);

  return (
    <div className="turn" ref={root} id="turn" role="group" aria-roledescription="carousel" aria-label="Model turnaround of Oscar, four views">
      {VIEWS.map((v, k) => (
        <div className={`turn__view${k === i ? " is-on" : ""}`} key={v.src} aria-hidden={k !== i}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={v.src} alt={v.alt} width={images.turnW} height={images.turnH} loading="lazy" decoding="async" draggable={false} />
        </div>
      ))}
      <div className="turn__slices" ref={slices} aria-hidden="true" />
      <div className="turn__ui hud">
        <button type="button" onClick={() => go(i - 1)} aria-label="Previous view">◂</button>
        <span className="readout" aria-live="polite">View <b>{String(i + 1).padStart(2, "0")}</b>/04 <span>· {VIEWS[i].label}</span></span>
        <span className="turn__dots" aria-hidden="true">{VIEWS.map((v, k) => <i key={v.src} className={k === i ? "on" : ""} />)}</span>
        <button type="button" onClick={() => go(i + 1)} aria-label="Next view">▸</button>
      </div>
    </div>
  );
}
