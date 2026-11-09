"use client";

// Motion for project pages: Lenis smooth scroll, the hiding header, and reveals. Respects reduced motion and the
// site's Motion switch.
import { useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import Lenis from "lenis";
import { fx } from "@/lib/fx";

gsap.registerPlugin(ScrollTrigger, SplitText);

export default function ProjectFX() {
  useEffect(() => {
    const root = document.documentElement;
    const reduce = root.classList.contains("reduce-motion");
    fx.reduce = reduce;
    const ctx = gsap.context(() => {});
    let lenis: Lenis | null = null;
    const tick = (t: number) => lenis?.raf(t * 1000);
    if (!reduce) {
      lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
      lenis.on("scroll", ScrollTrigger.update);
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);
    }
    const header = document.getElementById("header");
    let lastY = 0;
    ctx.add(() => {
      ScrollTrigger.create({
        start: 0, end: "max",
        onUpdate: (st) => {
          const y = st.scroll();
          header?.classList.toggle("is-hidden", y > innerHeight * 0.6 && y > lastY && !root.classList.contains("menu-open"));
          lastY = y;
        },
      });
      if (reduce) return;
      // arriving through the card-to-page morph, the title and art are already in place
      const morphed = root.getAttribute("data-vt") === "1";
      const title = morphed ? null : document.querySelector(".pj__title");
      if (title) {
        SplitText.create(title, {
          type: "lines,words,chars", mask: "lines", autoSplit: true,
          onSplit: (self) => gsap.from(self.chars, { yPercent: 110, duration: 1.1, ease: "expo.out", stagger: 0.02, delay: 0.1 }),
        });
      }
      gsap.from(".pj__tag, .pj__links, .pj__top", { y: 24, opacity: 0, duration: 1, ease: "expo.out", stagger: 0.08, delay: 0.35 });
      if (!morphed) gsap.from(".pj__art", { clipPath: "inset(0 0 100% 0)", duration: 1.3, ease: "expo.inOut", delay: 0.2, clearProps: "clipPath" });
      gsap.utils.toArray<HTMLElement>("[data-reveal], .pj__demo").forEach((el) =>
        gsap.from(el, { y: 40, opacity: 0, duration: 1.1, ease: "expo.out", scrollTrigger: { trigger: el, start: "top 88%", once: true } }));
      // the mission film plays once when it comes into view, then holds on its last frame. It dissolves in over the
      // poster behind it (that same last frame) once frames are moving, so the start is a fade rather than a cut
      const film = document.querySelector<HTMLVideoElement>(".pj__film video");
      if (film) {
        film.addEventListener("playing", () => film.parentElement?.classList.add("is-on"), { once: true });
        ScrollTrigger.create({ trigger: film, start: "top 75%", once: true, onEnter: () => { film.preload = "auto"; film.play().catch(() => {}); } });
      }
    });
    return () => {
      ctx.revert();
      gsap.ticker.remove(tick);
      lenis?.destroy();
    };
  }, []);
  return null;
}
