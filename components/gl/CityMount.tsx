"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { Day } from "@/lib/contrib";
import { useSite } from "@/lib/store";

const CityGL = dynamic(() => import("./CityGL"), { ssr: false });

// The city's WebGL context is created only when the map is about one screen away, and never during the intro.
export default function CityMount({ days }: { days: Day[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const phase = useSite((s) => s.phase);

  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setNear(true), { rootMargin: "100% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [near]);

  return <div className="map__gl" ref={ref}>{near && phase !== "intro" ? <CityGL days={days} /> : null}</div>;
}
