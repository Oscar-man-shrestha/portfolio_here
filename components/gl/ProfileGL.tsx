"use client";

// Operator turntable: Oscar turning on a studio turntable (a Google Flow clip made from his photos), cut out frame by
// frame (tools/headturn) and scrubbed by the pinned profile scroll. Each of the four views holds while its card is
// read, and the figure turns smoothly between them: front, three-quarter, side, back. Neighbouring frames crossfade;
// a faint scan line sweeps the figure while it turns. The holographic ring platform and the petals stay.
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { images } from "@/lib/content";
import { fx } from "@/lib/fx";
import Petals from "./Petals";

const SEQ = images.turn360;
const SRC = SEQ.frames;
const VIEW_FRAMES = [SEQ.marks.front, SEQ.marks.three, SEQ.marks.side, SEQ.marks.back];
const ASPECT = SEQ.w / SEQ.h;
const H = 2; // figure height in world units
const POOL = 8;

const vert = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const figFrag = /* glsl */ `
uniform sampler2D uA, uB;
uniform float uMix, uMove, uTime, uScan;
varying vec2 vUv;
void main() {
  vec4 c = mix(texture2D(uA, vUv), texture2D(uB, vUv), uMix);
  // a scan line sweeps the figure while it turns
  float line = (1.0 - smoothstep(0.0, 0.006, abs(vUv.y - uScan))) * uMove;
  c.rgb += vec3(1.0, 0.18, 0.3) * line * c.a * 1.4;
  // a touch of hologram tint while moving
  c.rgb = mix(c.rgb, c.rgb * vec3(0.8, 0.92, 1.0) + vec3(0.0, 0.02, 0.04) * c.a, uMove * 0.35);
  // the soles melt into the glowing ring platform (and no trace of the studio turntable shows)
  // (the frames reach ~4% below the soles, where the turntable sat: that strip is cleared, the soles fade in)
  c *= smoothstep(0.035, 0.075, vUv.y);
  gl_FragColor = c;
}
`;
const ringFrag = /* glsl */ `
uniform float uTime;
varying vec2 vUv;
void main() {
  vec2 p = vUv - 0.5;
  float r = length(p) * 2.0;
  float a = atan(p.y, p.x);
  float ticks = step(0.5, fract((a + uTime * 0.25) * 48.0 / 6.2831853));
  float ring1 = smoothstep(0.012, 0.0, abs(r - 0.92));
  float ring2 = smoothstep(0.03, 0.0, abs(r - 0.74)) * ticks;
  float ring3 = smoothstep(0.006, 0.0, abs(r - 0.56));
  float glow = smoothstep(0.9, 0.0, r) * 0.12;
  float v = ring1 * 0.9 + ring2 * 0.8 + ring3 * 0.5 + glow;
  gl_FragColor = vec4(vec3(1.0, 0.18, 0.3) * v, v);
}
`;

/** A plain <img> as a texture, flipped and premultiplied by WebGL's unpack settings; no mipmaps (frames change often). */
function frameTexture(img: HTMLImageElement) {
  const t = new THREE.Texture(img);
  t.flipY = true;
  t.premultiplyAlpha = true;
  t.colorSpace = THREE.NoColorSpace;
  t.generateMipmaps = false;
  t.minFilter = THREE.LinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

/** Clip frame for the scroll position p (0…3): each view holds, then turns to the next in the middle of its stretch. */
function frameForProgress(p: number, reduce: boolean) {
  const q = THREE.MathUtils.clamp(p, 0, 3);
  const k = Math.min(2, Math.floor(q));
  const local = q - k;
  let t = THREE.MathUtils.smoothstep(local, 0.3, 0.7);
  if (reduce) t = local < 0.5 ? 0 : 1;
  if (q >= 3) t = 1;
  return VIEW_FRAMES[k] + t * (VIEW_FRAMES[k + 1] - VIEW_FRAMES[k]);
}

type Slot = { tex: THREE.Texture; frame: number; stamp: number };

function Figure() {
  const { camera, size, setFrameloop, gl } = useThree();
  const fig = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: vert, fragmentShader: figFrag,
    uniforms: { uA: { value: null }, uB: { value: null }, uMix: { value: 0 }, uMove: { value: 0 }, uTime: { value: 0 }, uScan: { value: -1 } },
    transparent: true, premultipliedAlpha: true, depthWrite: false,
  }), []);
  const ring = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: vert, fragmentShader: ringFrag, uniforms: { uTime: { value: 0 } },
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  }), []);
  const mesh = useMemo(() => new THREE.Mesh(new THREE.PlaneGeometry(H * ASPECT, H), fig), [fig]);
  const S = useRef({ imgs: [] as (HTMLImageElement | null)[], pool: [] as Slot[], stamp: 0, f: 0, last: 0 });
  useEffect(() => () => { fig.dispose(); ring.dispose(); mesh.geometry.dispose(); S.current.pool.forEach((s) => s.tex.dispose()); }, [fig, ring, mesh]);

  // frames load in view order (front first), a few at a time; a frame that fails is retried, then skipped
  useEffect(() => {
    let dead = false;
    const stage = document.getElementById("opStage");
    const shown = (stage?.getBoundingClientRect().height ?? window.innerHeight) * Math.min(window.devicePixelRatio || 1, 2);
    const phone = window.matchMedia("(max-width: 1023px)").matches || shown <= SEQ.mh * 1.15;
    const dir = `${SEQ.dir}/${phone ? "m" : "d"}/`;
    const imgs: (HTMLImageElement | null)[] = new Array(SEQ.count).fill(null);
    S.current.imgs = imgs;
    const queue = Array.from({ length: SEQ.count }, (_, k) => k);
    let active = 0;
    const load = (k: number, attempt: number) => {
      const img = new Image();
      img.decoding = "async";
      img.src = `${dir}${String(k).padStart(2, "0")}.webp`;
      img.decode().then(
        () => {
          if (dead) return;
          imgs[k] = img;
          if (k === 0) stage?.classList.add("gl-on");
          active--;
          pump();
        },
        () => {
          if (dead) return;
          if (attempt < 3) { window.setTimeout(() => load(k, attempt + 1), 600 * attempt); return; }
          active--;
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
    return () => { dead = true; };
  }, []);

  useEffect(() => {
    const el = document.getElementById("opStage");
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setFrameloop(e.isIntersecting ? "always" : "never"), { rootMargin: "60px" });
    io.observe(el);
    return () => io.disconnect();
  }, [setFrameloop]);

  const texFor = (k: number): THREE.Texture | null => {
    const st = S.current;
    let slot = st.pool.find((s) => s.frame === k);
    if (!slot) {
      const img = st.imgs[k];
      if (!img) return null;
      if (st.pool.length < POOL) {
        slot = { tex: frameTexture(img), frame: k, stamp: 0 };
        st.pool.push(slot);
      } else {
        slot = st.pool.reduce((x, y) => (x.stamp <= y.stamp ? x : y));
        slot.tex.image = img;
        slot.tex.needsUpdate = true;
        slot.frame = k;
      }
    }
    slot.stamp = ++st.stamp;
    return slot.tex;
  };

  useFrame((state, dt) => {
    dt = Math.min(dt, 0.05);
    const cam = camera as THREE.PerspectiveCamera;
    // fit the figure to ~90% of the stage height (or its width on very narrow stages)
    const fitH = (H / 0.9) / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)));
    const fitW = ((H * ASPECT) / 0.82) / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * (size.width / size.height));
    cam.position.set(0, 0.02, Math.max(fitH, fitW));
    cam.lookAt(0, 0, 0);

    const st = S.current;
    const target = frameForProgress(fx.profile.p, fx.reduce);
    st.f += (target - st.f) * (1 - Math.exp(-dt * 10));
    if (Math.abs(target - st.f) < 0.01) st.f = target;
    // nearest loaded frames on each side of the playhead
    let i = 0;
    while (i < SRC.length - 2 && SRC[i + 1] <= st.f) i++;
    const has = (k: number) => !!st.imgs[k];
    let a = i;
    while (a > 0 && !has(a)) a--;
    let b = i + 1;
    while (b < SRC.length - 1 && !has(b)) b++;
    if (!has(b)) b = a;
    const mix = b > a ? THREE.MathUtils.clamp((st.f - SRC[a]) / (SRC[b] - SRC[a]), 0, 1) : 0;
    const ta = has(a) ? texFor(a) : null;
    const tb = mix > 0.002 && has(b) ? texFor(b) : null;
    mesh.visible = !!ta;
    if (ta) {
      fig.uniforms.uA.value = ta;
      fig.uniforms.uB.value = tb ?? ta;
      fig.uniforms.uMix.value = tb ? mix : 0;
    }
    // upload the next frame in the direction of travel ahead of time
    if (Math.abs(target - st.f) > 0.05) {
      const ahead = target > st.f ? b + 1 : a - 1;
      if (ahead >= 0 && ahead < SRC.length && has(ahead)) {
        const t = texFor(ahead);
        if (t) gl.initTexture(t);
      }
    }
    // the scan line and tint follow how fast the figure is turning
    const speed = Math.min(1, Math.abs(st.f - st.last) / Math.max(dt, 1e-3) / 60);
    st.last = st.f;
    const u = fig.uniforms;
    u.uMove.value += ((fx.reduce ? 0 : speed) - u.uMove.value) * (1 - Math.exp(-dt * 8));
    u.uScan.value = u.uMove.value > 0.02 ? 1 - ((state.clock.elapsedTime * 0.9) % 1) : -1;
    u.uTime.value += dt;
    ring.uniforms.uTime.value += dt * (fx.reduce ? 0 : 1);
  });

  return (
    <>
      <primitive object={mesh} />
      <mesh rotation-x={-Math.PI / 2} position={[0, -H / 2 + 0.02, 0]}>
        <planeGeometry args={[1.5, 1.5]} />
        <primitive object={ring} attach="material" />
      </mesh>
    </>
  );
}

export default function ProfileGL() {
  return (
    <Canvas
      camera={{ fov: 30, near: 0.1, far: 50, position: [0, 0, 5] }}
      dpr={[1, 2]}
      flat
      linear
      gl={{ alpha: true, antialias: true, premultipliedAlpha: true, powerPreference: "high-performance" }}
      onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      aria-hidden="true"
    >
      <Petals layer={0} count={70} scale={1.15} />
      <Figure />
      <Petals layer={1} count={45} scale={1.15} />
    </Canvas>
  );
}
