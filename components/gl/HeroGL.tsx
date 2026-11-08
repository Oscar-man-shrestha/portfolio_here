"use client";

// Hero portrait in WebGL, covering the whole hero.
// The cut-out photo is laid on a relief mesh: flat in the middle, rounded at the silhouette (the depth comes from
// the cut-out's own outline, not invented from the face). At rest the projection is exact, so the photo shows
// untouched. Scrolling turns the relief in 3D (about 35°) with neon rim light sweeping its edges; the pointer adds a
// small tilt. Sakura petals fall behind and in front. Boot keeps the scan-line reveal and short glitches.
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { images } from "@/lib/content";
import { fx } from "@/lib/fx";
import { useSite } from "@/lib/store";
import Petals from "./Petals";

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
  float h = texture2D(uDepth, uv).r;
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
uniform sampler2D uTex, uDepth;
uniform float uTime, uReveal, uGlitch, uHover, uTurn, uYaw, uPitch;
uniform vec2 uMouse, uRes, uTexel;
varying vec2 vUv;
float h1(float n) { return fract(sin(n * 12.9898) * 43758.5453); }
float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
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
  float hb = (1.0 - smoothstep(0.0, 0.035, abs(uv.y - (uMouse.y * 0.5 + 0.5)))) * uHover * (1.0 - uTurn);
  shift += hb * 0.012 * sin(t * 40.0 + uv.y * 300.0);
  float split = 0.012 * g + 0.018 * nearEdge + 0.006 * hb;
  vec2 p = uv + vec2(shift, 0.0);
  vec4 cR = texture2D(uTex, p + vec2(split, 0.0));
  vec4 cG = texture2D(uTex, p);
  vec4 cB = texture2D(uTex, p - vec2(split, 0.0));
  vec3 col = vec3(cR.r, cG.g, cB.b);
  float a = max(cG.a, max(cR.a, cB.a));
  col += (vec3(0.06, 0.05, -0.04) * (cR.a - cG.a) + vec3(0.04, -0.03, 0.07) * (cB.a - cG.a)) * (g + nearEdge);
  col *= 1.0 - (0.07 * (g + nearEdge)) * step(0.5, fract(uv.y * uRes.y * 0.25));

  // relief normal from the depth field, turned with the mesh; rims only where the surface curves
  float hx = texture2D(uDepth, uv + vec2(uTexel.x, 0.0)).r - texture2D(uDepth, uv - vec2(uTexel.x, 0.0)).r;
  float hy = texture2D(uDepth, uv + vec2(0.0, uTexel.y)).r - texture2D(uDepth, uv - vec2(0.0, uTexel.y)).r;
  vec3 n = normalize(vec3(-hx * 3.0, -hy * 3.0, 1.0));
  float cy = cos(uYaw), sy = sin(uYaw);
  n = vec3(n.x * cy + n.z * sy, n.y, -n.x * sy + n.z * cy);
  float curve = 1.0 - n.z;
  float rimPink = pow(clamp(-n.x, 0.0, 1.0), 1.5) * curve;
  float rimCyan = pow(clamp(n.x, 0.0, 1.0), 1.5) * curve;
  float sweep = exp(-pow((uv.x + uv.y * 0.35 - mix(-0.3, 1.4, uTurn)) * 7.0, 2.0)) * smoothstep(0.02, 0.2, uTurn) * (1.0 - smoothstep(0.85, 1.0, uTurn));
  float lit = clamp(uTurn * 2.0 + abs(uMouse.x) * 0.25, 0.0, 1.0);
  col += (vec3(1.0, 0.25, 0.5) * rimPink * 2.2 + vec3(0.2, 0.85, 1.0) * rimCyan * 1.6) * cG.a * lit;
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
  // DataTexture rows start at the bottom; flip so uv.y matches the photo texture (which uses flipY)
  const flipped = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) flipped.set(data.subarray(y * W * 4, (y + 1) * W * 4), (H - 1 - y) * W * 4);
  const tex = new THREE.DataTexture(flipped, W, H, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter; tex.needsUpdate = true;
  return { tex, W, H };
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
          uTex: { value: null }, uDepth: { value: null }, uBox: { value: box }, uAspect: { value: 1 }, uYaw: { value: 0 }, uPitch: { value: 0 },
          uDepthAmt: { value: 0.16 }, uZoom: { value: 1 }, uTurn: { value: 0 }, uTime: { value: 0 }, uReveal: { value: 0 }, uGlitch: { value: 0 },
          uHover: { value: 0 }, uMouse: { value: new THREE.Vector2() }, uRes: { value: new THREE.Vector2(1, 1) }, uTexel: { value: new THREE.Vector2(1 / 256, 1 / 232) },
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

  useEffect(() => {
    let dead = false;
    let tex: THREE.Texture | null = null, depth: THREE.Texture | null = null;
    (async () => {
      try {
        // A plain <img>, flipped and premultiplied by WebGL's own unpack settings (identical in every browser).
        const img = new Image();
        img.decoding = "async";
        img.src = images.hero.src;
        await img.decode();
        if (dead) return;
        tex = new THREE.Texture(img);
        tex.flipY = true;
        tex.premultiplyAlpha = true;
        tex.colorSpace = THREE.NoColorSpace;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.anisotropy = 4;
        tex.needsUpdate = true;
        const dm = depthFromAlpha(img);
        depth = dm.tex;
        material.uniforms.uTex.value = tex;
        material.uniforms.uDepth.value = depth;
        (material.uniforms.uTexel.value as THREE.Vector2).set(1 / dm.W, 1 / dm.H);
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
    return () => { dead = true; tex?.dispose(); depth?.dispose(); };
  }, [gl, invalidate, material]);

  useEffect(() => {
    const el = document.querySelector(".hero");
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setFrameloop(e.isIntersecting ? "always" : "never"), { rootMargin: "80px" });
    io.observe(el);
    return () => io.disconnect();
  }, [setFrameloop]);

  useFrame((state, dt) => {
    dt = Math.min(dt, 0.05);
    fx.debug.heroFrames++;
    const hero = gl.domElement.getBoundingClientRect();
    const p = document.getElementById("heroPortrait")?.getBoundingClientRect();
    if (p && hero.width > 0) {
      box.set(((p.left + p.width / 2 - hero.left) / hero.width) * 2 - 1, 1 - ((p.top + p.height / 2 - hero.top) / hero.height) * 2, p.width / hero.width, p.height / hero.height);
    }
    const u = material.uniforms;
    const turn = fx.reduce ? 0 : fx.hero.turn;
    const k = 1 - Math.exp(-dt * 5);
    const tx = fx.reduce ? 0 : fx.hero.mx, ty = fx.reduce ? 0 : fx.hero.my;
    mouse.current.x += (tx - mouse.current.x) * k;
    mouse.current.y += (ty - mouse.current.y) * k;
    const ease = turn * turn * (3 - 2 * turn);
    u.uTurn.value = turn;
    u.uYaw.value = -0.62 * ease + mouse.current.x * 0.12 * (1 - ease);
    u.uPitch.value = 0.1 * ease - mouse.current.y * 0.06 * (1 - ease);
    u.uZoom.value = 1 + 0.05 * ease;
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
