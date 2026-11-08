"use client";

// Operator turntable: Oscar's four real turnaround views on one card that turns with scroll.
// Between two views the card swings edge-on (with a short scan glitch) and comes back showing the next view,
// so the figure appears to turn on a holographic platform. Views are never mirrored or generated.
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { images } from "@/lib/content";
import { fx } from "@/lib/fx";

const ASPECT = images.turnW / images.turnH;
const H = 2; // card height in world units

const cardVert = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const cardFrag = /* glsl */ `
uniform sampler2D uTex;
uniform float uEdge, uTime, uScan;
varying vec2 vUv;
float h1(float n) { return fract(sin(n * 12.9898) * 43758.5453); }
void main() {
  vec2 uv = vUv;
  float band = floor(uv.y * 60.0) + floor(uTime * 16.0) * 3.0;
  uv.x += (h1(band) - 0.5) * 0.08 * uEdge * step(0.55, h1(band + 7.0));
  float split = 0.012 * uEdge;
  vec4 r = texture2D(uTex, uv + vec2(split, 0.0)), g = texture2D(uTex, uv), b = texture2D(uTex, uv - vec2(split, 0.0));
  vec4 c = vec4(r.r, g.g, b.b, max(g.a, max(r.a, b.a)));
  // a scan line sweeps the figure while it turns
  float line = (1.0 - smoothstep(0.0, 0.006, abs(uv.y - uScan))) * step(0.02, uEdge + 0.02);
  c.rgb += vec3(1.0, 0.18, 0.3) * line * c.a * 1.4;
  // holographic tint while edge-on
  c.rgb = mix(c.rgb, c.rgb * vec3(0.75, 0.9, 1.0) + vec3(0.0, 0.03, 0.05) * c.a, uEdge * 0.6);
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
  float ring1 = smoothstep(0.012, 0.0, abs(r - 0.92)) ;
  float ring2 = smoothstep(0.03, 0.0, abs(r - 0.74)) * ticks;
  float ring3 = smoothstep(0.006, 0.0, abs(r - 0.56));
  float glow = smoothstep(0.9, 0.0, r) * 0.12;
  float v = ring1 * 0.9 + ring2 * 0.8 + ring3 * 0.5 + glow;
  gl_FragColor = vec4(vec3(1.0, 0.18, 0.3) * v, v);
}
`;

function Turntable() {
  const { camera, size, setFrameloop } = useThree();
  const card = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: cardVert, fragmentShader: cardFrag,
    uniforms: { uTex: { value: null }, uEdge: { value: 0 }, uTime: { value: 0 }, uScan: { value: -1 } },
    transparent: true, premultipliedAlpha: true, depthWrite: false, side: THREE.DoubleSide,
  }), []);
  const ring = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: cardVert, fragmentShader: ringFrag, uniforms: { uTime: { value: 0 } },
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  }), []);
  const texes = useMemo<(THREE.Texture | null)[]>(() => [null, null, null, null], []);
  const mesh = useMemo(() => new THREE.Mesh(new THREE.PlaneGeometry(H * ASPECT, H), card), [card]);
  useEffect(() => () => { card.dispose(); ring.dispose(); mesh.geometry.dispose(); texes.forEach((t) => t?.dispose()); }, [card, ring, mesh, texes]);

  useEffect(() => {
    let dead = false;
    images.turnaround.forEach((v, i) => {
      const img = new Image();
      img.decoding = "async";
      img.src = v.src;
      img.decode().then(() => {
        if (dead) return;
        const t = new THREE.Texture(img);
        t.flipY = true; t.premultiplyAlpha = true; t.colorSpace = THREE.NoColorSpace;
        t.minFilter = THREE.LinearMipmapLinearFilter; t.anisotropy = 4; t.needsUpdate = true;
        texes[i] = t;
        if (texes.every(Boolean)) document.getElementById("opStage")?.classList.add("gl-on");
      }).catch(() => {});
    });
    return () => { dead = true; };
  }, [texes]);

  useEffect(() => {
    const el = document.getElementById("opStage");
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setFrameloop(e.isIntersecting ? "always" : "never"), { rootMargin: "60px" });
    io.observe(el);
    return () => io.disconnect();
  }, [setFrameloop]);

  useFrame((state, dt) => {
    dt = Math.min(dt, 0.05);
    const cam = camera as THREE.PerspectiveCamera;
    // fit the card to ~88% of the stage height (or its width on very narrow stages)
    const fitH = (H / 0.88) / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)));
    const fitW = ((H * ASPECT) / 0.8) / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * (size.width / size.height));
    cam.position.set(0, 0.02, Math.max(fitH, fitW));
    cam.lookAt(0, 0, 0);

    const p = THREE.MathUtils.clamp(fx.profile.p, 0, 3);
    const k = Math.min(2, Math.floor(p));
    const local = p - k;
    // each segment holds its view, then turns in the middle third
    let t = THREE.MathUtils.smoothstep(local, 0.35, 0.65);
    if (fx.reduce) t = local < 0.5 ? 0 : 1;
    if (p >= 3) t = 1;
    const angle = t * Math.PI; // 0 → π: first half shows view k, second half view k+1
    const showNext = angle > Math.PI / 2;
    const tex = texes[showNext ? k + 1 : k] ?? texes[k] ?? null;
    card.uniforms.uTex.value = tex;
    mesh.rotation.y = showNext ? angle - Math.PI : angle;
    const edge = 1 - Math.abs(Math.cos(angle));
    card.uniforms.uEdge.value = fx.reduce ? 0 : edge;
    card.uniforms.uScan.value = t > 0 && t < 1 ? 1 - t : -1;
    card.uniforms.uTime.value += dt;
    ring.uniforms.uTime.value += dt * (fx.reduce ? 0 : 1);
    mesh.visible = !!tex;
    state.scene.rotation.x = 0;
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
      <Turntable />
    </Canvas>
  );
}
