"use client";

// Loads the live Baton demo only in the browser (it imports the model runtime when run).
import dynamic from "next/dynamic";

const BatonLive = dynamic(() => import("./BatonLive"), { ssr: false, loading: () => <div className="demo demo--loading hud" aria-busy="true">Loading demo…</div> });
export default function BatonLiveMount() { return <BatonLive />; }
