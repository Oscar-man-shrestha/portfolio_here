# portfolio_here

Portfolio of Oscar Man Shrestha — software engineer working across machine learning, security and the web.

Next.js (App Router) · React · TypeScript · Tailwind CSS · three.js / React Three Fiber · GSAP · Lenis.

```bash
npm install
npm run build && npm run start   # http://localhost:4500
```

- `?skip` jumps past the intro film, `?intro` forces it, `?motion=reduce` tests reduced motion.
- All facts shown on the site live in `lib/content.ts`.

## What's inside

- `/`: the intro film as loader, then a scroll-driven HUD:
  - the hero photo turns into 3D particles while you scroll;
  - Contribution City (real GitHub data);
  - an open-source log;
  - a pinned operator turntable of four real views;
  - contact with keyboard shortcuts.
- `/work/[slug]`: one page per project, with facts from its README and a small interactive demo, clearly labelled as an illustration.
- Motion respects `prefers-reduced-motion`, and a Motion switch in the header turns it off.
