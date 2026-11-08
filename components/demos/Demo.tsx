"use client";

import dynamic from "next/dynamic";

const Loading = () => <div className="demo demo--loading hud" aria-busy="true">Loading demo…</div>;
const demos = {
  baton: dynamic(() => import("./BatonDemo"), { ssr: false, loading: Loading }),
  malware: dynamic(() => import("./MarkovDemo"), { ssr: false, loading: Loading }),
  raksha: dynamic(() => import("./RakshaDemo"), { ssr: false, loading: Loading }),
  eval: dynamic(() => import("./EvalDemo"), { ssr: false, loading: Loading }),
} as const;

export default function Demo({ id }: { id: string }) {
  const D = demos[id as keyof typeof demos];
  return D ? <D /> : null;
}
