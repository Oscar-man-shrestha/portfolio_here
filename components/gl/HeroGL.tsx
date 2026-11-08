"use client";

// Hero portrait in WebGL: a scan-line reveal and short RGB-slice glitches (the transition language of the
// reference video). At rest — reveal 1, glitch 0 — the shader passes Oscar's photo through untouched: no
// sharpening, no colour change, no distortion of the face.
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { images } from "@/lib/content";
import { fx } from "@/lib/fx";
import { useSite } from "@/lib/store";

const vert = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const frag = /* glsl */ `
uniform sampler2D uTex;
uniform float uTime, uReveal, uGlitch, uHover;
uniform vec2 uMouse, uRes;
varying vec2 vUv;

float h1(float n) { return fract(sin(n * 12.9898) * 43758.5453); }
float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

void main() {
  vec2 uv = vUv;
  float t = uTime;
  float g = uGlitch;

  // reveal: a scan line climbs from the bottom; blocks of pixels run just ahead of it
  float edge = uReveal * 1.16 - 0.08;
  float d = uv.y - edge;
  float nearEdge = (1.0 - smoothstep(0.0, 0.07, abs(d))) * step(uReveal, 0.999);

  // horizontal slices (fine bands + coarse blocks), re-rolled ~14 times a second
  float frame = floor(t * 14.0);
  float band = floor(uv.y * 42.0) + frame * 5.0;
  float shift = (h1(band + 3.1) - 0.5) * 0.11 * step(1.0 - g * 0.6, h1(band));
  float block = floor(uv.y * 6.0) + floor(t * 9.0) * 7.0;
  shift += (h1(block + 1.7) - 0.5) * 0.26 * step(1.0 - g * 0.32, h1(block * 1.31));
  shift *= g;
  shift += (h1(floor(uv.y * 90.0) + frame) - 0.5) * 0.035 * nearEdge;

  // hover: one thin band follows the pointer
  float hb = (1.0 - smoothstep(0.0, 0.035, abs(uv.y - (uMouse.y * 0.5 + 0.5)))) * uHover;
  shift += hb * 0.012 * sin(t * 40.0 + uv.y * 300.0);

  float split = 0.012 * g + 0.018 * nearEdge + 0.006 * hb;
  vec2 p = uv + vec2(shift, 0.0) + uMouse * 0.004 * (1.0 - g);

  // ImageBitmap uploaded premultiplied, so channels can be split without dark fringes
  vec4 cR = texture2D(uTex, p + vec2(split, 0.0));
  vec4 cG = texture2D(uTex, p);
  vec4 cB = texture2D(uTex, p - vec2(split, 0.0));
  vec3 col = vec3(cR.r, cG.g, cB.b);
  float a = max(cG.a, max(cR.a, cB.a));

  // glitch colour cast (the reference's acid yellow / violet), only while glitching
  col += (vec3(0.06, 0.05, -0.04) * (cR.a - cG.a) + vec3(0.04, -0.03, 0.07) * (cB.a - cG.a)) * (g + nearEdge);
  col *= 1.0 - (0.07 * (g + nearEdge)) * step(0.5, fract(uv.y * uRes.y * 0.25));

  float vis = step(d, 0.0);
  float lead = step(h2(floor(uv * vec2(54.0, 110.0)) + frame), 0.3) * step(0.0, d) * step(d, 0.06);
  vis = max(vis, lead);
  float line = (1.0 - smoothstep(0.0, 0.0035, abs(d))) * step(uReveal, 0.999) * step(0.02, uReveal);
  vec3 red = vec3(1.0, 0.18, 0.3);

  gl_FragColor = vec4(col, a) * vis + vec4(red, 1.0) * line * 0.95 * smoothstep(0.05, 0.6, cG.a);
}
`;

function Portrait() {
  const { gl, size, invalidate, setFrameloop } = useThree();
  // The material is created here and handed to the mesh as-is: R3F copies a `uniforms` prop, so updates
  // must go to material.uniforms, the object the renderer actually reads.
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vert,
        fragmentShader: frag,
        uniforms: {
          uTex: { value: null },
          uTime: { value: 0 },
          uReveal: { value: 0 },
          uGlitch: { value: 0 },
          uHover: { value: 0 },
          uMouse: { value: new THREE.Vector2() },
          uRes: { value: new THREE.Vector2(1, 1) },
        },
        transparent: true,
        premultipliedAlpha: true,
        depthTest: false,
        depthWrite: false,
      }),
    [],
  );
  useEffect(() => () => material.dispose(), [material]);
  const mouse = useRef(new THREE.Vector2());

  useEffect(() => {
    let dead = false;
    let tex: THREE.Texture | null = null;
    (async () => {
      try {
        // A plain <img> decoded asynchronously, then flipped and premultiplied by WebGL's own unpack settings.
        // (createImageBitmap's flip/premultiply options are not honoured the same way in every Safari version,
        // which could turn the portrait upside down; the unpack path behaves identically in all browsers.)
        const img = new Image();
        img.decoding = "async";
        img.src = images.hero.src;
        await img.decode();
        if (dead) return;
        tex = new THREE.Texture(img);
        tex.flipY = true;
        tex.premultiplyAlpha = true; // so channels can be split without dark fringes
        tex.colorSpace = THREE.NoColorSpace; // pass the photo's sRGB values straight through
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.anisotropy = 4;
        tex.needsUpdate = true;
        material.uniforms.uTex.value = tex;
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
  }, [gl, invalidate, material]);

  // Render only while the hero is on screen.
  useEffect(() => {
    const el = document.getElementById("heroPortrait");
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setFrameloop(e.isIntersecting ? "always" : "never"), { rootMargin: "80px" });
    io.observe(el);
    return () => io.disconnect();
  }, [setFrameloop]);

  useFrame((state, dt) => {
    const u = material.uniforms;
    fx.debug.heroFrames++;
    dt = Math.min(dt, 0.05);
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
  });

  return (
    <mesh frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
      <primitive object={material} attach="material" />
    </mesh>
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
