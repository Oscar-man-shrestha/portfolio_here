"use client";

// Hero portrait in WebGL, covering the whole hero.
// - At rest (scatter 0): a plane that passes Oscar's photo through untouched (no sharpening, colour change or
//   distortion), with the scan-line reveal and short RGB-slice glitches of the reference video.
// - While scrolling (scatter 0 → 1): the plane hands over to GPU particles sampled from the same photo. They lift
//   into a luminance relief, turn in 3D and drift apart, then fade as the next section arrives.
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { images } from "@/lib/content";
import { fx } from "@/lib/fx";
import { useSite } from "@/lib/store";

// The CSS mask on the DOM portrait, reproduced in the shaders: transparent at the bottom edge, full at 32%.
const FADE = /* glsl */ `
float bottomFade(float y) { return y < 0.08 ? mix(0.0, 0.3, y / 0.08) : mix(0.3, 1.0, clamp((y - 0.08) / 0.24, 0.0, 1.0)); }
`;

const planeVert = /* glsl */ `
uniform vec4 uBox;
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(uBox.xy + position.xy * uBox.zw, 0.0, 1.0); }
`;

const planeFrag = /* glsl */ `
uniform sampler2D uTex;
uniform float uTime, uReveal, uGlitch, uHover, uOpacity;
uniform vec2 uMouse, uRes;
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
  float hb = (1.0 - smoothstep(0.0, 0.035, abs(uv.y - (uMouse.y * 0.5 + 0.5)))) * uHover;
  shift += hb * 0.012 * sin(t * 40.0 + uv.y * 300.0);
  float split = 0.012 * g + 0.018 * nearEdge + 0.006 * hb;
  vec2 p = uv + vec2(shift, 0.0) + uMouse * 0.004 * (1.0 - g);
  vec4 cR = texture2D(uTex, p + vec2(split, 0.0));
  vec4 cG = texture2D(uTex, p);
  vec4 cB = texture2D(uTex, p - vec2(split, 0.0));
  vec3 col = vec3(cR.r, cG.g, cB.b);
  float a = max(cG.a, max(cR.a, cB.a));
  col += (vec3(0.06, 0.05, -0.04) * (cR.a - cG.a) + vec3(0.04, -0.03, 0.07) * (cB.a - cG.a)) * (g + nearEdge);
  col *= 1.0 - (0.07 * (g + nearEdge)) * step(0.5, fract(uv.y * uRes.y * 0.25));
  float vis = step(d, 0.0);
  float lead = step(h2(floor(uv * vec2(54.0, 110.0)) + frame), 0.3) * step(0.0, d) * step(d, 0.06);
  vis = max(vis, lead);
  float line = (1.0 - smoothstep(0.0, 0.0035, abs(d))) * step(uReveal, 0.999) * step(0.02, uReveal);
  float f = bottomFade(uv.y) * uOpacity;
  gl_FragColor = (vec4(col, a) * vis + vec4(1.0, 0.18, 0.3, 1.0) * line * 0.95 * smoothstep(0.05, 0.6, cG.a)) * f;
}
`;

const pointsVert = /* glsl */ `
attribute vec2 aUv;
attribute float aRnd;
uniform sampler2D uTex;
uniform vec4 uBox;
uniform float uScatter, uTime, uAspect, uCell, uOpacity;
varying vec4 vCol;
${FADE}
void main() {
  vec4 c = texture2D(uTex, aUv);
  float s = uScatter;
  // staggered release: some particles leave earlier than others
  float e = smoothstep(0.0, 1.0, clamp(s * 1.5 - aRnd * 0.5, 0.0, 1.0));
  vec2 base = uBox.xy + (aUv * 2.0 - 1.0) * uBox.zw;
  // work in an aspect-correct space so the 3D turn is round, not stretched
  vec3 p = vec3((base.x - uBox.x) * uAspect, base.y, 0.0);
  float lum = dot(c.rgb, vec3(0.299, 0.587, 0.114));
  p.z = (lum - 0.25) * 0.35 * smoothstep(0.0, 0.25, s);
  float t = uTime * 0.6;
  vec3 drift = vec3(
    sin(aUv.y * 7.0 + t + aRnd * 6.283) * 0.6 + (aUv.x - 0.5) * 1.4,
    cos(aUv.x * 6.0 - t * 0.8 + aRnd * 3.1) * 0.35 + 0.9 + aRnd * 0.6,
    sin((aUv.x + aUv.y) * 5.0 + t) * 0.8 + aRnd * 1.6);
  p += drift * e * e;
  float ang = s * 1.1;
  float cs = cos(ang), sn = sin(ang);
  p = vec3(p.x * cs + p.z * sn, p.y, -p.x * sn + p.z * cs);
  float persp = 1.0 / max(0.25, 1.0 - p.z * 0.42);
  gl_Position = vec4((p.x / uAspect) * persp + uBox.x, p.y * persp, 0.0, 1.0);
  float alive = step(0.08, c.a) * bottomFade(aUv.y);
  gl_PointSize = alive > 0.0 ? uCell * persp * (1.15 + e * 0.9) : 0.0;
  vCol = c * alive * uOpacity * (1.0 - smoothstep(0.75, 1.0, e)) ;
}
`;

const pointsFrag = /* glsl */ `
varying vec4 vCol;
void main() {
  vec2 q = gl_PointCoord - 0.5;
  float r = dot(q, q);
  if (r > 0.25) discard;
  gl_FragColor = vCol * (1.0 - smoothstep(0.16, 0.25, r));
}
`;

function Portrait() {
  const { gl, size, invalidate, setFrameloop } = useThree();
  // Materials are built here and passed by reference: R3F copies a `uniforms` prop, so per-frame updates must go
  // to material.uniforms, the object the renderer actually reads.
  const box = useMemo(() => new THREE.Vector4(0, 0, 0.5, 0.5), []);
  const plane = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: planeVert,
        fragmentShader: planeFrag,
        uniforms: {
          uTex: { value: null }, uBox: { value: box }, uTime: { value: 0 }, uReveal: { value: 0 }, uGlitch: { value: 0 },
          uHover: { value: 0 }, uOpacity: { value: 1 }, uMouse: { value: new THREE.Vector2() }, uRes: { value: new THREE.Vector2(1, 1) },
        },
        transparent: true, premultipliedAlpha: true, depthTest: false, depthWrite: false,
      }),
    [box],
  );
  const narrow = typeof window !== "undefined" && window.innerWidth < 768;
  const [gw, gh] = narrow ? [150, 136] : [230, 209];
  const points = useMemo(() => {
    const n = gw * gh, uv = new Float32Array(n * 2), rnd = new Float32Array(n), pos = new Float32Array(n * 3);
    for (let j = 0, k = 0; j < gh; j++) for (let i = 0; i < gw; i++, k++) {
      uv[k * 2] = (i + 0.5) / gw; uv[k * 2 + 1] = (j + 0.5) / gh; rnd[k] = Math.random();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aUv", new THREE.BufferAttribute(uv, 2));
    g.setAttribute("aRnd", new THREE.BufferAttribute(rnd, 1));
    const m = new THREE.ShaderMaterial({
      vertexShader: pointsVert, fragmentShader: pointsFrag,
      uniforms: { uTex: { value: null }, uBox: { value: box }, uScatter: { value: 0 }, uTime: { value: 0 }, uAspect: { value: 1 }, uCell: { value: 2 }, uOpacity: { value: 0 } },
      transparent: true, premultipliedAlpha: true, depthTest: false, depthWrite: false,
    });
    return { g, m };
  }, [gw, gh, box]);
  useEffect(() => () => { plane.dispose(); points.g.dispose(); points.m.dispose(); }, [plane, points]);
  const mouse = useRef(new THREE.Vector2());

  useEffect(() => {
    let dead = false;
    let tex: THREE.Texture | null = null;
    (async () => {
      try {
        // A plain <img>, flipped and premultiplied by WebGL's own unpack settings: identical in every browser
        // (createImageBitmap's flip/premultiply options are not honoured the same way in every Safari).
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
        plane.uniforms.uTex.value = tex;
        points.m.uniforms.uTex.value = tex;
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
    return () => { dead = true; tex?.dispose(); };
  }, [gl, invalidate, plane, points]);

  // Render only while the hero is on screen.
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
    // where the portrait box sits inside the hero, in clip space
    const hero = gl.domElement.getBoundingClientRect();
    const p = document.getElementById("heroPortrait")?.getBoundingClientRect();
    if (p && hero.width > 0) {
      box.set(((p.left + p.width / 2 - hero.left) / hero.width) * 2 - 1, 1 - ((p.top + p.height / 2 - hero.top) / hero.height) * 2, p.width / hero.width, p.height / hero.height);
    }
    const s = fx.reduce ? 0 : fx.hero.scatter;
    const u = plane.uniforms;
    u.uTime.value += dt;
    u.uReveal.value = fx.hero.reveal;
    u.uGlitch.value = fx.reduce ? 0 : Math.min(1, fx.hero.glitch + fx.hero.scroll);
    fx.hero.scroll *= Math.exp(-dt * 5);
    const k = 1 - Math.exp(-dt * 6);
    mouse.current.x += (fx.hero.mx - mouse.current.x) * k;
    mouse.current.y += (fx.hero.my - mouse.current.y) * k;
    (u.uMouse.value as THREE.Vector2).copy(mouse.current);
    u.uHover.value += ((fx.reduce ? 0 : fx.hero.hover) - u.uHover.value) * k;
    (u.uRes.value as THREE.Vector2).set(size.width * state.viewport.dpr, size.height * state.viewport.dpr);
    u.uOpacity.value = 1 - THREE.MathUtils.smoothstep(s, 0.03, 0.12);
    const pu = points.m.uniforms;
    pu.uScatter.value = s;
    pu.uTime.value = u.uTime.value;
    pu.uAspect.value = size.width / Math.max(1, size.height);
    pu.uCell.value = (box.z * size.width * state.viewport.dpr) / gw;
    pu.uOpacity.value = THREE.MathUtils.smoothstep(s, 0.015, 0.1);
  });

  return (
    <>
      <mesh frustumCulled={false} renderOrder={1}>
        <planeGeometry args={[2, 2]} />
        <primitive object={plane} attach="material" />
      </mesh>
      <points frustumCulled={false} renderOrder={2} args={[points.g, points.m]} />
    </>
  );
}

export default function HeroGL() {
  return (
    <Canvas
      className="gl"
      dpr={[1, 2]}
      flat
      linear
      frameloop="always"
      gl={{ alpha: true, antialias: false, premultipliedAlpha: true, powerPreference: "high-performance" }}
      onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      aria-hidden="true"
    >
      <Portrait />
    </Canvas>
  );
}
