"use client";

// Live GitHub data in the open page: one shared poll of /api/github every minute while the tab is visible (and right
// away when it becomes visible again), so the contribution stats, the 3D city, the open-source list and the sync time
// update in place, without a reload. Sections start from the data the server rendered and switch when it changes.
import { useEffect, useSyncExternalStore } from "react";
import type { LiveGitHub } from "./github";

const EVERY = 60_000;
let current: LiveGitHub | null = null;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | undefined;
let started = false;

/** A short fingerprint, so a new response that changes nothing doesn't re-render (or rebuild the city). */
export const fingerprint = (d: Pick<LiveGitHub, "days" | "pullRequests">) =>
  `${d.days.length}:${d.days.reduce((s, x) => s + x.count, 0)}:${d.days.at(-1)?.date}:${d.pullRequests.map((p) => `${p.url}${p.status.kind}${p.status.label}`).join("|")}`;

async function poll() {
  clearTimeout(timer);
  if (document.visibilityState === "visible") {
    try {
      const res = await fetch("/api/github", { cache: "no-store" });
      if (res.ok) {
        const next = (await res.json()) as LiveGitHub;
        const changed = !current || fingerprint(current) !== fingerprint(next);
        current = changed ? next : { ...current!, fetchedAt: next.fetchedAt };
        listeners.forEach((l) => l());
      }
    } catch {}
  }
  timer = setTimeout(poll, EVERY);
}

function start() {
  if (started) return;
  started = true;
  timer = setTimeout(poll, EVERY);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") poll(); });
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

/** The latest polled GitHub data, or null until the first poll (starts polling on first use). */
export function useLive(): LiveGitHub | null {
  useEffect(start, []);
  return useSyncExternalStore(subscribe, () => current, () => null);
}

/** Polled data only once it's at least as new as what the server rendered (fetchedAt is an ISO time). */
export function newer(live: LiveGitHub | null, fetchedAt: string): LiveGitHub | null {
  return live && live.fetchedAt >= fetchedAt ? live : null;
}
