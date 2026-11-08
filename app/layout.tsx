import type { Metadata, Viewport } from "next";
import { Mona_Sans, Michroma, JetBrains_Mono, Metal_Mania } from "next/font/google";
import "./globals.css";

// All three families are SIL Open Font License 1.1 (Google Fonts). next/font downloads them at build time and
// serves them from this site, so visitors make no requests to Google.
const mona = Mona_Sans({ subsets: ["latin"], axes: ["wdth"], variable: "--font-mona", display: "swap" });
const michroma = Michroma({ subsets: ["latin"], weight: "400", variable: "--font-michroma", display: "swap" });
const jet = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-jet", display: "swap" });
// Accent numerals in the spirit of the "Bagru" reference (hardcore letterforms). OFL 1.1.
const metal = Metal_Mania({ subsets: ["latin"], weight: "400", variable: "--font-metal", display: "swap", preload: false });

export const metadata: Metadata = {
  title: "Oscar Man Shrestha · Software Engineer",
  description: "Oscar Man Shrestha: software engineer working across machine learning, security and the web.",
  icons: { icon: "/img/avatar-pixel.webp" },
};

export const viewport: Viewport = {
  themeColor: "#09090a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// Runs before first paint: decides whether the intro film plays (skipped with ?skip, on reduced motion or when it
// was already seen this session, unless ?intro) and records the motion preference.
const bootScript = `(function(){var q=new URLSearchParams(location.search),r=document.documentElement,rm=false,seen=false,off=false;
try{rm=matchMedia("(prefers-reduced-motion: reduce)").matches}catch(e){}
try{off=localStorage.getItem("oms.motion")==="off"}catch(e){}
if(q.get("motion")==="reduce")rm=true;
try{seen=sessionStorage.getItem("oms.intro")==="1"}catch(e){}
r.classList.add("js");if(location.pathname==="/")r.classList.add("is-loading");
if(rm||off)r.classList.add("reduce-motion");
if(q.has("skip")||(seen&&!q.has("intro")))r.classList.add("no-intro");})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${mona.variable} ${michroma.variable} ${jet.variable} ${metal.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
        <link rel="preload" as="image" href="/video/poster.jpg" fetchPriority="high" />
      </head>
      <body>{children}</body>
    </html>
  );
}
