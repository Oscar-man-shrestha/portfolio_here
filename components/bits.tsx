// Small original glyphs used across the HUD. Decorative only (aria-hidden).

export function Barcode({ code = "OMS-2026-ML-SEC-WEB", height = 22 }: { code?: string; height?: number }) {
  // Deterministic bar pattern derived from the code's characters.
  const bars: { x: number; w: number }[] = [];
  let x = 0;
  for (let i = 0; i < code.length; i++) {
    const c = code.charCodeAt(i);
    const seq = [1 + (c % 3), 1 + ((c >> 2) % 2), 2 + ((c >> 1) % 3), 1 + ((c >> 3) % 2)];
    seq.forEach((w, j) => {
      if (j % 2 === 0) bars.push({ x, w });
      x += w;
    });
    x += 1;
  }
  return (
    <svg viewBox={`0 0 ${x} ${height}`} height={height} aria-hidden="true" preserveAspectRatio="none">
      {bars.map((b, i) => <rect key={i} x={b.x} y={0} width={b.w} height={height} fill="currentColor" />)}
    </svg>
  );
}

export function Emblem() {
  return (
    <svg viewBox="0 0 64 50" aria-hidden="true">
      <path d="M0 0h13l19 13L51 0h13L32 24z" fill="currentColor" />
      <path d="M0 13h13l19 13 19-13h13L32 37z" fill="currentColor" opacity=".55" />
      <path d="M8 34h8l16 11 16-11h8L32 50z" fill="currentColor" opacity=".3" />
    </svg>
  );
}

export function JumpArrow() {
  return (
    <svg viewBox="0 0 60 60" aria-hidden="true">
      <path d="M14 4h42v42H44V24.5L12.5 56 4 47.5 35.5 16H14z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="miter" />
    </svg>
  );
}

export function TextRing({ text }: { text: string }) {
  return (
    <svg viewBox="0 0 120 120" aria-hidden="true">
      <defs>
        <path id="ring" d="M60 60m-52 0a52 52 0 1 1 104 0a52 52 0 1 1-104 0" />
      </defs>
      <text fontFamily="var(--font-hud)" fontSize="7.4" letterSpacing="2.6" fill="rgba(236,236,230,.62)">
        <textPath href="#ring">{text}</textPath>
      </text>
    </svg>
  );
}
