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
  - On the site copy, a logo-like emblem is cut out and the corner AI mark removed.
  - the hero is a short performance from a Google Flow clip animated from Oscar's real photo: he pushes his sunglasses up as the site opens, smiles when you hover over him, and smiles then turns his head as you scroll. 64 frames, never more than 4 clip frames apart, cut out with macOS Vision and played in WebGL with a neon rim, with sakura petals around him;
  - Selected work, a mission-select wheel on every screen at least 500px tall, phones included: the project cards sit on a wheel around a dial and scrolling turns it, settling on each card. The front card draws its line-art diagram, then its Google Flow mission film (Baton, Malware Fingerprint, RAKSHA, Eval Validity) fades in and holds its last frame. Clicking a card at the side brings it forward, and keyboard focus turns the wheel to the focused card. Shorter screens, such as a phone held sideways, get a list where each film plays as its card scrolls into view. The same film opens each project page;
  - Contribution City (real GitHub data);
  - an open-source log;
  - a pinned operator turntable: Oscar turns from front to back as you scroll, holding at each of four views. It's a Google Flow clip cut into 41 frames (`--person-only` drops the studio turntable disc);
  - contact with keyboard shortcuts;
  - a 60-second guided tour for recruiters (see below);
  - OMS-mini, an on-device guide: a small figure of Oscar stands bottom-right. Click him (or press `/`) to ask about Oscar's work; answers come from the site's own content and can turn the mission wheel or scroll to what they mention (see below).
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

## Mission films

The project films in `public/video/work` are 960×540 H.264 files without audio, made from 1080p Google Flow clips. Their posters in `public/img/work` are each film's last frame. Like the other media, the file names carry a content hash, so a re-encoded film gets a new address.

Flow puts a small AI mark in the bottom-right corner (x 1704–1775, y 864–935 at 1080p). It is removed in one of two ways:
- **Crop past it** when the subject leaves room (Baton, Malware Fingerprint):

```bash
ffmpeg -i clip.mp4 -vf "crop=1584:891:112:94,scale=960:540:flags=lanczos" -an -c:v libx264 -preset slow -crf 25 -pix_fmt yuv420p -profile:v high -movflags +faststart film.mp4
```

- **Un-blend it** when cropping would cut into the subject or push it off-centre (RAKSHA, Eval Validity). The mark is a fixed, semi-transparent white star, so `tools/film/clean_film.py` subtracts it using its measured alpha (`tools/film/mark-alpha-1080.npy`, made with `tools/film/measure_mark.py` on clips whose corner is dark). It then fills the thin outline band, which compression smears, from neighbouring pixels. It needs ffmpeg, and Python 3 with numpy and scipy:

```bash
python3 tools/film/clean_film.py clip.mp4 tools/film/mark-alpha-1080.npy film.mp4 /tmp/film-check
```

Grab the poster with `ffmpeg -sseof -0.3 -i film.mp4 -update 1 -q:v 3 poster.jpg`. Then add `film: { video, poster, focus? }` to the project in `lib/content.ts`. `focus` is the CSS `object-position` used on the card, where the film is cropped to the card's shape.

## The 60-second tour

For recruiters who skim: the small figure of Oscar walks the visitor through the evidence in about a minute. It covers who he is, each project on the mission wheel, live GitHub activity, merged and lined-up pull requests, the Loadout, and how to reach him. A spotlight frames each piece of evidence while OMS-mini's line appears beside the figure.

- **Start it** from the hero's "60-second tour" button, by asking OMS-mini for "the tour", or by opening the site with `?tour`. Put `https://your-domain/?tour` on a CV or in an email to send people straight into it.
- **Controls:** it moves on by itself; Pause, Back, Next, the arrow keys, and Esc to leave. Scrolling by hand pauses it.
- **Content:** `lib/tour.ts` writes every line from the same data the page shows (`lib/content.ts` and the live GitHub data), and keeps each project's caveat. So the tour never says anything the site doesn't, and it updates as GitHub does. `components/Tour.tsx` runs it.

## Card-to-page morph

Opening a project from the mission wheel morphs the card into its page: the card's art, title and number fly into the project page's art, title and number while the rest cross-fades. Going from one project page to the next morphs the same way. This uses the browser's own cross-document View Transitions:
- **Home page:** the boot script in `app/layout.tsx` names the opening card's parts just before the page hands over, and only when the card is on screen.
- **Project page:** it names its own parts in `app/globals.css` (v12), and skips its title and art entrance animations after a morph.

Supported in Chrome, Edge and Safari 18.2+. Other browsers load the page as before, and reduced motion turns the morph off.

## Share card

When the site's link is shared (LinkedIn, Slack, WhatsApp, X), the preview card is `public/og.png`: Oscar's real hero cut-out (frame 0 of the hero clip, unchanged) on the red sun, with his name and role in the site's fonts (Mona Sans and JetBrains Mono, both OFL, fetched from Google Fonts). The name, role, base and disciplines come from `lib/content.ts`. Rebuild it after changing any of them:

```bash
python3 tools/og/build.py
```

When the site is deployed, set `SITE_URL` (for example `https://your-domain.com`) so the card's address is absolute. On Vercel the production address is picked up on its own.

## Live GitHub data

Everything the site shows from GitHub is read from GitHub itself and refreshed every hour, so it keeps up without editing the code (`lib/github.ts`):
- **Contribution City:** the last year of contributions, from the public calendar on Oscar's profile.
- **Open source:** pull requests to other people's projects that are merged, or open and lined up by the maintainers (a label such as "plan to merge", or a milestone such as "Release 0.12"). Closed-without-merging and unlabelled open PRs are left out. Newly merged PRs appear on their own. Card titles come from GitHub unless `prTitles` in `lib/content.ts` gives a shorter one.
- **The hero's PR count, Baton's version tag** (its latest GitHub release) and OMS-mini's answers about all of these.

How it stays live: the home page and project pages set `revalidate = 3600`. On Vercel, or any server running `next start`, Next.js rebuilds a page in the background at most once an hour, when someone visits. No key is needed. To raise GitHub's rate limit (useful on Vercel, whose servers share addresses), you can add a `GITHUB_TOKEN` environment variable: a fine-grained token with no permissions at all is enough. It's optional.

When GitHub can't be reached:
- **While the site is running:** visitors keep seeing the last good version; the next refresh tries again.
- **During a build:** the snapshot is used instead (`data/contrib.json`, `prSnapshot` in `lib/content.ts`), with a warning in the build log, so a build never fails because of GitHub.

A static export (for example GitHub Pages) can't refresh on its own. It would need a scheduled rebuild, such as a daily GitHub Actions workflow.

## OMS-mini (the on-device guide)

A small figure of Oscar stands in the bottom-right corner of the home page. Click or tap him, or press `/`, and OMS-mini opens: a HUD terminal (a bottom sheet on phones) where visitors ask about Oscar's projects, skills, open-source work or how to reach him. An answer can also move the page: turn the mission wheel to a project (whose film then plays) or scroll to a section.

**No API key, no server, no cost.** Everything runs in the visitor's browser and nothing they type leaves it.
- **Understanding the question:** all-MiniLM-L6-v2 (Apache-2.0), an 8-bit, 23 MB sentence model, turns the question into a vector on ONNX Runtime Web (MIT), in a web worker. Both are served from this site (`public/models/minilm-l6-v2-q8/`, `public/vendor/ort-1.31.1/`), and the model loads the first time the panel opens. Until it has loaded, or on a data-saver connection, OMS-mini matches by keywords instead.
- **Answering:** every answer is a card written from the same data the page renders (`lib/guide-kb.ts`, built from `lib/content.ts` and `lib/contrib.ts`), so OMS-mini can only say what the site says and can't make anything up. The engine (`lib/guide-engine.ts`) picks the card: keyword scores, then meaning (cosine similarity against example questions), plus rules for "does he know X?", "tell me more" and follow-ups such as "how does it work?" about the project last discussed. Anything off the site gets a plain "I can only answer from this site" with Oscar's email.
- **Links:** the panel renders a small markdown subset itself and turns only this site's paths, Oscar's email and the hosts in `LINK_HOSTS` (`lib/guide.ts`) into links.

### After changing the content

The example questions' vectors are worked out ahead of time and served in `public/guide/vectors.json`, so the first open only has to load the model (about 2 to 4 seconds; then 2 seconds on a return visit, from the browser's cache). After editing `lib/content.ts` or `lib/guide-kb.ts`, regenerate them:

```bash
npx next build && npx next start -p 4500
```

```bash
node tools/guide/vectors.mjs http://localhost:4500
```

The script runs the site's own model in a headless Chrome-family browser (set `CHROME` to its binary if it isn't found). If you forget, nothing breaks: OMS-mini sees that the file doesn't match its questions and works the vectors out in the visitor's browser, which takes longer on the first open.

### The figure

The figure is a Google Flow image made from Oscar's own photo (a realistic 1/6-scale collectible figure, to keep his face as close as possible), then a Flow clip of it waving hello and settling back into its first pose. `tools/pet/build.py` cuts the figure out of every frame with macOS Vision (`tools/headturn/lift.m`, on-device), drops the clip's corner mark, and packs 76 frames into one WebP sheet with transparency (about 600 KB), plus a 10 KB still:

```bash
clang -fobjc-arc -framework Foundation -framework Vision -framework CoreImage -framework ImageIO -framework CoreVideo -framework CoreGraphics tools/headturn/lift.m -o /tmp/lift
```

```bash
python3 tools/pet/build.py /tmp/lift path/to/clip.mp4
```

It writes `public/img/pet/<hash>/` and `lib/pet.json`. The still shows at once. The sheet loads after the intro, once the browser is idle, and plays on a canvas (`components/Pet.tsx`). The figure waves when it first appears (with a short "Hi!" bubble, once per visit), when a mouse comes over it, when the panel opens, and every 30 to 45 seconds on its own. With reduced motion it stands still.
