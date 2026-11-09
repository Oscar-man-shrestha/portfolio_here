"use client";

// The hidden puzzle (lib/ctf writes its pieces). Stage 1: a banner in the browser console. Stage 2: a Base64
// transmission in the page's <head>. Stage 3: decrypt the XOR cipher and submit the flag with oms.flag("..."). A
// correct flag shows a small panel inviting the solver to email Oscar. Answers are checked by SHA-256, here only.
import { useEffect, useState } from "react";

declare global {
  interface Window { oms?: { help: () => string; flag: (answer: string) => Promise<string> } }
}

const red = "color:#ff2e4c;font:700 13px monospace", dim = "color:#9a9c90;font:12px monospace";

async function sha256(text: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default function Ctf({ hash, email }: { hash: string; email: string }) {
  const [solved, setSolved] = useState(false);

  useEffect(() => {
    window.oms = {
      help: () => {
        console.log("%cOMS // stage 1 cleared.%c\nTransmission 02 is in this page's <head>: <meta name=\"oms:transmission\">. It's Base64.", red, dim);
        return "Good luck, operator.";
      },
      flag: async (answer: string) => {
        const ok = typeof answer === "string" && (await sha256(answer.trim())) === hash;
        if (!ok) { console.log("%cOMS // access denied.%c Check the key and try again.", red, dim); return "denied"; }
        console.log("%cOMS // FLAG CAPTURED.%c\nNice work. Tell Oscar you found it: " + email, red, dim);
        try { localStorage.setItem("oms.ctf", "1"); } catch {}
        setSolved(true);
        return "captured";
      },
    };
    console.log(
      "%c\n  ▓▓ OMS // SECURITY CHANNEL OPEN ▓▓\n%c\n  Poking around the console? Good. There's a small capture-the-flag hidden on this site.\n  Stage 1: run  oms.help()\n",
      red, dim,
    );
    return () => { delete window.oms; };
  }, [hash, email]);

  if (!solved) return null;
  return (
    <div className="ctf" role="status">
      <p className="ctf__k hud"><span className="sq" />Flag captured // 03 of 03</p>
      <p className="ctf__msg">You decoded the transmission and cracked the cipher. Mention the flag when you write to Oscar.</p>
      <div className="ctf__act">
        <a className="btn btn--signal" href={`mailto:${email}?subject=${encodeURIComponent("Found your flag")}`}><span>Email Oscar</span></a>
        <button type="button" className="ctf__x hud" onClick={() => setSolved(false)}>Close</button>
      </div>
    </div>
  );
}
