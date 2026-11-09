"use client";

// The pet: a small collectible figure of Oscar standing in the corner. It is OMS-mini's launcher (click or tap it,
// or press "/"), waves hello the first time it appears, when the pointer comes near, when the panel opens and now and
// then on its own. The frames come from a Google Flow clip of the figure, cut out by tools/pet/build.py (lib/pet.json).
// A still shows at once; the animation sheet loads after the page has settled and plays on a canvas, only while
// it's on screen. With reduced motion it stays still.
import { useEffect, useRef, useState, type RefObject } from "react";
import pet from "@/lib/pet.json";

const HELLO = "oms.pet.hello";
const NUDGE_MS = [28000, 46000]; // a wave every so often while the panel is closed

export default function Pet({ buttonRef, open, panelId, onToggle, atFooter }: {
  buttonRef: RefObject<HTMLButtonElement | null>; open: boolean; panelId: string; onToggle: () => void;
  /** The footer is on screen (the guide lifts above it on larger screens). */
  atFooter: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wave = useRef<() => void>(() => {});
  const openRef = useRef(open);
  const [live, setLive] = useState(false); // the sheet is loaded and the canvas shows
  const [hello, setHello] = useState(false);
  // phones have no spare corner: the pet stays off screen over the hero's buttons and the footer's links, and
  // steps aside while the visitor scrolls down, coming back once the page rests
  const [moving, setMoving] = useState(false), [atTop, setAtTop] = useState(false), [phone, setPhone] = useState(false);
  const [touring, setTouring] = useState(false), [hop, setHop] = useState(0);
  const touringRef = useRef(false);
  const tucked = phone && !open && !touring && (moving || atTop || atFooter);
  const pendingHello = useRef(false);

  useEffect(() => {
    const mq = matchMedia("(max-width: 767px)");
    let lastY = scrollY, rest: ReturnType<typeof setTimeout> | undefined;
    const update = () => { setPhone(mq.matches); setAtTop(scrollY < innerHeight * 0.6); };
    const onScroll = () => {
      const y = scrollY, down = y > lastY + 6, up = y < lastY - 6;
      if (down || up) lastY = y;
      update();
      if (down) setMoving(true);
      if (up) setMoving(false);
      clearTimeout(rest);
      rest = setTimeout(() => setMoving(false), 900);
    };
    update();
    addEventListener("scroll", onScroll, { passive: true });
    mq.addEventListener("change", update);
    return () => { removeEventListener("scroll", onScroll); mq.removeEventListener("change", update); clearTimeout(rest); };
  }, []);
  useEffect(() => {
    const onTour = (e: Event) => {
      const d = (e as CustomEvent<{ active: boolean; step?: number; last?: boolean }>).detail;
      setTouring(d.active);
      touringRef.current = d.active;
      if (!d.active) return;
      setHello(false);
      pendingHello.current = false;
      if (d.step === 0 || d.last) wave.current();
      else setHop((h) => h + 1);
    };
    window.addEventListener("oms:tour", onTour);
    return () => window.removeEventListener("oms:tour", onTour);
  }, []);
  const tuckedRef = useRef(tucked);
  useEffect(() => {
    tuckedRef.current = tucked;
    // a hello that came due while it was off screen waits for its first appearance
    if (!tucked && pendingHello.current && !touringRef.current) { pendingHello.current = false; setTimeout(() => { if (!touringRef.current) { wave.current(); setHello(true); } }, 450); }
  }, [tucked]);

  useEffect(() => { openRef.current = open; }, [open]);

  useEffect(() => {
    const canvas = canvasRef.current, ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const { fps, w, h, n, cols } = pet;
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.classList.contains("reduce-motion");
    if (still) return;
    let sheet: HTMLImageElement | null = null, frame = 0, playing = false, last = 0, raf = 0, alive = true;
    let nudge: ReturnType<typeof setTimeout> | undefined;

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(sheet!, (frame % cols) * w, Math.floor(frame / cols) * h, w, h, 0, 0, w, h);
    };
    const tick = (t: number) => {
      if (!alive) return;
      if (t - last >= 1000 / fps) {
        last = t;
        frame++;
        if (frame >= n) { frame = 0; playing = false; draw(); return; } // back to the first pose, and rest
        draw();
      }
      raf = requestAnimationFrame(tick);
    };
    const visible = () => canvas.offsetParent !== null && document.visibilityState === "visible";
    wave.current = () => {
      if (!sheet || playing || !visible()) return;
      playing = true;
      frame = 0;
      last = performance.now();
      raf = requestAnimationFrame(tick);
    };
    const scheduleNudge = () => {
      nudge = setTimeout(() => {
        if (!openRef.current) wave.current();
        scheduleNudge();
      }, NUDGE_MS[0] + Math.random() * (NUDGE_MS[1] - NUDGE_MS[0]));
    };

    // load after the intro and once the browser is idle, so the sheet never competes with the page's own media
    const load = async () => {
      await new Promise<void>((r) => {
        const check = () => (document.documentElement.classList.contains("is-loading") ? setTimeout(check, 400) : r());
        check();
      });
      const img = new Image();
      img.src = pet.sheet;
      await img.decode();
      if (!alive) return;
      sheet = img;
      draw();
      setLive(true);
      scheduleNudge();
      let greeted = false;
      try { greeted = sessionStorage.getItem(HELLO) === "1"; sessionStorage.setItem(HELLO, "1"); } catch {}
      if (!greeted) {
        // no hello over the tour (or when the visit starts with one: ?tour)
        const skip = touringRef.current || new URLSearchParams(location.search).has("tour");
        if (!skip && tuckedRef.current) pendingHello.current = true;
        else if (!skip) setTimeout(() => { if (!touringRef.current) { wave.current(); setHello(true); } }, 700);
      }
    };
    const idle = (cb: () => void) => ("requestIdleCallback" in window ? requestIdleCallback(cb, { timeout: 3000 }) : setTimeout(cb, 1200));
    idle(() => { load().catch(() => {}); });
    return () => { alive = false; cancelAnimationFrame(raf); clearTimeout(nudge); };
  }, []);

  useEffect(() => {
    if (!hello) return;
    const t = setTimeout(() => setHello(false), 5500);
    return () => clearTimeout(t);
  }, [hello]);
  useEffect(() => { if (open) { setHello(false); wave.current(); } }, [open]);

  return (
    <>
      <p className={`guide__hello${hello && !open && !tucked ? " is-on" : ""}`} aria-hidden="true">Hi! Ask me about Oscar.</p>
      <button
        ref={buttonRef}
        type="button"
        className={`guide__pet${live ? " is-live" : ""}${tucked ? " is-tucked" : ""}${touring ? " is-touring" : ""}`}
        data-hop={hop % 2}
        style={{ aspectRatio: `${pet.w} / ${pet.h}` }}
        aria-label={open ? "Close OMS-mini" : "Ask OMS-mini about Oscar"}
        aria-expanded={open}
        aria-controls={panelId}
        aria-keyshortcuts="/"
        onClick={onToggle}
        onPointerEnter={(e) => { if (e.pointerType === "mouse") wave.current(); }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={pet.still} alt="" width={pet.w} height={pet.h} decoding="async" />
        <canvas ref={canvasRef} width={pet.w} height={pet.h} aria-hidden="true" />
      </button>
    </>
  );
}
