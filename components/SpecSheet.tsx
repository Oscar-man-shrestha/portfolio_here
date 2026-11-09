"use client";

// The spec sheet: a HUD strip above the footer with real numbers about this visit, measured in the visitor's own
// browser (Navigation and Resource Timing, Largest Contentful Paint where the browser reports it), plus the facts
// about OMS-mini and the GitHub sync. Nothing is sent anywhere; it only reads what the browser already knows.
import { useEffect, useState } from "react";
import { newer, useLive } from "@/lib/live";
import { MODEL_BYTES } from "@/lib/minilm";

type Spec = { paint?: number; paintKind: "LCP" | "load"; bytes?: number; cached: boolean; js?: number; requests?: number };

const mb = (b: number) => (b >= 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1e3))} KB`);

export default function SpecSheet({ fetchedAt }: { fetchedAt: string }) {
  const [spec, setSpec] = useState<Spec | null>(null);

  useEffect(() => {
    let lcp: number | undefined;
    let po: PerformanceObserver | undefined;
    try {
      po = new PerformanceObserver((list) => { const e = list.getEntries().at(-1); if (e) lcp = e.startTime; });
      po.observe({ type: "largest-contentful-paint", buffered: true });
    } catch {}
    const measure = () => {
      const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
      const res = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
      const all = [...(nav ? [nav] : []), ...res];
      const bytes = all.reduce((s, r) => s + (r.transferSize || 0), 0);
      const decoded = all.reduce((s, r) => s + (r.decodedBodySize || 0), 0);
      const js = res.filter((r) => r.initiatorType === "script" || /\.m?js(\?|$)/.test(r.name)).reduce((s, r) => s + (r.transferSize || r.encodedBodySize || 0), 0);
      const load = nav && nav.loadEventEnd > 0 ? nav.loadEventEnd : undefined;
      setSpec({
        paint: lcp ?? load, paintKind: lcp !== undefined ? "LCP" : "load",
        bytes, cached: bytes < decoded * 0.05, js, requests: all.length,
      });
      po?.disconnect();
    };
    // measure once the page has fully loaded and settled (the films and WebGL keep loading after that, lazily)
    const later = () => setTimeout(measure, 1500);
    if (document.readyState === "complete") later();
    else addEventListener("load", later, { once: true });
    return () => { po?.disconnect(); removeEventListener("load", later); };
  }, []);

  const live = newer(useLive(), fetchedAt);
  const synced = new Date(live?.fetchedAt ?? fetchedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
  return (
    <section className="spec hud" aria-label="About this visit">
      <p className="spec__k"><span className="sq" />System status</p>
      <dl className="spec__grid">
        <div><dt>{spec?.paintKind === "LCP" ? "Main content shown" : "Page loaded"}</dt><dd>{spec?.paint !== undefined ? `${(spec.paint / 1000).toFixed(2)} s` : "measuring…"}<small>on your device</small></dd></div>
        <div><dt>Transferred</dt><dd>{spec ? (spec.cached ? "from cache" : mb(spec.bytes ?? 0)) : "measuring…"}<small>{spec?.requests ? `${spec.requests} requests so far` : "this visit"}</small></dd></div>
        <div><dt>OMS-mini</dt><dd>{mb(MODEL_BYTES)}<small>model runs on your device · no server</small></dd></div>
        <div><dt>GitHub sync</dt><dd>{synced} UTC<small>live data, updates every minute</small></dd></div>
      </dl>
    </section>
  );
}
