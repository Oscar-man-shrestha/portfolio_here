"use client";

// Sakura petals for any R3F canvas: one instanced quad per petal, all motion computed in the vertex shader
// (no per-frame CPU work). Two layers share one geometry: layer 0 draws behind the subject, layer 1 in front.
// Scroll velocity becomes wind (fx.wind.v). Hidden entirely under reduced motion.
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { fx } from "@/lib/fx";

const vert = /* glsl */ `
attribute vec4 aSeed;
attribute float aLayer;
uniform float uTime, uWind, uAspect, uLayer, uScale;
varying vec2 vUv;
varying float vShade, vAlpha;
void main() {
  vUv = uv;
  if (abs(aLayer - uLayer) > 0.5) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  float front = uLayer;
  float speed = mix(0.045, 0.1, aSeed.x) * mix(0.75, 1.35, front);
  float t = uTime * speed + aSeed.y * 9.0;
  float y = 1.25 - mod(t, 2.5);
  float x = (aSeed.z * 2.0 - 1.0) * 1.15 + sin(t * 2.1 + aSeed.w * 6.283) * 0.07 + uWind * (1.25 - y) * 0.35 + uTime * 0.008;
  x = mod(x + 1.25, 2.5) - 1.25;
  float size = mix(0.011, 0.024, aSeed.w) * mix(0.85, 1.7, front) * uScale;
  float spin = uTime * mix(0.8, 2.6, aSeed.x) + aSeed.y * 6.283;
  vec2 q = position.xy;
  q.x *= 0.25 + 0.75 * abs(cos(spin));
  float r = spin * 0.45 + aSeed.z * 6.283;
  q = mat2(cos(r), -sin(r), sin(r), cos(r)) * q;
  vShade = 0.72 + 0.28 * abs(cos(spin));
  vAlpha = mix(0.55, 0.95, front);
  gl_Position = vec4(vec2(x, y) + vec2(q.x / uAspect, q.y) * size * 2.0, 0.0, 1.0);
}
`;
const frag = /* glsl */ `
varying vec2 vUv;
varying float vShade, vAlpha;
void main() {
  vec2 p = vUv - 0.5;
  float body = 1.0 - smoothstep(0.40, 0.46, length(p * vec2(1.55, 1.0)));
  float notch = smoothstep(0.10, 0.14, length(p - vec2(0.0, 0.47)));
  float a = body * notch;
  if (a < 0.01) discard;
  vec3 base = vec3(1.0, 0.36, 0.55);
  vec3 tip = vec3(1.0, 0.84, 0.9);
  vec3 col = mix(base, tip, smoothstep(-0.45, 0.35, p.y)) * vShade;
  float edge = 1.0 - smoothstep(0.30, 0.44, length(p * vec2(1.55, 1.0)));
  col += vec3(1.0, 0.2, 0.45) * (1.0 - edge) * 0.35; // neon rim
  float al = a * vAlpha;
  gl_FragColor = vec4(col * al, al);
}
`;

export default function Petals({ count = 110, layer, scale = 1 }: { count?: number; layer: 0 | 1; scale?: number }) {
  const { size } = useThree();
  const geo = useMemo(() => {
    const base = new THREE.PlaneGeometry(1, 1);
    const g = new THREE.InstancedBufferGeometry();
    g.index = base.index;
    g.setAttribute("position", base.getAttribute("position"));
    g.setAttribute("uv", base.getAttribute("uv"));
    const seed = new Float32Array(count * 4), lay = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      seed.set([Math.random(), Math.random(), Math.random(), Math.random()], i * 4);
      lay[i] = i % 3 === 0 ? 1 : 0; // a third of the petals fly in front
    }
    g.setAttribute("aSeed", new THREE.InstancedBufferAttribute(seed, 4));
    g.setAttribute("aLayer", new THREE.InstancedBufferAttribute(lay, 1));
    g.instanceCount = count;
    return g;
  }, [count]);
  const mat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: vert, fragmentShader: frag,
    uniforms: { uTime: { value: Math.random() * 100 }, uWind: { value: 0 }, uAspect: { value: 1 }, uLayer: { value: layer }, uScale: { value: scale } },
    transparent: true, premultipliedAlpha: true, depthTest: false, depthWrite: false,
  }), [layer, scale]);
  useEffect(() => () => { geo.dispose(); mat.dispose(); }, [geo, mat]);
  const mesh = useMemo(() => {
    const m = new THREE.Mesh(geo, mat);
    m.frustumCulled = false;
    m.renderOrder = layer ? 5 : 0;
    return m;
  }, [geo, mat, layer]);

  useFrame((_, dt) => {
    dt = Math.min(dt, 0.05);
    mesh.visible = !fx.reduce;
    const u = mat.uniforms;
    u.uTime.value += dt * (1 + Math.abs(fx.wind.v) * 1.5);
    u.uWind.value += (fx.wind.v - u.uWind.value) * Math.min(1, dt * 3);
    u.uAspect.value = size.width / Math.max(1, size.height);
  });
  return <primitive object={mesh} />;
}
