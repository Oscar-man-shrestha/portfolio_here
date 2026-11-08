"use client";

// The demo's 3D feature space: each toy trace is a point at (JS, ΔH, ‖Δπ‖₁) measured against the chosen family
// reference, which sits at the origin. Drag to rotate.
import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Fam } from "@/lib/markov";

export interface Pt { f: [number, number, number]; fam: Fam; current: boolean }
const SCALE: [number, number, number] = [1 / 0.3, 1 / 0.5, 1 / 0.8];
const RED = new THREE.Color("#ff2e4c"), PAPER = new THREE.Color("#ecece6");

function Scene({ pts, drag }: { pts: Pt[]; drag: React.RefObject<{ x: number; y: number }> }) {
  const group = useRef<THREE.Group>(null);
  const pulse = useRef<THREE.Mesh>(null);
  const axes = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const v: number[] = [];
    // three axes and a light 1×1×1 box
    v.push(0, 0, 0, 1.2, 0, 0, 0, 0, 0, 0, 1.2, 0, 0, 0, 0, 0, 0, 1.2);
    const c = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]];
    const e = [[1, 2], [2, 3], [4, 5], [5, 6], [6, 7], [7, 4], [1, 5], [2, 6], [3, 7]];
    e.forEach(([a, b]) => v.push(...c[a], ...c[b]));
    g.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
    return g;
  }, []);
  const axisMat = useMemo(() => new THREE.LineBasicMaterial({ color: "#8c9180", transparent: true, opacity: 0.55 }), []);
  useEffect(() => () => { axes.dispose(); axisMat.dispose(); }, [axes, axisMat]);
  const cur = pts.find((p) => p.current);

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    const d = drag.current!;
    g.rotation.y += (d.x - g.rotation.y) * Math.min(1, dt * 6);
    g.rotation.x += (d.y - g.rotation.x) * Math.min(1, dt * 6);
    if (pulse.current) {
      const s = 1 + (Math.sin(performance.now() / 260) + 1) * 0.35;
      pulse.current.scale.setScalar(s);
    }
  });

  const pos = (f: [number, number, number]) => [Math.min(1.25, f[0] * SCALE[0]), Math.min(1.25, f[1] * SCALE[1]), Math.min(1.25, f[2] * SCALE[2])] as [number, number, number];
  return (
    <group ref={group} position={[-0.5, -0.45, -0.5]}>
      <lineSegments geometry={axes} material={axisMat} />
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.07, 0.07, 0.07]} />
        <meshBasicMaterial color="#ff2e4c" />
      </mesh>
      {pts.map((p, k) => (
        <mesh key={k} position={pos(p.f)}>
          <sphereGeometry args={[p.current ? 0.045 : 0.025, 12, 12]} />
          <meshBasicMaterial color={p.fam === "A" ? RED : PAPER} transparent opacity={p.current ? 1 : 0.75} />
        </mesh>
      ))}
      {cur && (
        <mesh ref={pulse} position={pos(cur.f)}>
          <ringGeometry args={[0.06, 0.07, 32]} />
          <meshBasicMaterial color="#ecece6" side={THREE.DoubleSide} transparent opacity={0.8} />
        </mesh>
      )}
    </group>
  );
}

export default function MarkovSpace({ pts }: { pts: Pt[] }) {
  const drag = useRef({ x: -0.6, y: 0.35 });
  const state = useRef({ on: false, x: 0, y: 0 });
  return (
    <div
      className="ms"
      onPointerDown={(e) => { state.current = { on: true, x: e.clientX, y: e.clientY }; (e.target as HTMLElement).setPointerCapture?.(e.pointerId); }}
      onPointerMove={(e) => {
        const s = state.current;
        if (!s.on) return;
        drag.current.x += (e.clientX - s.x) * 0.008;
        drag.current.y = Math.max(-0.9, Math.min(0.9, drag.current.y + (e.clientY - s.y) * 0.006));
        s.x = e.clientX; s.y = e.clientY;
      }}
      onPointerUp={() => { state.current.on = false; }}
      onPointerCancel={() => { state.current.on = false; }}
    >
      <Canvas camera={{ position: [1.7, 1.2, 2.2], fov: 40 }} dpr={[1, 2]} flat gl={{ antialias: true, alpha: true }} onCreated={({ gl, camera }) => { gl.setClearColor(0x000000, 0); camera.lookAt(0, 0, 0); }}>
        <Scene pts={pts} drag={drag} />
      </Canvas>
      <div className="ms__legend hud" aria-hidden="true">
        <span>x · JS</span><span>y · ΔH</span><span>z · ‖Δπ‖₁</span><span className="ms__drag">drag to rotate</span>
      </div>
    </div>
  );
}
