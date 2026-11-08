import type { Project } from "@/lib/content";

// Line-art diagrams that describe what each project does, drawn in code. They are deliberately abstract:
// no fake screenshots, no invented numbers or labels beyond what the project copy says.
// Elements with class "draw" are stroked in by GSAP; "pulse" elements loop while the card is on screen.

function Relay() {
  // Baton Pass: one assistant hands the conversation (chat, files, decisions) to the next, which confirms it.
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <g className="draw">
        <rect className="ink" x="34" y="64" width="118" height="150" rx="10" />
        <rect className="ink" x="248" y="86" width="118" height="150" rx="10" />
        <path className="ink-thin" d="M50 92h86M50 106h64M50 120h76M264 114h86M264 128h58" />
        <path className="ink" d="M152 116 C 200 40, 210 40, 248 140" strokeDasharray="5 6" />
      </g>
      <text className="art-txt" x="34" y="54">Assistant A</text>
      <text className="art-txt" x="248" y="76">Assistant B</text>
      <g className="relay-packets">
        <rect className="fill-ink" x="50" y="146" width="72" height="16" />
        <text className="art-txt fill-paper" x="56" y="157" style={{ fill: "var(--color-paper)" }}>Chat</text>
        <rect className="fill-ink" x="50" y="166" width="72" height="16" />
        <text className="art-txt" x="56" y="177" style={{ fill: "var(--color-paper)" }}>Files</text>
        <rect className="fill-red" x="50" y="186" width="86" height="16" />
        <text className="art-txt" x="56" y="197">Decisions</text>
      </g>
      <g className="relay-baton">
        <rect className="fill-red" x="-17" y="-7" width="34" height="14" rx="7" />
      </g>
      <g className="relay-check" transform="translate(307 196)">
        <circle className="ink" r="16" />
        <path className="ink-red" d="M-7 0l5 5 9-10" />
      </g>
      <path id="relayPath" d="M152 116 C 200 40, 210 40, 248 140" fill="none" stroke="none" />
    </svg>
  );
}

function Markov() {
  // Malware Fingerprint: states and weighted transitions of a Markov chain.
  const nodes = [
    [80, 90], [200, 56], [320, 96], [130, 214], [272, 222],
  ];
  const edges: [number, number, number][] = [
    [0, 1, 3], [1, 2, 2], [2, 4, 3], [4, 3, 1.5], [3, 0, 2], [1, 3, 1], [0, 4, 1], [2, 1, 1.2],
  ];
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <defs>
        <marker id="mk" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0 0L8 4L0 8z" fill="var(--color-ink)" />
        </marker>
      </defs>
      <g className="draw">
        {edges.map(([a, b, w], i) => {
          const [x1, y1] = nodes[a], [x2, y2] = nodes[b];
          const mx = (x1 + x2) / 2 + (y2 - y1) * 0.18, my = (y1 + y2) / 2 - (x2 - x1) * 0.18;
          const dx = x2 - mx, dy = y2 - my, L = Math.hypot(dx, dy);
          const ex = x2 - (dx / L) * 24, ey = y2 - (dy / L) * 24;
          return <path key={i} className="ink" d={`M${x1} ${y1} Q ${mx} ${my} ${ex} ${ey}`} style={{ strokeWidth: w }} markerEnd="url(#mk)" />;
        })}
      </g>
      {nodes.map(([x, y], i) => (
        <g key={i} transform={`translate(${x} ${y})`} className="markov-node">
          <circle r="21" className={i === 2 ? "fill-red" : "fill-paper"} />
          <circle r="21" className="ink" />
          <text className="art-txt" textAnchor="middle" y="3.5">S{i + 1}</text>
        </g>
      ))}
    </svg>
  );
}

function Beacon() {
  // RAKSHA: an IoT safety node broadcasting.
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <g className="beacon-rings">
        {[0, 1, 2, 3].map((i) => <circle key={i} className="ink pulse" cx="200" cy="150" r="40" style={{ transformOrigin: "200px 150px" }} />)}
      </g>
      <g className="draw">
        <rect className="ink" x="172" y="122" width="56" height="56" rx="4" />
        <path className="ink-thin" d="M172 136h-12M172 150h-12M172 164h-12M228 136h12M228 150h12M228 164h12M186 122v-12M200 122v-12M214 122v-12M186 178v12M200 178v12M214 178v12" />
        <path className="ink" d="M40 252h320M60 252v-14M340 252v-14" />
      </g>
      <rect className="fill-red" x="188" y="138" width="24" height="24" />
      <text className="art-txt" x="40" y="272">Node</text>
      <text className="art-txt" x="360" y="272" textAnchor="end">Safety</text>
    </svg>
  );
}

function Gauge() {
  // Eval Validity: measuring the measures — bars against a reference line, with a gauge.
  const bars = [62, 120, 86, 150, 104, 132];
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <g className="draw">
        <path className="ink" d="M40 240h200M40 240V60" />
        <path className="ink-red" d="M40 130h200" strokeDasharray="6 6" />
        <path className="ink" d="M270 200a60 60 0 0 1 120 0" />
        <path className="ink-thin" d="M276 200h-6M390 200h-6M330 140v6M288 158l4 4M372 158l-4 4" />
      </g>
      {bars.map((h, i) => (
        <rect key={i} className={`gauge-bar ${i === 3 ? "fill-red" : "fill-ink"}`} x={56 + i * 30} y={240 - h} width="18" height={h} style={{ transformOrigin: `0 240px` }} />
      ))}
      <g className="gauge-needle" style={{ transformOrigin: "330px 200px" }}>
        <path d="M330 200L330 152" stroke="var(--color-ink)" strokeWidth="3" strokeLinecap="round" />
        <circle cx="330" cy="200" r="6" className="fill-ink" />
      </g>
      <text className="art-txt" x="244" y="134">?</text>
    </svg>
  );
}

export default function MissionArt({ visual }: { visual: Project["visual"] }) {
  switch (visual) {
    case "relay": return <Relay />;
    case "markov": return <Markov />;
    case "beacon": return <Beacon />;
    case "gauge": return <Gauge />;
  }
}
