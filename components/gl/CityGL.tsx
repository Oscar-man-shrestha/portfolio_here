"use client";

// Contribution City, redrawn for the new art direction: one tower per day of real GitHub data, laid out like
// the contribution calendar (weeks × weekdays). Ink bodies, hairline edges, signal red for days with 15+.
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { fmtDay, type Day } from "@/lib/contrib";
import { fx } from "@/lib/fx";
import { useSite } from "@/lib/store";

const lvl = (c: number) => (c === 0 ? 0 : c <= 2 ? 1 : c <= 6 ? 2 : c <= 14 ? 3 : 4);
const towerH = (c: number) => (c === 0 ? 0.07 : 0.34 + Math.sqrt(c) * 0.62);

const vert = /* glsl */ `
attribute float aIdx;
attribute float aLevel;
uniform float uGrow, uHover, uUpto, uSel;
varying vec2 vUv;
varying vec3 vN;
varying float vLevel, vHover, vRise;
void main() {
  vUv = uv; vN = normal; vLevel = aLevel;
  float delay = (aIdx / 366.0) * 0.55;
  float g = clamp((uGrow - delay) / 0.45, 0.0, 1.0);
  g = 1.0 - pow(1.0 - g, 3.0);
  // time-travel: days after uUpto haven't happened yet (the edge day rises with the fraction)
  float shown = clamp(uUpto - aIdx + 1.0, 0.0, 1.0);
  vec3 p = position;
  p.y *= max(g * shown, 0.015);
  vRise = position.y;
  vHover = max(1.0 - step(0.5, abs(aIdx - uHover)), 1.0 - step(0.5, abs(aIdx - uSel)));
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(p, 1.0);
}
`;

const frag = /* glsl */ `
uniform vec3 uInk, uTop, uPaper, uRed;
varying vec2 vUv;
varying vec3 vN;
varying float vLevel, vHover, vRise;
void main() {
  vec2 e = min(vUv, 1.0 - vUv);
  vec2 fw = max(fwidth(vUv), vec2(1e-4));
  float edge = 1.0 - smoothstep(0.55, 1.55, min(e.x / fw.x, e.y / fw.y));
  float isTop = step(0.5, vN.y);
  float shade = isTop > 0.5 ? 1.0 : (0.55 + 0.25 * abs(vN.z) + 0.1 * vRise);
  vec3 body = mix(uInk, uTop, isTop) * shade;
  float hot = step(3.5, vLevel);
  body = mix(body, uRed * (0.45 + 0.55 * isTop), hot * (0.35 + 0.65 * isTop));
  float ea = mix(0.14, 0.9, clamp(vLevel / 3.0, 0.0, 1.0));
  vec3 ec = mix(uPaper, uRed, hot);
  vec3 col = mix(body, ec, edge * ea);
  col = mix(col, mix(uPaper, uRed, hot), vHover * (0.75 + 0.25 * edge));
  gl_FragColor = vec4(col, 1.0);
}
`;

const groundFrag = /* glsl */ `
uniform vec3 uLine;
uniform vec2 uSize;
varying vec2 vUv;
void main() {
  vec2 p = (vUv - 0.5) * uSize;
  vec2 g = abs(fract(p + 0.5) - 0.5) / max(fwidth(p), vec2(1e-4));
  float line = 1.0 - smoothstep(0.0, 1.2, min(g.x, g.y));
  vec2 q = abs(vUv - 0.5) * 2.0;
  float fade = (1.0 - smoothstep(0.55, 1.0, q.x)) * (1.0 - smoothstep(0.2, 1.0, q.y));
  gl_FragColor = vec4(uLine * line * fade * 0.5, line * fade * 0.5);
}
`;

function City({ days }: { days: Day[] }) {
  const WEEKS = Math.ceil(days.length / 7);
  const { size, camera, setFrameloop, gl } = useThree();
  const mesh = useRef<THREE.InstancedMesh>(null);
  const az = useRef({ base: 0.42, drag: 0, t: 0, dragging: false, lastX: 0 });
  const grow = useRef(fx.reduce ? 1 : 0);
  const visible = useRef(false);

  const geo = useMemo(() => {
    const g = new THREE.BoxGeometry(1, 1, 1);
    g.translate(0, 0.5, 0);
    const idx = new Float32Array(days.length), level = new Float32Array(days.length);
    days.forEach((d, i) => { idx[i] = i; level[i] = lvl(d.count); });
    g.setAttribute("aIdx", new THREE.InstancedBufferAttribute(idx, 1));
    g.setAttribute("aLevel", new THREE.InstancedBufferAttribute(level, 1));
    return g;
  }, []);

  // Materials are built here and passed by reference: R3F copies a `uniforms` prop, so per-frame updates must
  // go to material.uniforms.
  const material = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: vert,
    fragmentShader: frag,
    uniforms: {
      uGrow: { value: grow.current },
      uHover: { value: -10 },
      uUpto: { value: 1e6 },
      uSel: { value: -10 },
      uInk: { value: new THREE.Color("#121315") },
      uTop: { value: new THREE.Color("#2a2c2f") },
      uPaper: { value: new THREE.Color("#ecece6") },
      uRed: { value: new THREE.Color("#ff2e4c") },
    },
  }), []);
  const uniforms = material.uniforms;

  const groundMat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: groundFrag,
    uniforms: { uLine: { value: new THREE.Color("#8c9180") }, uSize: { value: new THREE.Vector2(WEEKS + 8, 15) } },
    transparent: true,
    depthWrite: false,
  }), []);
  useEffect(() => () => { material.dispose(); groundMat.dispose(); geo.dispose(); }, [material, groundMat, geo]);

  useLayoutEffect(() => {
    const m = mesh.current!;
    const o = new THREE.Object3D();
    days.forEach((d, i) => {
      const week = Math.floor(i / 7), wd = i % 7;
      o.position.set(week - (WEEKS - 1) / 2, 0, wd - 3);
      o.scale.set(0.78, towerH(d.count), 0.78);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
  }, []);

  // Ready: hide the 2D fallback, render only while the map is on screen.
  useEffect(() => {
    const map = document.getElementById("cityMap");
    map?.classList.add("gl-on");
    useSite.getState().set({ cityGL: "ready" });
    if (!map) return;
    const io = new IntersectionObserver(([e]) => {
      visible.current = e.isIntersecting;
      setFrameloop(e.isIntersecting ? "always" : "never");
    }, { rootMargin: "60px" });
    io.observe(map);
    return () => io.disconnect();
  }, [setFrameloop]);

  // Drag to orbit (horizontal only; vertical drags keep scrolling the page).
  useEffect(() => {
    const el = gl.domElement;
    const a = az.current;
    const down = (e: PointerEvent) => { a.dragging = true; a.lastX = e.clientX; };
    const move = (e: PointerEvent) => {
      if (!a.dragging) return;
      a.drag = THREE.MathUtils.clamp(a.drag + (e.clientX - a.lastX) * 0.006, -1.1, 1.1);
      a.lastX = e.clientX;
    };
    const up = () => { a.dragging = false; };
    el.addEventListener("pointerdown", down);
    addEventListener("pointermove", move, { passive: true });
    addEventListener("pointerup", up);
    addEventListener("pointercancel", up);
    return () => {
      el.removeEventListener("pointerdown", down);
      removeEventListener("pointermove", move);
      removeEventListener("pointerup", up);
      removeEventListener("pointercancel", up);
    };
  }, [gl]);

  useFrame((_, dt) => {
    const a = az.current;
    dt = Math.min(dt, 0.05);
    if (visible.current && grow.current < 1) grow.current = fx.reduce ? 1 : Math.min(1, grow.current + dt / 2.4);
    uniforms.uGrow.value = grow.current;
    if (!fx.reduce) a.t += dt;
    if (!a.dragging) a.drag *= 1 - Math.min(1, dt * 0.35);
    // narrow panels look at the strip more diagonally so it fills the frame
    const base = size.width / size.height < 1.15 ? 0.98 : a.base;
    const ang = base + Math.sin(a.t * 0.16) * 0.22 + a.drag;
    fx.debug.cityFrames++;
    const R = 80, el = 0.62;
    camera.position.set(Math.sin(ang) * R * Math.cos(el), R * Math.sin(el), Math.cos(ang) * R * Math.cos(el));
    camera.lookAt(0, 1.2, 0);
    const cam = camera as THREE.OrthographicCamera;
    const span = WEEKS * Math.abs(Math.cos(ang)) + 7 * Math.abs(Math.sin(ang)) + 4;
    const z = Math.min(size.width / span, size.height / 14);
    if (Math.abs(cam.zoom - z) > 0.01) { cam.zoom = z; cam.updateProjectionMatrix(); }
  });

  // the timeline under the map (components/CityTime) scrubs the year and selects a day
  useEffect(() => {
    const onUpto = (e: Event) => { const u = (e as CustomEvent<{ upto: number | null }>).detail.upto; uniforms.uUpto.value = u ?? 1e6; };
    const onSel = (e: Event) => { const i = (e as CustomEvent<{ index: number | null }>).detail.index; uniforms.uSel.value = i ?? -10; };
    addEventListener("oms:city-upto", onUpto);
    addEventListener("oms:city-sel", onSel);
    return () => { removeEventListener("oms:city-upto", onUpto); removeEventListener("oms:city-sel", onSel); };
  }, [uniforms]);
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.instanceId === undefined || e.delta > 6) return; // a drag to orbit isn't a click
    e.stopPropagation();
    dispatchEvent(new CustomEvent("oms:city-day", { detail: { index: e.instanceId } }));
  };

  const tip = useRef<HTMLElement | null>(null);
  const onMove = (e: ThreeEvent<PointerEvent>) => {
    if (az.current.dragging || e.instanceId === undefined) return;
    e.stopPropagation();
    const d = days[e.instanceId];
    uniforms.uHover.value = e.instanceId;
    tip.current ??= document.getElementById("cityTip");
    const t = tip.current;
    if (!t) return;
    t.innerHTML = `<b>${d.count}</b> contribution${d.count === 1 ? "" : "s"} · ${fmtDay(d.date)} · tap for commits`;
    const r = gl.domElement.getBoundingClientRect();
    t.style.left = `${e.nativeEvent.clientX - r.left}px`;
    t.style.top = `${e.nativeEvent.clientY - r.top}px`;
    t.classList.add("is-on");
  };
  const onOut = () => {
    uniforms.uHover.value = -10;
    tip.current?.classList.remove("is-on");
  };

  return (
    <>
      <mesh rotation-x={-Math.PI / 2} position-y={-0.01}>
        <planeGeometry args={[WEEKS + 8, 15]} />
        <primitive object={groundMat} attach="material" />
      </mesh>
      <instancedMesh ref={mesh} args={[geo, material, days.length]} onPointerMove={onMove} onPointerOut={onOut} onClick={onClick} />
    </>
  );
}

export default function CityGL({ days }: { days: Day[] }) {
  return (
    <Canvas
      orthographic
      camera={{ position: [30, 50, 60], zoom: 12, near: 0.1, far: 400 }}
      dpr={[1, 2]}
      flat
      linear
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
      style={{ position: "absolute", inset: 0 }}
      aria-hidden="true"
    >
      <City days={days} />
    </Canvas>
  );
}
