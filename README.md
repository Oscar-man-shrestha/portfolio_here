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

- `/`: the intro film as loader, then a scroll-driven HUD.
  - The film is "Who is Oscar?", a 43-second cyber-thriller made in Google Flow (`lib/film.ts`). It plays muted until the visitor presses Sound, and a red flash cuts into the hero.
  - On the site copy, a logo-like emblem is cut out and the corner AI mark removed. The footer credits Google Flow.
  - the hero is a short performance from a Google Flow clip animated from Oscar's real photo: he pushes his sunglasses up as the site opens, smiles when you hover over him, and smiles then turns his head as you scroll. 64 frames, never more than 4 clip frames apart, cut out with macOS Vision and played in WebGL with a neon rim, with sakura petals around him;
  - Contribution City (real GitHub data);
  - an open-source log;
  - a pinned operator turntable of four real views;
  - contact with keyboard shortcuts.
- `/work/[slug]`: one page per project, with facts from its README and a small interactive demo, clearly labelled as an illustration.
- Motion respects `prefers-reduced-motion`, and a Motion switch in the header turns it off.

## Rebuilding the hero portrait

The frames in `public/img/headturn` and their data in `lib/headturn.json` come from `tools/headturn` (macOS only, since the cut-out uses Apple Vision). It needs ffmpeg, cwebp, and Python 3 with numpy, scipy and Pillow.

`lift.m` cuts out the subject. `segp.m` produces Vision's person matte. The build only needs it to repair a far sunglasses lens, for clips where the subject cut-out treats the tinted lens as see-through and keeps only its frame.

```bash
clang -fobjc-arc -framework Foundation -framework Vision -framework CoreImage -framework ImageIO -framework CoreVideo -framework CoreGraphics tools/headturn/lift.m -o /tmp/lift
python3 tools/headturn/build.py path/to/clip.mp4 /tmp/lift --turn 0:172 --head 900:760:510:0 --marks rest=72,smile=124 --lens none --frames 42 --max-gap 4 --phone-height 700
```

These are the settings for the current clip:
- `--turn` is the range of frames used.
- `--head` is the area watched for motion.
- `--marks` are the frames the site stops on: after the sunglasses push, and at the full smile.
- `--frames` and `--max-gap` set the density: frames are spaced by motion (dense where he moves fast), and never more than 4 clip frames apart, so slow moments don't crossfade like a dissolve.

Frames are written to a folder named after the clip and the frame selection. The site caches images for a year, so a rebuilt set must never reuse an old set's addresses.

For a clip that needs the lens repair, compile `segp.m` the same way, pass it after the lift tool, and set `--lens x0:y0:x1:y1` instead of `none`.
