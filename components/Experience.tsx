"use client";

// Orchestration for the whole page: the intro film as loader (same rules as the previous site), the HUD boot
// sequence at the cut, Lenis smooth scrolling, and every GSAP scroll and pointer interaction.
import { useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { ScrambleTextPlugin } from "gsap/ScrambleTextPlugin";
import Lenis from "lenis";
import { FILM } from "@/lib/film";
import { fx } from "@/lib/fx";
import { useSite } from "@/lib/store";

gsap.registerPlugin(ScrollTrigger, SplitText, ScrambleTextPlugin);

const T_NAME = FILM.tName; // his face is first seen clearly, smiling at the laptop
const T_CUT = FILM.tCut; // every screen in the city has turned red

type Dispose = () => void;
declare global {
  interface Window { __omsFilm?: Promise<number>; __oms?: { log: string[]; state: string; boot: number } }
}

const $ = <T extends Element = HTMLElement>(s: string, el: ParentNode = document) => el.querySelector<T>(s);
const $$ = <T extends Element = HTMLElement>(s: string, el: ParentNode = document) => [...el.querySelectorAll<T>(s)];

function run(): Dispose {
  const root = document.documentElement;
  const disposers: Dispose[] = [];
  const later = (fn: () => void, ms: number) => { const id = window.setTimeout(fn, ms); disposers.push(() => clearTimeout(id)); };
  const listen = <K extends keyof WindowEventMap>(t: EventTarget, type: K | string, fn: (e: Event) => void, opts?: AddEventListenerOptions) => {
    t.addEventListener(type, fn, opts);
    disposers.push(() => t.removeEventListener(type, fn, opts));
  };
  const ctx = gsap.context(() => {});
  disposers.push(() => ctx.revert());
  // looping "ambient" animations (ticker, type band) that the Motion switch pauses
  const ambient: gsap.core.Animation[] = [];

  const M = (window.__oms = { boot: performance.now(), log: [] as string[], state: "loading" });
  const log = (m: string) => M.log.push(`${Math.round(performance.now() - M.boot)}ms ${m}`);

  let reduce = root.classList.contains("reduce-motion");
  fx.reduce = reduce;
  const noIntro = root.classList.contains("no-intro");
  const fine = matchMedia("(pointer: fine)").matches;
  history.scrollRestoration = "manual";

  const intro = $("#intro"), video = $<HTMLVideoElement>("#introVideo"), flash = $("#flash");
  const main = $("#main")!, header = $("#header")!;
  const pctEl = $("#loadPct"), statusEl = $("#loadStatus"), enterBtn = $<HTMLButtonElement>("#enterBtn");
  const barCells = $$("#loadBar i");
  const status = (t: string) => { if (statusEl) statusEl.textContent = t; };

  // ---------------- loading: real work, weighted ----------------
  const prog = { v: 0 };
  let target = 0;
  const bump = (n: number, what: string) => {
    target = Math.min(100, target + n);
    log("loaded " + what);
    gsap.to(prog, {
      v: target, duration: 0.6, ease: "power2.out", overwrite: true,
      onUpdate: () => {
        if (pctEl) pctEl.textContent = String(Math.round(prog.v)).padStart(3, "0");
        const on = Math.round((prog.v / 100) * barCells.length);
        barCells.forEach((c, i) => c.classList.toggle("on", i < on));
      },
    });
  };

  const fontsP = (document.fonts?.ready ?? Promise.resolve()).then(() => bump(20, "fonts"));
  const heroImg = $<HTMLImageElement>("#heroPortrait img");
  // Capped: on a slow phone connection (or a background tab, where decoding pauses) the page must not stay dark.
  const imgP = Promise.race([
    (heroImg?.decode ? heroImg.decode() : Promise.resolve()).catch(() => {}),
    new Promise<void>((res) => later(res, 1500)),
  ]).then(() => bump(30, "portrait"));

  // The film has priority: three.js and the shader are requested only once it is playing (or after 1.4 s).
  const filmStarted = new Promise<void>((res) => {
    if (!intro || noIntro || reduce || !video) return res();
    if (!video.paused && video.currentTime > 0) return res();
    listen(video, "playing", () => res(), { once: true });
    later(res, 1400);
  });
  filmStarted.then(() => { log("film started (or skipped)"); useSite.getState().set({ filmStarted: true }); });

  const glP = new Promise<void>((res) => {
    const check = (s: ReturnType<typeof useSite.getState>) => s.heroGL !== "idle";
    if (check(useSite.getState())) return res();
    const unsub = useSite.subscribe((s) => { if (check(s)) { unsub(); res(); } });
    disposers.push(unsub);
    filmStarted.then(() => later(res, noIntro || !intro ? 900 : 5000)); // never block the site on WebGL
  }).then(() => bump(50, "webgl " + useSite.getState().heroGL));

  // ---------------- intro: film as loader ----------------
  let ready = false, revealed = false, nameShown = false, holding = false, autoplayFailed = false, skipRequested = false;
  const introName = $("#introName");
  const nameParts = introName ? $$(":scope > span > span", introName) : [];
  gsap.set(nameParts, { yPercent: 110 });

  const showName = (instant?: boolean) => {
    if (nameShown) return; nameShown = true;
    if (instant || reduce) gsap.set(nameParts, { yPercent: 0 });
    else gsap.to(nameParts, { yPercent: 0, duration: 1.15, ease: "expo.out", stagger: 0.08 });
  };
  const showEnter = () => { if (enterBtn && !revealed) { enterBtn.hidden = false; status("Ready"); enterBtn.focus({ preventScroll: true }); } };

  let raf = 0;
  const watchFilm = () => {
    if (revealed || !video) return;
    const t = video.currentTime;
    if (t >= T_NAME) showName();
    if (t >= T_CUT || video.ended) {
      if (ready) return reveal("film");
      if (!holding) { holding = true; video.pause(); status("Almost there"); log("holding at " + t.toFixed(2)); }
      return;
    }
    raf = requestAnimationFrame(watchFilm);
  };
  disposers.push(() => cancelAnimationFrame(raf));

  const startIntro = () => {
    main.inert = true; header.inert = true;
    if (reduce || !video) { showName(true); status("Loading"); return; }
    const begin = () => { log("film playing"); raf = requestAnimationFrame(watchFilm); };
    (window.__omsFilm ?? video.play().then(() => 1, () => 0)).then((ok) => {
      if (ok || !video.paused) begin();
      else { autoplayFailed = true; showName(true); log("autoplay blocked"); if (ready) showEnter(); }
    });
    listen(video, "ended", () => { if (!revealed && ready) reveal("film"); });
    const last = video.querySelector("source:last-of-type");
    if (last) listen(last, "error", () => { log("video failed"); autoplayFailed = true; showName(true); if (ready) showEnter(); });
    listen(document, "visibilitychange", () => { if (!document.hidden && !revealed) raf = requestAnimationFrame(watchFilm); });
    later(() => { if (!revealed && video.currentTime < 0.15) { autoplayFailed = true; showName(true); if (ready) showEnter(); } }, 4000);
  };

  const onReady = () => {
    ready = true; M.state = "ready"; log("ready");
    if (!intro || noIntro) return reveal("instant");
    status("Ready");
    if (skipRequested || holding) return reveal(holding ? "film" : "skip");
    if (reduce || autoplayFailed) showEnter();
  };

  const reveal = (mode: "film" | "skip" | "instant" | "reduce") => {
    if (revealed) return; revealed = true; M.state = "revealing"; log("reveal: " + mode);
    cancelAnimationFrame(raf);
    try { sessionStorage.setItem("oms.intro", "1"); } catch {}
    if (!intro || mode === "instant") { intro?.remove(); enterSite(true, true); return; }
    if (reduce) {
      enterSite(false, false);
      gsap.to(intro, { opacity: 0, duration: 0.3, ease: "power1.out", onComplete: () => intro.remove() });
      return;
    }
    // the soundtrack fades with the flash instead of stopping dead
    if (video && !video.muted) gsap.to(video, { volume: 0, duration: 0.5, ease: "power1.out" });
    gsap.timeline()
      .to(flash, { opacity: 1, duration: mode === "film" ? 0.3 : 0.22, ease: "power2.in" })
      .add(() => { video?.pause(); enterSite(true, false); })
      .to(flash, { opacity: 0, duration: 1.0, ease: "power2.out" }, "+=0.04")
      .add(() => { intro.remove(); M.state = "site"; });
  };

  listen($("#skipIntro") ?? document.createElement("i"), "click", () => { if (ready) reveal("skip"); else { skipRequested = true; status("Loading"); } });
  // browsers only start videos muted; the film's sirens, rain and boom play once the visitor asks for sound
  const soundBtn = $<HTMLButtonElement>("#soundIntro");
  if (soundBtn && video) listen(soundBtn, "click", () => {
    video.muted = !video.muted;
    if (!video.muted) video.volume = 1;
    soundBtn.setAttribute("aria-pressed", String(!video.muted));
    const state = soundBtn.querySelector("[data-state]");
    if (state) state.textContent = video.muted ? "off" : "on";
  });
  if (enterBtn) listen(enterBtn, "click", () => reveal(reduce ? "reduce" : "skip"));
  listen(document, "keydown", (e) => {
    if ((e as KeyboardEvent).key === "Escape" && !revealed && intro) { if (ready) reveal("skip"); else skipRequested = true; }
  });

  if (intro && !noIntro) startIntro();
  else { root.classList.add("no-intro"); intro?.remove(); }
  Promise.allSettled([fontsP, imgP, glP]).then(() => onReady());

  // ---------------- entering the site ----------------
  let lenis: Lenis | null = null;
  // The hero pin exists from the start (so the layout never jumps); its letter/panel timeline is created only once
  // the boot sequence has finished, so GSAP records the settled values rather than mid-animation ones.
  let heroPin: ScrollTrigger | null = null;
  let bootDone = false, heroDomPending = false;
  const heroScrollReady = () => { if (bootDone) heroDomScroll(); else heroDomPending = true; };
  const markBootDone = () => { bootDone = true; if (heroDomPending) { heroDomPending = false; heroDomScroll(); } };
  function heroDomScroll() {
    if (reduce || !heroPin) return;
    const pinST = heroPin;
    const heroChars = $$(".hero__first .char"), outlineChars = $$(".hero__outline .char");
    // calm exit while the portrait turns: the name parts slide apart, the HUD dims, the sun settles back
    gsap.timeline({ defaults: { ease: "none" }, scrollTrigger: { start: () => pinST.start, end: () => pinST.end, scrub: 0.9 } })
      .to(".hero__sun", { scale: 1.18, yPercent: 8, duration: 1 }, 0)
      .to(heroChars, { xPercent: (k: number) => (k - (heroChars.length - 1) / 2) * 14, opacity: 0.25, duration: 0.8 }, 0.15)
      .to(outlineChars, { xPercent: (k: number) => (k - (outlineChars.length - 1) / 2) * 18, opacity: 0, duration: 0.8 }, 0.15)
      .to(".hero__last, .hero__role, .hero__ctas", { y: -24, opacity: 0, duration: 0.4 }, 0.2)
      .to(".hero .panel", { opacity: 0.15, duration: 0.5, stagger: 0.03 }, 0.25)
      .to(".hero__lines, .hero__bar", { opacity: 0, duration: 0.5 }, 0.3)
      .to(".hero__kana", { opacity: 1, duration: 0.5 }, 0.2);
    ScrollTrigger.refresh();
  }

  function enterSite(animated: boolean, quick: boolean) {
    root.classList.remove("is-loading");
    main.inert = false; header.inert = false;
    useSite.getState().set({ phase: "boot" });
    window.scrollTo(0, 0);
    if (!reduce) startLenis();
    boot(animated && !reduce, quick);
    setupScroll();
    setupPointer();
    setupKeys();
    $("#heroTitle")?.focus({ preventScroll: true });
    if (location.hash.length > 1) later(() => scrollToHash(location.hash), 600);
  }

  function startLenis() {
    if (lenis) return;
    lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 0.9, smoothWheel: true });
    lenis.on("scroll", ScrollTrigger.update);
    const tick = (t: number) => lenis?.raf(t * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    disposers.push(() => { gsap.ticker.remove(tick); lenis?.destroy(); lenis = null; });
  }

  function scrollToHash(hash: string) {
    const t = document.getElementById(hash.slice(1));
    if (!t) return;
    if (lenis) lenis.scrollTo(t, { duration: 1.4, easing: (x: number) => 1 - Math.pow(1 - x, 4) });
    else t.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }

  // ---------------- boot: the HUD powers on at the cut ----------------
  function boot(animated: boolean, quick: boolean) {
    const glOn = () => useSite.getState().heroGL === "ready";
    const portrait = $("#heroPortrait");
    const firstChars = SplitText.create(".hero__first .hero__word", { type: "chars", charsClass: "char", aria: "none" }).chars;
    const outlineChars = SplitText.create(".hero__outline .hero__word", { type: "chars", charsClass: "char", aria: "none" }).chars;
    const lastLines = $$(".hero__last .ln > span");
    const panels = $$(".hero .panel");
    // decode only plain-text labels (scrambling would flatten nested markup)
    const scrambles = $$(".hero .panel__lbl > span, .hero__role, .panel--jump .lbl span").filter((el) => el.children.length === 0);

    if (!animated) {
      fx.hero.reveal = 1; fx.hero.glitch = 0;
      useSite.getState().set({ phase: "site" });
      markBootDone();
      return;
    }
    const s = quick ? 0.7 : 1;
    const tl = gsap.timeline({ delay: quick ? 0.05 : 0.12, onComplete: () => { useSite.getState().set({ phase: "site" }); idleGlitch(); markBootDone(); } });
    tl.from(".hero__lines .v", { scaleY: 0, duration: 1.1 * s, ease: "expo.inOut", stagger: 0.08 }, 0)
      .from(".hero__lines .h", { scaleX: 0, duration: 1.2 * s, ease: "expo.inOut", stagger: 0.07 }, 0.1 * s)
      .from(".hero__lines .tick", { scale: 0, rotate: 135, duration: 0.6, ease: "back.out(2)", stagger: 0.05 }, 0.7 * s)
      .from(".hero__glow", { opacity: 0, duration: 1.4, ease: "power2.out" }, 0)
      .from(header, { yPercent: -100, duration: 0.9, ease: "expo.out", clearProps: "transform" }, 0.2 * s);

    // portrait: WebGL scan reveal, or a clip reveal on the plain image when WebGL is not ready
    fx.hero.reveal = 0;
    if (glOn()) {
      tl.to(fx.hero, { reveal: 1, duration: 1.35 * s, ease: "power2.inOut" }, 0.15 * s)
        .fromTo(fx.hero, { glitch: 0.85 }, { glitch: 0, duration: 1.1 * s, ease: "power3.out" }, 0.25 * s)
        .to(fx.hero, { glitch: 0.5, duration: 0.06, yoyo: true, repeat: 1, ease: "none" }, 1.55 * s);
    } else if (portrait) {
      fx.hero.reveal = 1;
      tl.fromTo(portrait, { clipPath: "inset(100% 0 0 0)" }, { clipPath: "inset(0% 0 0 0)", duration: 1.3 * s, ease: "expo.inOut", clearProps: "clipPath" }, 0.15 * s);
    }

    // name: letters power on in random order, the red A flickers like a failing tube, then holds
    tl.from([...firstChars, ...outlineChars], {
      yPercent: 26, opacity: 0, duration: 0.9, ease: "expo.out",
      stagger: { each: 0.06, from: "random" },
    }, 0.35 * s);
    const red = $$(".hero__first .red, .hero__outline .red");
    tl.fromTo(red, { opacity: 0.15 }, {
      keyframes: [{ opacity: 1, duration: 0.05 }, { opacity: 0.2, duration: 0.07 }, { opacity: 1, duration: 0.04 }, { opacity: 0.35, duration: 0.1 }, { opacity: 1, duration: 0.05 }],
    }, 1.0 * s);
    tl.from(lastLines, { yPercent: 105, duration: 1.0, ease: "expo.out", stagger: 0.08 }, 0.8 * s);
    tl.from(panels, { clipPath: "inset(0 0 100% 0)", duration: 0.9, ease: "expo.inOut", stagger: 0.07, clearProps: "clipPath" }, 0.45 * s);
    tl.from(".hero__ctas .btn", { y: 18, opacity: 0, duration: 0.8, ease: "expo.out", stagger: 0.08 }, 1.05 * s);
    tl.from(".hero__bar", { yPercent: 100, duration: 0.8, ease: "expo.out" }, 0.6 * s);
    scrambles.forEach((el, i) => {
      const text = el.textContent ?? "";
      tl.to(el, { duration: 0.9, scrambleText: { text, chars: "upperCase", speed: 0.6, revealDelay: 0.2 } }, 0.7 * s + i * 0.04);
    });
  }

  // occasional short glitch on the portrait while the hero is on screen
  let heroVisible = true;
  function idleGlitch() {
    if (reduce) return;
    // neon katakana: flickers like a failing tube now and then
    const kana = $$(".hero__kana, .op__vert span");
    const flicker = () => {
      if (!reduce && !document.hidden) {
        gsap.timeline().to(kana, { keyframes: [{ opacity: 0.25, duration: 0.04 }, { opacity: 1, duration: 0.05 }, { opacity: 0.4, duration: 0.06 }, { opacity: 1, duration: 0.08 }] });
      }
      later(flicker, 2600 + Math.random() * 5200);
    };
    later(flicker, 1800);
    const loop = () => {
      if (!reduce && heroVisible && !document.hidden) {
        const amp = 0.25 + Math.random() * 0.3;
        gsap.timeline().to(fx.hero, { glitch: amp, duration: 0.05, ease: "none" }).to(fx.hero, { glitch: 0, duration: 0.22, ease: "power2.out" }, "+=0.08");
      }
      later(loop, 5200 + Math.random() * 4200);
    };
    later(loop, 3200);
  }

  // ---------------- scroll choreography ----------------
  function setupScroll() {
    // header: hide on the way down, show on the way up; active section link; scroll progress cells
    const cells = $$("#scrollCells i");
    let lastY = 0;
    ScrollTrigger.create({
      start: 0, end: "max",
      onUpdate: (st) => {
        const y = st.scroll();
        header.classList.toggle("is-hidden", y > innerHeight * 0.7 && y > lastY && !root.classList.contains("menu-open"));
        lastY = y;
        // scroll speed becomes wind for the sakura petals (decays in the render loops)
        const wv = gsap.utils.clamp(-1, 1, st.getVelocity() / 2600);
        if (Math.abs(wv) > Math.abs(fx.wind.v)) fx.wind.v = wv;
        const on = Math.round(st.progress * cells.length);
        cells.forEach((c, i) => c.classList.toggle("on", i < on));
      },
    });
    $$<HTMLAnchorElement>("[data-nav]").forEach((a) => {
      const sec = document.getElementById(a.dataset.nav!);
      if (sec) ScrollTrigger.create({ trigger: sec, start: "top 50%", end: "bottom 50%", onToggle: (st) => a.classList.toggle("is-active", st.isActive) });
    });
    ScrollTrigger.create({ trigger: ".hero", start: "top top", end: "bottom top", onToggle: (st) => { heroVisible = st.isActive; } });

    // ticker in the hero bar
    const ticker = $("#ticker");
    if (ticker && !reduce) ambient.push(gsap.to(ticker, { xPercent: -50, duration: 38, ease: "none", repeat: -1 }));

    if (!reduce) {
      // hero, pinned for one extra screen: the photo hands over to particles that lift into 3D, turn and drift
      // away; the name splits in depth, the red sun swells and the HUD powers down.
      heroPin = ScrollTrigger.create({
        trigger: ".hero", start: "top top", end: "+=110%", pin: true, anticipatePin: 1, refreshPriority: 3,
        onUpdate: (s) => gsap.to(fx.hero, { turn: s.progress, duration: 0.8, ease: "power2.out", overwrite: "auto" }),
      });
      heroScrollReady();
      ScrollTrigger.create({
        trigger: ".hero", start: "top top", end: "bottom top",
        onUpdate: (st) => { fx.hero.scroll = Math.max(fx.hero.scroll, Math.min(0.4, Math.abs(st.getVelocity()) / 9000)); },
      });

      // marquee: drift + scroll-velocity skew
      $$(".mq__row").forEach((row) => {
        const dir = Number(row.dataset.dir || 1);
        const drift = gsap.fromTo(row, { xPercent: dir > 0 ? 0 : -33.333 }, { xPercent: dir > 0 ? -33.333 : 0, duration: 26, ease: "none", repeat: -1 });
        ambient.push(drift);
        ScrollTrigger.create({
          trigger: ".mq", start: "top bottom", end: "bottom top",
          onUpdate: (st) => {
            const v = st.getVelocity() / 600;
            gsap.to(drift, { timeScale: 1 + Math.min(6, Math.abs(v)) * Math.sign(v || 1), duration: 0.3, overwrite: true });
            gsap.to(row, { skewX: gsap.utils.clamp(-14, 14, -v * 2 * dir), duration: 0.4, overwrite: "auto" });
          },
          onToggle: (st) => (st.isActive && !reduce ? drift.play() : drift.pause()),
        });
      });
    }

    // section titles: characters rise inside line masks; kickers decode
    $$(".sec__title.split").forEach((el) => {
      if (reduce) return;
      SplitText.create(el, {
        type: "lines,words,chars", mask: "lines", autoSplit: true,
        onSplit: (self) => gsap.from(self.chars, {
          yPercent: 110, duration: 1.1, ease: "expo.out", stagger: 0.018,
          scrollTrigger: { trigger: el, start: "top 88%", once: true },
        }),
      });
    });
    $$(".sec__kicker").forEach((el) => {
      if (reduce) return;
      const text = el.textContent ?? "";
      gsap.to(el, { duration: 1, scrambleText: { text, chars: "upperCase", speed: 0.5 }, scrollTrigger: { trigger: el, start: "top 90%", once: true } });
    });
    if (!reduce) {
      $$(".sec__lede, .reveal").forEach((el) =>
        gsap.from(el, { y: 36, opacity: 0, duration: 1.1, ease: "expo.out", scrollTrigger: { trigger: el, start: "top 90%", once: true } }));
    }

    setupWork();
    setupActivity();
    setupOss();
    setupProfile();
    setupContact();
    // Triggers below the Work pin were created before the pin added its scroll length; measure the pin first
    // (refreshPriority) and recalculate everything so nav states and reveals fire where they appear.
    ScrollTrigger.sort();
    ScrollTrigger.refresh();
  }

  function artLoops(card: HTMLElement) {
    const tl = gsap.timeline({ paused: true, repeat: -1 });
    const v = card.dataset.visual;
    if (v === "relay") {
      const path = $<SVGPathElement>("#relayPath", card), baton = $(".relay-baton", card);
      if (path && baton) {
        const L = path.getTotalLength(), o = { t: 0 };
        tl.to(o, {
          t: 1, duration: 2.2, ease: "power2.inOut",
          onUpdate: () => { const p = path.getPointAtLength(o.t * L); baton.setAttribute("transform", `translate(${p.x} ${p.y})`); },
        }).fromTo($(".relay-check", card), { scale: 0.6, opacity: 0, transformOrigin: "50% 50%" }, { scale: 1, opacity: 1, duration: 0.4, ease: "back.out(3)" })
          .to({}, { duration: 0.8 });
      }
    } else if (v === "beacon") {
      // svgOrigin pins the rings and the needle to their real centres in SVG user space
      tl.fromTo($$(".beacon-rings circle", card), { scale: 0.7, opacity: 0.9, svgOrigin: "200 150" }, { scale: 3.4, opacity: 0, duration: 2.4, ease: "power1.out", stagger: 0.6, svgOrigin: "200 150" });
    } else if (v === "markov") {
      tl.to($$(".markov-node circle", card), { scale: 1.14, duration: 0.25, ease: "power2.out", yoyo: true, repeat: 1, stagger: { each: 0.35, from: "random" }, transformOrigin: "50% 50%" })
        .to({}, { duration: 0.6 });
    } else if (v === "gauge") {
      const needle = $(".gauge-needle", card);
      if (needle) {
        tl.fromTo(needle, { rotation: -70, svgOrigin: "330 200" }, { rotation: 55, svgOrigin: "330 200", duration: 1.6, ease: "elastic.out(1, 0.5)" })
          .to(needle, { rotation: -20, svgOrigin: "330 200", duration: 1.2, ease: "power3.inOut" }, "+=0.6");
      }
    }
    return tl;
  }

  function drawIn(card: HTMLElement) {
    const els = $$<SVGGeometryElement>(".draw path, .draw rect, .draw circle", card);
    els.forEach((p) => {
      if (p.getAttribute("stroke-dasharray") || p.style.strokeDasharray) { gsap.set(p, { opacity: 0 }); return; }
      const L = Math.ceil(p.getTotalLength?.() ?? 0) + 2;
      // hidden until drawn, so arrowheads (markers) never float ahead of their lines
      gsap.set(p, { strokeDasharray: L, strokeDashoffset: L, opacity: 0 });
    });
    const tl = gsap.timeline({ paused: true });
    const bars = $$(".gauge-bar", card), dots = $$(".relay-packets rect, .markov-node, .fill-red", card), num = $(".mission__num", card);
    if (els.length) tl.to(els, { strokeDashoffset: 0, opacity: 1, duration: 1.2, ease: "power2.inOut", stagger: 0.04 }, 0);
    if (bars.length) tl.from(bars, { scaleY: 0, transformOrigin: "50% 100%", duration: 0.8, ease: "expo.out", stagger: 0.05 }, 0.3);
    if (dots.length) tl.from(dots, { opacity: 0, duration: 0.4, stagger: 0.05 }, 0.5);
    if (num) tl.from(num, { yPercent: 40, opacity: 0, duration: 1, ease: "expo.out" }, 0.1);
    return tl;
  }

  function setupWork() {
    const track = $("#workTrack"), pin = $(".work__pin");
    if (!track || !pin) return;
    const cards = $$(".mission", track);
    const bar = $("#workBar"), count = $("#workCount");
    const mm = gsap.matchMedia();
    disposers.push(() => mm.revert());
    mm.add({ wide: "(min-width: 768px)", narrow: "(max-width: 767px)" }, (c) => {
      const { wide } = c.conditions as { wide: boolean };
      if (wide) {
        // travel = track width minus the visible width between the two gutters (the pin sits one gutter in)
        const dist = () => Math.max(0, track.scrollWidth - innerWidth + 2 * pin.getBoundingClientRect().left);
        const tween = gsap.to(track, {
          x: () => -dist(), ease: "none",
          scrollTrigger: {
            trigger: pin, start: "top top", end: () => "+=" + dist(), pin: true, scrub: reduce ? true : 0.8, invalidateOnRefresh: true, anticipatePin: 1, refreshPriority: 2,
            onUpdate: (st) => {
              if (bar) bar.style.transform = `scaleX(${st.progress})`;
              if (count) count.textContent = `${String(Math.min(cards.length, 1 + Math.floor(st.progress * cards.length))).padStart(2, "0")}/${String(cards.length).padStart(2, "0")}`;
            },
          },
        });
        cards.forEach((card) => {
          const d = drawIn(card), loop = artLoops(card);
          ScrollTrigger.create({
            trigger: card, containerAnimation: tween, start: "left 85%", end: "right 0%",
            onEnter: () => { d.play(); if (!reduce) loop.play(); },
            onEnterBack: () => { if (!reduce) loop.play(); },
            onLeave: () => loop.pause(), onLeaveBack: () => loop.pause(),
          });
        });
        // keyboard users: bring a focused card into view inside the horizontal track. A native scroll is used
        // (Lenis follows it); in testing, Lenis's own immediate scrollTo did not move the page from a focus event.
        const onFocus = (e: Event) => {
          const card = (e.target as HTMLElement).closest(".mission") as HTMLElement | null;
          const st = tween.scrollTrigger;
          if (!card || !st) return;
          const x = Math.min(dist(), Math.max(0, card.offsetLeft - innerWidth * 0.08));
          const y = st.start + (x / Math.max(1, dist())) * (st.end - st.start);
          window.scrollTo(0, y);
          // the browser's own focus scrolling can run after this handler; re-apply on the next frame so ours wins
          requestAnimationFrame(() => { window.scrollTo(0, y); lenis?.resize(); });
        };
        track.addEventListener("focusin", onFocus);
        return () => track.removeEventListener("focusin", onFocus);
      }
      cards.forEach((card) => {
        const d = drawIn(card), loop = artLoops(card);
        ScrollTrigger.create({
          trigger: card, start: "top 80%", end: "bottom top",
          onEnter: () => { d.play(); if (!reduce) loop.play(); },
          onEnterBack: () => { if (!reduce) loop.play(); },
          onLeave: () => loop.pause(), onLeaveBack: () => loop.pause(),
        });
      });
    });
  }

  function setupActivity() {
    $$(".activity .count").forEach((el) => {
      const to = Number(el.dataset.to || 0);
      if (reduce || !to) return;
      const o = { v: 0 };
      el.textContent = "0";
      gsap.to(o, {
        v: to, duration: 1.8, ease: "power3.out",
        scrollTrigger: { trigger: el, start: "top bottom-=40", once: true },
        onUpdate: () => { el.textContent = Math.round(o.v).toLocaleString("en-US"); },
      });
    });
    if (!reduce) gsap.from(".stat", { opacity: 0, x: -20, duration: 0.9, ease: "expo.out", stagger: 0.08, scrollTrigger: { trigger: ".stats", start: "top 85%", once: true } });
  }

  function setupOss() {
    if (reduce) return;
    // the paper section cuts in on a diagonal as it scrolls up over the dark one
    gsap.fromTo(".oss", { clipPath: "polygon(0 14%, 100% 0, 100% 100%, 0 100%)" }, {
      clipPath: "polygon(0 0, 100% 0, 100% 100%, 0 100%)", ease: "none",
      scrollTrigger: { trigger: ".oss", start: "top bottom", end: "top 35%", scrub: true },
    });
    gsap.from(".patch", { clipPath: "inset(0 100% 0 0)", duration: 1.1, ease: "expo.inOut", stagger: 0.12, clearProps: "clipPath", scrollTrigger: { trigger: ".patches", start: "top 85%", once: true } });
    gsap.from(".slot", {
      opacity: 0, duration: 0.5, stagger: 0.1, ease: "steps(3)",
      scrollTrigger: { trigger: ".slots", start: "top 88%", once: true },
    });
  }

  function setupProfile() {
    const pin = $(".op__pin");
    if (!pin) return;
    // one screen of scroll per view change: 4 views → +300%
    let view = 0;
    const st = ScrollTrigger.create({
      trigger: pin, start: "top top", end: "+=300%", pin: true, scrub: reduce ? true : 0.6, anticipatePin: 1, refreshPriority: 1,
      onUpdate: (s) => {
        fx.profile.p = s.progress * 3;
        const v = Math.max(0, Math.min(3, Math.floor(fx.profile.p + 0.5)));
        if (v !== view) { view = v; window.dispatchEvent(new CustomEvent("oms:view", { detail: v })); }
      },
    });
    // buttons and keyboard: jump to the scroll position that shows a given view
    listen(window, "oms:goto-view", (ev) => {
      const k = (ev as CustomEvent<number>).detail;
      const y = st.start + (k / 3) * (st.end - st.start);
      if (lenis && !reduce) lenis.scrollTo(y, { duration: 1.2 }); else window.scrollTo(0, y);
    });
    if (reduce) return;
    // the stacked name drifts apart in depth while the figure turns
    gsap.timeline({ defaults: { ease: "none" }, scrollTrigger: { trigger: pin, start: "top top", end: "+=300%", scrub: 0.6 } })
      .fromTo(".op__line.l0", { xPercent: 6 }, { xPercent: -10 }, 0)
      .fromTo(".op__line.l1", { xPercent: -8 }, { xPercent: 8 }, 0)
      .fromTo(".op__line.l2", { xPercent: 4 }, { xPercent: -6 }, 0)
      .fromTo(".op__sun", { scale: 0.85 }, { scale: 1.15 }, 0);
    gsap.from(".op__line > span", { yPercent: 105, duration: 1.2, ease: "expo.out", stagger: 0.1, scrollTrigger: { trigger: pin, start: "top 70%", once: true } });
  }

  function setupContact() {
    const words = $$(".contact__title .w");
    if (reduce || !words.length) return;
    const ghosts = words.map((w) => {
      const g = document.createElement("span");
      g.className = "ghost"; g.textContent = w.textContent; g.setAttribute("aria-hidden", "true");
      w.appendChild(g); return g;
    });
    const rnd = gsap.utils.random;
    const from = words.map(() => ({ x: rnd(-280, 280), y: rnd(-220, -60), r: rnd(-28, 28) }));
    const tl = gsap.timeline({ scrollTrigger: { trigger: ".contact__title", start: "top 78%", once: true } });
    words.forEach((w, i) => {
      const f = from[i];
      tl.from(w, { x: f.x, y: f.y, rotation: f.r, opacity: 0, filter: "blur(10px)", duration: 1.5, ease: "expo.out" }, i * 0.14);
      tl.fromTo(ghosts[i], { x: f.x * 0.25, y: f.y * 0.25 + 30, opacity: 0.9 }, { x: 0, y: 0, opacity: 0, duration: 1.7, ease: "expo.out" }, i * 0.14 + 0.08);
    });
    tl.from(".contact__mail", { y: 30, opacity: 0, duration: 1, ease: "expo.out" }, 0.5)
      .from(".contact__links li", { y: 24, opacity: 0, duration: 0.8, ease: "expo.out", stagger: 0.06 }, 0.7)
      .from(".contact__fig", { opacity: 0, x: 40, duration: 1.4, ease: "expo.out" }, 0.4);
  }

  // ---------------- pointer: crosshair cursor, magnetic buttons, hero parallax ----------------
  function setupPointer() {
    const hero = $(".hero");
    const portrait = $("#heroPortrait");
    listen(window, "pointermove", (ev) => {
      const e = ev as PointerEvent;
      if (!hero) return;
      const r = hero.getBoundingClientRect();
      if (e.clientY > r.bottom) return;
      fx.hero.mx = ((e.clientX - r.left) / r.width) * 2 - 1;
      fx.hero.my = -(((e.clientY - r.top) / r.height) * 2 - 1);
      if (portrait) {
        const p = portrait.getBoundingClientRect();
        const inside = e.clientX > p.left && e.clientX < p.right && e.clientY > p.top && e.clientY < p.bottom;
        fx.hero.hover = inside ? 1 : 0;
        if (inside) fx.hero.my = -(((e.clientY - p.top) / p.height) * 2 - 1);
      }
    }, { passive: true });

    if (!fine || reduce) { root.classList.add("no-tilt"); return; }
    root.classList.add("has-cursor");
    // work cards tilt in 3D toward the pointer and lift on hover
    $$(".mission__card").forEach((card) => {
      const rx = gsap.quickTo(card, "rotationX", { duration: 0.5, ease: "power3" }), ry = gsap.quickTo(card, "rotationY", { duration: 0.5, ease: "power3" });
      listen(card, "pointermove", (ev) => {
        const e = ev as PointerEvent, r = card.getBoundingClientRect();
        ry(((e.clientX - r.left) / r.width - 0.5) * 7);
        rx(-((e.clientY - r.top) / r.height - 0.5) * 6);
      });
      listen(card, "pointerenter", () => gsap.to(card, { x: -4, y: -4, duration: 0.4, ease: "power3" }));
      listen(card, "pointerleave", () => { rx(0); ry(0); gsap.to(card, { x: 0, y: 0, duration: 0.5, ease: "power3" }); });
    });
    const cur = $(".cursor")!, read = $(".cursor__read")!;
    const xTo = gsap.quickTo(cur, "x", { duration: 0.18, ease: "power3" });
    const yTo = gsap.quickTo(cur, "y", { duration: 0.18, ease: "power3" });
    let label = "";
    listen(window, "pointermove", (ev) => {
      const e = ev as PointerEvent;
      cur.classList.add("is-on");
      xTo(e.clientX); yTo(e.clientY);
      read.textContent = label || `X ${String(Math.round(e.clientX)).padStart(4, "0")} · Y ${String(Math.round(e.clientY)).padStart(4, "0")}`;
    }, { passive: true });
    listen(document, "pointerover", (ev) => {
      const t = (ev.target as HTMLElement).closest("a, button, .turn, .map__gl");
      cur.classList.toggle("is-hover", !!t);
      label = !t ? "" : t.matches(".turn") ? "Drag ◂▸" : t.matches(".map__gl") ? "Drag · hover" : (t as HTMLAnchorElement).target === "_blank" ? "Open ↗" : "Go ↘";
    });
    listen(document.documentElement, "pointerleave", () => cur.classList.remove("is-on"));

    $$(".magnetic").forEach((el) => {
      const mx = gsap.quickTo(el, "x", { duration: 0.6, ease: "power3" }), my = gsap.quickTo(el, "y", { duration: 0.6, ease: "power3" });
      listen(el, "pointermove", (ev) => { const e = ev as PointerEvent, r = el.getBoundingClientRect(); mx((e.clientX - (r.left + r.width / 2)) * 0.25); my((e.clientY - (r.top + r.height / 2)) * 0.35); });
      listen(el, "pointerleave", () => { mx(0); my(0); });
    });

    // the name thins under the cursor (variable-font weight axis); the outline layer follows so they stay aligned
    const chars = $$(".hero__first .char"), outl = $$(".hero__outline .char");
    if (hero && chars.length) {
      const setters = chars.map((c, i) => {
        const a = gsap.quickTo(c, "--wght", { duration: 0.6, ease: "power3" });
        const b = outl[i] ? gsap.quickTo(outl[i], "--wght", { duration: 0.6, ease: "power3" }) : null;
        return (v: number) => { a(v); if (b) b(v); };
      });
      listen(hero, "pointermove", (ev) => {
        const e = ev as PointerEvent;
        chars.forEach((c, i) => {
          const r = c.getBoundingClientRect();
          const d = (e.clientX - (r.left + r.width / 2)) / 260;
          setters[i](880 - 300 * Math.exp(-d * d));
        });
      });
      listen(hero, "pointerleave", () => setters.forEach((fn) => fn(880)));
    }
  }

  // ---------------- keys: contact shortcuts, anchors, replay ----------------
  function setupKeys() {
    let contactActive = false;
    ScrollTrigger.create({ trigger: "#contact", start: "top 60%", end: "bottom top", onToggle: (st) => { contactActive = st.isActive; } });
    listen(document, "keydown", (ev) => {
      const e = ev as KeyboardEvent;
      if (!contactActive || e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      if ((e.target as HTMLElement).closest("input, textarea, [contenteditable]")) return;
      const a = $<HTMLAnchorElement>(`.contact [data-key="${e.key.toUpperCase()}"]`);
      if (a) { e.preventDefault(); a.click(); }
    });
    listen(document, "click", (ev) => {
      const a = (ev.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="#"]');
      if (!a) return;
      const hash = a.getAttribute("href")!;
      if (hash.length < 2 || !document.getElementById(hash.slice(1))) return;
      ev.preventDefault();
      scrollToHash(hash);
      history.replaceState(null, "", hash === "#top" ? location.pathname + location.search : hash);
    });
    const replay = $("#replayIntro");
    if (replay) listen(replay, "click", () => { try { sessionStorage.removeItem("oms.intro"); } catch {} location.href = location.pathname + "?intro"; });
    listen(window, "oms:motion", (ev) => {
      reduce = (ev as CustomEvent<{ reduce: boolean }>).detail.reduce;
      fx.reduce = reduce;
      if (reduce) { lenis?.destroy(); lenis = null; fx.hero.glitch = 0; ambient.forEach((t) => t.pause()); }
      else { startLenis(); ambient.forEach((t) => t.resume()); }
    });
  }

  return () => disposers.reverse().forEach((d) => { try { d(); } catch {} });
}

export default function Experience() {
  useEffect(() => {
    const dispose = run();
    return dispose;
  }, []);
  return null;
}
