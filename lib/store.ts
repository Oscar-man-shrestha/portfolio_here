import { create } from "zustand";

export type Phase = "intro" | "boot" | "site";

interface SiteState {
  phase: Phase;
  /** The film is playing (or there is no film): heavy work may start without stealing its first frames. */
  filmStarted: boolean;
  heroGL: "idle" | "ready" | "failed";
  cityGL: "idle" | "ready" | "failed";
  set: (patch: Partial<Omit<SiteState, "set">>) => void;
}

export const useSite = create<SiteState>((set) => ({
  phase: "intro",
  filmStarted: false,
  heroGL: "idle",
  cityGL: "idle",
  set: (patch) => set(patch),
}));
