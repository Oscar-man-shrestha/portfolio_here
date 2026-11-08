// Plain mutable values shared between the GSAP choreography (DOM side) and the WebGL frame loops.
// GSAP tweens these numbers; the render loops read them every frame. No React state, no re-renders.
export const fx = {
  hero: { reveal: 0, glitch: 0, hover: 0, mx: 0, my: 0, scroll: 0, scatter: 0 },
  /** Operator profile turntable: 0 → 3 across the pinned section (one unit per view change). */
  profile: { p: 0 },
  city: { grow: 0, visible: false },
  reduce: false,
  debug: { heroFrames: 0, heroTex: "", cityFrames: 0 },
};

if (typeof window !== "undefined") (window as unknown as { __fx: typeof fx }).__fx = fx;

type Listener = () => void;
const listeners = new Map<string, Set<Listener>>();
export function on(evt: string, fn: Listener) {
  if (!listeners.has(evt)) listeners.set(evt, new Set());
  listeners.get(evt)!.add(fn);
  return () => listeners.get(evt)!.delete(fn);
}
export function emit(evt: string) {
  listeners.get(evt)?.forEach((fn) => fn());
}
