"use client";

// Hero portrait in WebGL, covering the whole hero.
// The portrait is a short performance from a Google Flow clip animated from Oscar's real photo (frame 0 is that
// photo), each frame cut out locally with macOS Vision. One timeline, three drivers:
//   - entrance: once the HUD has booted, he pushes his sunglasses up (played at the clip's own speed);
//   - hover (mouse only): he smiles, and the smile fades when the pointer leaves;
//   - scroll: the smile, then the head turn, scrubbed with the hero's pinned scroll.
// Frames are spaced by measured motion (dense where he moves fast) and neighbours are crossfaded. A neon rim
// follows the outline of whichever frame is showing. At rest the pointer gives the photo a small 3D tilt on a relief
// mesh whose depth comes from the cut-out's own outline (no invented facial geometry). Sakura petals fall behind and
// in front. Boot keeps the scan-line reveal and short glitches.
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { images } from "@/lib/content";
import { fx } from "@/lib/fx";
import { useSite } from "@/lib/store";
import Petals from "./Petals";

const SEQ = images.headTurn;
const POOL = 10; // GPU textures kept for recently shown frames, plus the one being loaded ahead
const BMP_KEEP = 24; // frames kept decoded for the GPU (ImageBitmaps), on top of the textures

const FADE = /* glsl */ `
float bottomFade(float y) { return smoothstep(0.0, 0.12, y); }
`;

const reliefVert = /* glsl */ `
uniform sampler2D uDepth;
uniform vec4 uBox;
uniform float uAspect, uYaw, uPitch, uDepthAmt, uZoom;
varying vec2 vUv;
void main() {
  vUv = uv;
  float h = texture2D(uDepth, vec2(uv.x, 1.0 - uv.y)).r; // textures are stored top row first
  float bw = uBox.z * uAspect;
  vec3 p = vec3((uv.x * 2.0 - 1.0) * bw, (uv.y * 2.0 - 1.0) * uBox.w, h * uDepthAmt * uBox.w);
  float zRest = p.z;
  // yaw around the vertical axis, then pitch around the horizontal axis
  float cy = cos(uYaw), sy = sin(uYaw), cp = cos(uPitch), sp = sin(uPitch);
  p = vec3(p.x * cy + p.z * sy, p.y, -p.x * sy + p.z * cy);
  p = vec3(p.x, p.y * cp - p.z * sp, p.y * sp + p.z * cp);
  // perspective relative to the rest pose, so the untilted photo is projected exactly
  float d = 2.6 * uBox.w;
  float persp = (d - zRest) / (d - p.z);
  gl_Position = vec4(vec2(p.x / uAspect, p.y) * persp * uZoom + uBox.xy, 0.0, 1.0);
}
`;

const reliefFrag = /* glsl */ `
uniform sampler2D uTexA, uTexB;
uniform float uMix, uTime, uReveal, uGlitch, uHover, uTurn, uLit;
uniform vec2 uMouse, uRes, uRim;
varying vec2 vUv;
float h1(float n) { return fract(sin(n * 12.9898) * 43758.5453); }
float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
// the showing frame: two neighbouring frames of the clip, crossfaded
// frames are stored top row first (uploaded unflipped, the fast path), so v is flipped here
vec4 F(vec2 p) { p.y = 1.0 - p.y; return mix(texture2D(uTexA, p), texture2D(uTexB, p), uMix); }
float FA(vec2 p) { p.y = 1.0 - p.y; return mix(texture2D(uTexA, p).a, texture2D(uTexB, p).a, uMix); }
${FADE}
void main() {
  vec2 uv = vUv;
  float t = uTime, g = uGlitch;
  float edge = uReveal * 1.16 - 0.08;
  float d = uv.y - edge;
  float nearEdge = (1.0 - smoothstep(0.0, 0.07, abs(d))) * step(uReveal, 0.999);
  float frame = floor(t * 14.0);
  float band = floor(uv.y * 42.0) + frame * 5.0;
  float shift = (h1(band + 3.1) - 0.5) * 0.11 * step(1.0 - g * 0.6, h1(band));
  float block = floor(uv.y * 6.0) + floor(t * 9.0) * 7.0;
  shift += (h1(block + 1.7) - 0.5) * 0.26 * step(1.0 - g * 0.32, h1(block * 1.31));
  shift *= g;
  shift += (h1(floor(uv.y * 90.0) + frame) - 0.5) * 0.035 * nearEdge;
  // (no glitch band under the pointer any more: hovering makes him smile, and his face stays clean)
  float split = 0.012 * g + 0.018 * nearEdge;
  vec2 p = uv + vec2(shift, 0.0);
  vec4 cR = F(p + vec2(split, 0.0));
  vec4 cG = F(p);
  vec4 cB = F(p - vec2(split, 0.0));
  vec3 col = vec3(cR.r, cG.g, cB.b);
  float a = max(cG.a, max(cR.a, cB.a));
  col += (vec3(0.06, 0.05, -0.04) * (cR.a - cG.a) + vec3(0.04, -0.03, 0.07) * (cB.a - cG.a)) * (g + nearEdge);
  col *= 1.0 - (0.07 * (g + nearEdge)) * step(0.5, fract(uv.y * uRes.y * 0.25));

  // neon rim from the showing frame's own outline: pink on left-facing edges, cyan on right-facing, a little on top
  vec2 gr = vec2(FA(p + vec2(uRim.x, 0.0)) - FA(p - vec2(uRim.x, 0.0)), FA(p + vec2(0.0, uRim.y)) - FA(p - vec2(0.0, uRim.y)));
  float gm = length(gr);
  vec2 n = -gr / max(gm, 1e-4);
  float e = smoothstep(0.04, 0.8, gm);
  float rimPink = e * (pow(clamp(-n.x, 0.0, 1.0), 1.3) + clamp(n.y, 0.0, 1.0) * 0.35);
  float rimCyan = e * pow(clamp(n.x, 0.0, 1.0), 1.3);
  float sweep = exp(-pow((uv.x + uv.y * 0.35 - mix(-0.3, 1.4, uTurn)) * 7.0, 2.0)) * smoothstep(0.02, 0.2, uTurn) * (1.0 - smoothstep(0.85, 1.0, uTurn));
  col += (vec3(1.0, 0.25, 0.5) * rimPink * 1.7 + vec3(0.2, 0.85, 1.0) * rimCyan * 1.25) * cG.a * uLit;
  col += vec3(1.0, 0.45, 0.65) * sweep * 0.22 * cG.a;

  float vis = step(d, 0.0);
  float lead = step(h2(floor(uv * vec2(54.0, 110.0)) + frame), 0.3) * step(0.0, d) * step(d, 0.06);
  vis = max(vis, lead);
  float line = (1.0 - smoothstep(0.0, 0.0035, abs(d))) * step(uReveal, 0.999) * step(0.02, uReveal);
  float f = bottomFade(uv.y);
  gl_FragColor = (vec4(col, a) * vis + vec4(1.0, 0.18, 0.3, 1.0) * line * 0.95 * smoothstep(0.05, 0.6, cG.a)) * f;
}
`;

/** Depth field from the cut-out's alpha: a rounded bevel, flat inside (no invented facial geometry). */
function depthFromAlpha(img: HTMLImageElement) {
  const W = 256, H = Math.round((256 * img.naturalHeight) / img.naturalWidth);
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, W, H);
  const src = ctx.getImageData(0, 0, W, H).data;
  let a = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) a[i] = src[i * 4 + 3] / 255;
  const R = 16;
  const blur = (inp: Float32Array, horiz: boolean) => {
    const out = new Float32Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let s = 0, n = 0;
      for (let k = -R; k <= R; k += 2) {
        const xx = horiz ? x + k : x, yy = horiz ? y : y + k;
        // outside the image counts as body below the frame, empty elsewhere
        const v = xx < 0 || xx >= W ? 0 : yy >= H ? inp[(H - 1) * W + xx] : yy < 0 ? 0 : inp[yy * W + xx];
        s += v; n++;
      }
      out[y * W + x] = s / n;
    }
    return out;
  };
  for (let pass = 0; pass < 2; pass++) a = blur(blur(a, true), false);
  const data = new Uint8Array(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    const v = Math.sqrt(Math.min(1, Math.max(0, (a[i] - 0.5) * 2)));
    data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = Math.round(v * 255);
    data[i * 4 + 3] = 255;
  }
  // rows stay top first, like the frames; the shader flips v when it samples
  const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter; tex.needsUpdate = true;
  return tex;
}

/**
 * A frame as a texture. Preferably an ImageBitmap made off the main thread (uploading one costs ~5 ms on a slow
 * phone, against ~90 ms for an <img>, which the browser decodes again on the main thread at upload). Never flipped on
 * upload (WebGL ignores the flip setting for ImageBitmaps, and browsers differ on the bitmap's own option), so the
 * shader flips v. Premultiplied: by the bitmap's own option, or by WebGL's unpack setting for an <img>.
 * No mipmaps: frames change many times a second, and the frame set is already chosen to match the portrait's size
 * on screen, so a plain upload is enough and keeps every frame change cheap.
 */
function setFrame(t: THREE.Texture, src: HTMLImageElement | ImageBitmap) {
  t.image = src;
  t.flipY = false;
  t.premultiplyAlpha = !(typeof ImageBitmap !== "undefined" && src instanceof ImageBitmap);
  t.needsUpdate = true;
}
const BITMAP: ImageBitmapOptions = { premultiplyAlpha: "premultiply", colorSpaceConversion: "default" };
function frameTexture(img: HTMLImageElement | ImageBitmap) {
  const t = new THREE.Texture();
  setFrame(t, img);
  t.colorSpace = THREE.NoColorSpace;
  t.generateMipmaps = false;
  t.minFilter = THREE.LinearFilter;
  t.magFilter = THREE.LinearFilter;
  return t;
}

type Slot = { tex: THREE.Texture; frame: number; stamp: number };
type Seq = {
  tex0: THREE.Texture | null; // frame 0, the photo itself (also the page's <img>)
  imgs: (HTMLImageElement | null)[];
  bmps: Map<number, ImageBitmap>; // frames already decoded for the GPU, least recently used first
  pend: Set<number>;
  pool: Slot[];
  requested: boolean;
  ready: boolean;
  f: number; // the clip frame being shown (fractional: neighbours crossfade)
  entered: boolean; // the entrance has started
  wait: number; // seconds since the HUD finished booting
  lastT: number; // last scroll target, to tell when scrolling has settled
  still: number; // seconds the scroll target has been still
  stamp: number;
};

const SRC = SEQ.frames; // clip frame number of each picked frame
const REST = SEQ.marks.rest ?? 0; // after the entrance: sunglasses pushed up, hand down
const SMILE = SEQ.marks.smile ?? REST; // full smile, just before the head turn
const POS_REST = SEQ.pos[Math.max(0, SRC.indexOf(REST))];

/** Clip frame at a motion position (0…1 along the whole clip), so scrolling moves him at an even pace. */
function frameAtMotion(m: number) {
  const P = SEQ.pos;
  let k = 0;
  while (k < P.length - 2 && P[k + 1] < m) k++;
  const span = P[k + 1] - P[k];
  const t = span > 0 ? THREE.MathUtils.clamp((m - P[k]) / span, 0, 1) : 1;
  return SRC[k] + t * (SRC[k + 1] - SRC[k]);
}

function Portrait() {
  const { gl, size, invalidate, setFrameloop } = useThree();
  const box = useMemo(() => new THREE.Vector4(0, 0, 0.5, 0.5), []);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: reliefVert,
        fragmentShader: reliefFrag,
        uniforms: {
          uTexA: { value: null }, uTexB: { value: null }, uMix: { value: 0 }, uDepth: { value: null }, uBox: { value: box },
          uAspect: { value: 1 }, uYaw: { value: 0 }, uPitch: { value: 0 }, uDepthAmt: { value: 0.16 }, uZoom: { value: 1 },
          uTurn: { value: 0 }, uLit: { value: 0 }, uTime: { value: 0 }, uReveal: { value: 0 }, uGlitch: { value: 0 },
          uHover: { value: 0 }, uMouse: { value: new THREE.Vector2() }, uRes: { value: new THREE.Vector2(1, 1) },
          // rim width: about 7 pixels of the full-size frame, in texture units (same on the phone frames)
          uRim: { value: new THREE.Vector2(7 / images.hero.w, 7 / images.hero.h) },
        },
        transparent: true, premultipliedAlpha: true, depthTest: false, depthWrite: false,
      }),
    [box],
  );
  const narrow = typeof window !== "undefined" && window.innerWidth < 768;
  const mesh = useMemo(() => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2, narrow ? 110 : 180, narrow ? 100 : 164), material);
    m.frustumCulled = false;
    m.renderOrder = 2;
    return m;
  }, [material, narrow]);
  useEffect(() => () => { material.dispose(); mesh.geometry.dispose(); }, [material, mesh]);
  const mouse = useRef(new THREE.Vector2());
  const seq = useRef<Seq>({ tex0: null, imgs: [], bmps: new Map(), pend: new Set(), pool: [], requested: false, ready: false, f: 0, entered: false, wait: 0, lastT: 0, still: 0, stamp: 0 });
  const canHover = useMemo(() => typeof window !== "undefined" && window.matchMedia("(hover: hover) and (pointer: fine)").matches, []);

  // frame 0 first: the same file as the page's <img>, so the hand-over from HTML to WebGL is invisible
  useEffect(() => {
    let dead = false;
    let depth: THREE.Texture | null = null;
    const S = seq.current;
    (async () => {
      try {
        const img = new Image();
        img.decoding = "async";
        img.src = images.hero.src;
        await img.decode();
        if (dead) return;
        const bmp = typeof createImageBitmap === "function" ? await createImageBitmap(img, BITMAP).catch(() => null) : null;
        if (dead) { bmp?.close(); return; }
        const tex = frameTexture(bmp ?? img);
        S.tex0 = tex;
        depth = depthFromAlpha(img);
        material.uniforms.uTexA.value = tex;
        material.uniforms.uTexB.value = tex;
        material.uniforms.uDepth.value = depth;
        fx.debug.heroTex = `${img.naturalWidth}x${img.naturalHeight}`;
        gl.initTexture(tex);
        invalidate();
        requestAnimationFrame(() => requestAnimationFrame(() => {
          if (dead) return;
          document.getElementById("heroPortrait")?.classList.add("gl-on");
          useSite.getState().set({ heroGL: "ready" });
        }));
      } catch (err) {
        console.warn("Hero WebGL unavailable:", err);
        useSite.getState().set({ heroGL: "failed" });
      }
    })();
    return () => {
      dead = true;
      S.tex0?.dispose();
      depth?.dispose();
      S.pool.forEach((s) => s.tex.dispose());
      S.bmps.forEach((b) => b.close());
      Object.assign(S, { tex0: null, imgs: [], bmps: new Map(), pend: new Set(), pool: [], requested: false, ready: false, f: 0, entered: false, wait: 0, lastT: 0, still: 0 });
    };
  }, [gl, invalidate, material]);

  /**
   * The other frames load after the intro film, so they never compete with it. Phones, and screens where the portrait
   * is drawn no taller than the small frames, get the small set (lighter to load, decode and upload).
   */
  const loadSeq = () => {
    const S = seq.current;
    S.requested = true;
    const shown = (document.getElementById("heroPortrait")?.getBoundingClientRect().height ?? window.innerHeight) * Math.min(window.devicePixelRatio || 1, 2);
    const phone = window.matchMedia("(max-width: 1023px)").matches || shown <= SEQ.mh * 1.15;
    const dir = `${SEQ.dir}/${phone ? "m" : "d"}/`;
    const imgs: (HTMLImageElement | null)[] = new Array(SEQ.count).fill(null);
    const settled: boolean[] = new Array(SEQ.count).fill(false); // loaded, or given up after retries
    settled[0] = true;
    S.imgs = imgs;
    fx.debug.heroSeq.set = phone ? "m" : "d";
    // the entrance first, then the smile, then the turn, a few at a time: decoding dozens of large frames at once
    // can fail or stall on a busy machine, and one missing frame must never hold the whole performance back
    const stage = (k: number) => (SRC[k] <= REST ? 0 : SRC[k] <= SMILE ? 1 : 2);
    const queue = Array.from({ length: SEQ.count - 1 }, (_, k) => k + 1).sort((x, y) => stage(x) - stage(y) || x - y);
    const entrance = queue.filter((k) => stage(k) === 0);
    let active = 0;
    const update = () => {
      if (!S.ready && entrance.every((k) => settled[k])) S.ready = fx.debug.heroSeq.ready = true;
      fx.debug.heroSeq.loaded = imgs.filter(Boolean).length;
      fx.debug.heroSeq.failed = settled.filter((s, k) => s && k > 0 && !imgs[k]).length;
    };
    const load = (k: number, attempt: number) => {
      const img = new Image();
      img.decoding = "async";
      img.src = `${dir}${String(k).padStart(2, "0")}.webp`;
      img.decode().then(
        () => {
          if (S.imgs !== imgs) return;
          imgs[k] = img;
          settled[k] = true;
          if (stage(k) === 0) prepare(k); // the entrance plays first: have these ready for the GPU
          active--;
          update();
          pump();
        },
        () => {
          if (S.imgs !== imgs) return;
          if (attempt < 3) {
            window.setTimeout(() => load(k, attempt + 1), 600 * attempt);
            return;
          }
          settled[k] = true; // skipped: its neighbours crossfade across the gap
          active--;
          update();
          pump();
        },
      );
    };
    const pump = () => {
      while (active < 4 && queue.length) {
        active++;
        load(queue.shift()!, 1);
      }
    };
    pump();
  };

  /**
   * Decode a frame for the GPU off the main thread (an ImageBitmap), ahead of showing it. A few dozen are kept, least
   * recently used dropped first (never one a texture is still showing); without createImageBitmap, frames upload as
   * <img> as before.
   */
  const prepare = (k: number) => {
    const S = seq.current;
    const img = S.imgs[k];
    if (k <= 0 || !img || S.bmps.has(k) || S.pend.has(k) || typeof createImageBitmap !== "function") return;
    S.pend.add(k);
    const imgs = S.imgs;
    createImageBitmap(img, BITMAP).then(
      (b) => {
        S.pend.delete(k);
        if (S.imgs !== imgs) { b.close(); return; }
        S.bmps.set(k, b);
        for (const [f, old] of S.bmps) {
          if (S.bmps.size <= BMP_KEEP) break;
          if (S.pool.some((s) => s.tex.image === old)) continue;
          old.close(); S.bmps.delete(f);
        }
      },
      () => { S.pend.delete(k); },
    );
  };

  /** GPU texture for a frame: frame 0 stays resident; others share a small pool (least recently shown is reused). */
  const texFor = (i: number): THREE.Texture | null => {
    const S = seq.current;
    if (i === 0) return S.tex0;
    let slot = S.pool.find((s) => s.frame === i);
    if (!slot) {
      const bmp = S.bmps.get(i);
      if (bmp) { S.bmps.delete(i); S.bmps.set(i, bmp); } // most recently used goes last
      else prepare(i); // for next time; this time the <img> uploads directly
      const src = bmp ?? S.imgs[i];
      if (!src) return null;
      if (S.pool.length < POOL) {
        slot = { tex: frameTexture(src), frame: i, stamp: 0 };
        S.pool.push(slot);
      } else {
        slot = S.pool.reduce((x, y) => (x.stamp <= y.stamp ? x : y));
        setFrame(slot.tex, src);
        slot.frame = i;
      }
    }
    slot.stamp = ++S.stamp;
    return slot.tex;
  };

  useEffect(() => {
    const el = document.querySelector(".hero");
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setFrameloop(e.isIntersecting ? "always" : "never"), { rootMargin: "80px" });
    io.observe(el);
    return () => io.disconnect();
  }, [setFrameloop]);

  // where the portrait sits inside the canvas. Scrolling moves both together and nothing animates the portrait's box,
  // so it's measured again only when either changes size (reading it every frame forced a layout per frame while the
  // page's other animations were changing styles)
  const boxDirty = useRef(true);
  useEffect(() => {
    const mark = () => { boxDirty.current = true; };
    const ro = new ResizeObserver(mark);
    ro.observe(gl.domElement);
    const portrait = document.getElementById("heroPortrait");
    if (portrait) ro.observe(portrait);
    addEventListener("resize", mark);
    return () => { ro.disconnect(); removeEventListener("resize", mark); };
  }, [gl]);

  useFrame((state, dt) => {
    dt = Math.min(dt, 0.05);
    fx.debug.heroFrames++;
    if (boxDirty.current) {
      const hero = gl.domElement.getBoundingClientRect();
      const p = document.getElementById("heroPortrait")?.getBoundingClientRect();
      if (p && hero.width > 0) {
        box.set(((p.left + p.width / 2 - hero.left) / hero.width) * 2 - 1, 1 - ((p.top + p.height / 2 - hero.top) / hero.height) * 2, p.width / hero.width, p.height / hero.height);
        boxDirty.current = false;
      }
    }
    const u = material.uniforms;
    const S = seq.current;
    if (!S.requested && !fx.reduce && S.tex0 && useSite.getState().phase !== "intro") loadSeq();
    const turn = fx.reduce ? 0 : fx.hero.turn;
    const k = 1 - Math.exp(-dt * 5);
    const tx = fx.reduce ? 0 : fx.hero.mx, ty = fx.reduce ? 0 : fx.hero.my;
    mouse.current.x += (tx - mouse.current.x) * k;
    mouse.current.y += (ty - mouse.current.y) * k;
    const ease = turn * turn * (3 - 2 * turn);
    // the pointer tilt belongs to the resting photo; it hands over to the real turn as soon as scrolling starts
    const tilt = 1 - THREE.MathUtils.smoothstep(turn, 0, 0.12);

    // the performance: one clip timeline driven by the entrance, hover and scroll
    const prog = THREE.MathUtils.clamp((turn - 0.04) / 0.72, 0, 1); // the hero pin's progress, held at both ends
    let target = 0, follow = false;
    if (S.ready && !fx.reduce) {
      if (!S.entered && useSite.getState().phase === "site") { S.wait += dt; S.entered = S.wait > 0.35; }
      if (S.entered) {
        const scrollT = prog > 0 ? frameAtMotion(POS_REST + prog * (1 - POS_REST)) : REST;
        const hoverT = canHover && fx.hero.hover > 0.5 ? SMILE : REST;
        target = Math.max(hoverT, scrollT);
        follow = prog > 0.001 && scrollT >= hoverT && S.f >= REST - 0.5;
      }
    }
    if (follow) {
      // scrolling: crossfade while it moves; once it settles, rest on a real frame (never two faces blended)
      S.still = Math.abs(target - S.lastT) < 0.02 ? S.still + dt : 0;
      S.lastT = target;
      if (S.still > 0.15) target = SRC.reduce((b, s) => (Math.abs(s - target) < Math.abs(b - target) ? s : b), SRC[0]);
      S.f += (target - S.f) * (1 - Math.exp(-dt * 9));
    } else {
      // entrance and hover play at the clip's own speed (3× when a scroll is waiting for the entrance to finish)
      const speed = SEQ.fps * (S.f < REST && prog > 0.05 ? 3 : 1);
      S.f += THREE.MathUtils.clamp(target - S.f, -speed * dt, speed * dt);
    }
    if (Math.abs(target - S.f) < 0.01) S.f = target;
    let i = 0;
    while (i < SRC.length - 2 && SRC[i + 1] <= S.f) i++;
    // the nearest frames that have actually loaded on each side of the playhead (still loading, or skipped)
    const has = (k: number) => (k === 0 ? !!S.tex0 : !!S.imgs[k]);
    let a = i;
    while (a > 0 && !has(a)) a--;
    let b = i + 1;
    while (b < SRC.length - 1 && !has(b)) b++;
    if (!has(b)) b = a;
    const mix = b > a ? THREE.MathUtils.clamp((S.f - SRC[a]) / (SRC[b] - SRC[a]), 0, 1) : 0;
    const ta = texFor(a);
    const tb = mix > 0.002 ? texFor(b) : null;
    if (ta) {
      u.uTexA.value = ta;
      u.uTexB.value = tb ?? ta;
      u.uMix.value = tb ? mix : 0;
    }
    // load the next frame in the direction of travel onto the GPU now, so showing it later costs nothing
    if (Math.abs(target - S.f) > 0.01) {
      const ahead = target > S.f ? b + 1 : a - 1;
      const dir = target > S.f ? 1 : -1;
      for (let k = 1; k <= 4; k++) prepare(ahead + dir * k);
      if (ahead > 0 && ahead < SRC.length && has(ahead)) {
        const t = texFor(ahead);
        if (t) gl.initTexture(t);
      }
    }
    fx.debug.heroSeq.i = i;
    fx.debug.heroSeq.mix = tb ? mix : 0;
    fx.debug.heroSeq.f = S.f;

    u.uTurn.value = turn;
    u.uLit.value = Math.min(1, turn * 2 + Math.abs(mouse.current.x) * 0.25 * tilt);
    u.uYaw.value = mouse.current.x * 0.12 * tilt;
    u.uPitch.value = -mouse.current.y * 0.06 * tilt;
    u.uZoom.value = 1 + 0.04 * ease;
    u.uAspect.value = size.width / Math.max(1, size.height);
    u.uTime.value += dt;
    u.uReveal.value = fx.hero.reveal;
    u.uGlitch.value = fx.reduce ? 0 : Math.min(1, fx.hero.glitch + fx.hero.scroll);
    fx.hero.scroll *= Math.exp(-dt * 5);
    fx.wind.v *= Math.exp(-dt * 1.5);
    (u.uMouse.value as THREE.Vector2).copy(mouse.current);
    u.uHover.value += ((fx.reduce ? 0 : fx.hero.hover) - u.uHover.value) * k;
    (u.uRes.value as THREE.Vector2).set(size.width * state.viewport.dpr, size.height * state.viewport.dpr);
  });

  return <primitive object={mesh} />;
}

export default function HeroGL() {
  const narrow = typeof window !== "undefined" && window.innerWidth < 768;
  return (
    <Canvas
      className="gl"
      dpr={[1, 2]}
      flat
      linear
      frameloop="always"
      gl={{ alpha: true, antialias: true, premultipliedAlpha: true, powerPreference: "high-performance" }}
      onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      aria-hidden="true"
    >
      <Petals layer={0} count={narrow ? 60 : 120} />
      <Portrait />
      <Petals layer={1} count={narrow ? 60 : 120} />
    </Canvas>
  );
}
