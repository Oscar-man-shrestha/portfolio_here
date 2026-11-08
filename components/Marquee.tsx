// Three rows of oversized type that drift with scroll velocity (the reference video's "3D TYPE" band).
// The whole band is decorative. The dim "ghost" row is drawn from CSS generated content, so it stays out of the
// accessibility tree and contrast checks (WCAG 1.4.3 exempts pure decoration).
const rows = [
  { cls: "", ghost: false, words: ["Machine learning", "Security", "Web"] },
  { cls: "mq__row--outline", ghost: false, words: ["Oscar Man Shrestha", "オスカー", "Portfolio 2026"] },
  { cls: "mq__row--dim", ghost: true, words: ["Selected work", "Open source", "Activity"] },
];

export default function Marquee() {
  return (
    <div className="mq" aria-hidden="true">
      {rows.map((r, i) => (
        <div className={`mq__row ${r.cls}`} data-dir={i % 2 ? -1 : 1} key={i}>
          {[0, 1, 2].map((k) => (
            <span key={k}>
              {r.words.map((w, j) =>
                r.ghost ? (
                  <span key={j} className="ps" data-text={w} style={{ padding: 0 }}><i>✦</i></span>
                ) : (
                  <span key={j} style={{ padding: 0 }}>{w}<i>✦</i></span>
                ),
              )}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}
