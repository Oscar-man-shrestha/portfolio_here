"use client";

import dynamic from "next/dynamic";
import { useSite } from "@/lib/store";

// three.js and the portrait shader load only once the intro film is playing, so they never compete with its
// first frames (the previous audit measured 300–500 ms long tasks when they did).
const HeroGL = dynamic(() => import("./HeroGL"), { ssr: false });

export default function HeroGLMount() {
  const go = useSite((s) => s.filmStarted);
  return go ? <HeroGL /> : null;
}
