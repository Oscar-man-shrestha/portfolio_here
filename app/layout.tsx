import type { Metadata, Viewport } from "next";
import { Mona_Sans, Michroma, JetBrains_Mono, Metal_Mania } from "next/font/google";
import localFont from "next/font/local";
import { FILM } from "@/lib/film";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

// All three families are SIL Open Font License 1.1 (Google Fonts). next/font downloads them at build time and
// serves them from this site, so visitors make no requests to Google.
const mona = Mona_Sans({ subsets: ["latin"], axes: ["wdth"], variable: "--font-mona", display: "swap" });
const michroma = Michroma({ subsets: ["latin"], weight: "400", variable: "--font-michroma", display: "swap" });
const jet = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-jet", display: "swap" });
// Accent numerals in the spirit of the "Bagru" reference (hardcore letterforms). OFL 1.1.
// Dela Gothic One (OFL 1.1), subset to the 30 Japanese characters the site uses (4 KB).
const jp = localFont({ src: "./fonts/dela-gothic-one-subset.woff2", variable: "--font-jp", display: "swap", preload: false });
const metal = Metal_Mania({ subsets: ["latin"], weight: "400", variable: "--font-metal", display: "swap", preload: false });

// what search results show under the name: who, where, what, and the work by name
const TITLE = "Oscar Man Shrestha · Software Engineer Portfolio";
const description =
  "Portfolio of Oscar Man Shrestha, a software engineer in Bangalore working across machine learning, security and the web: Baton Pass, Malware Fingerprint, RAKSHA and open source.";
// the card shown when the link is shared (public/og.png, built by tools/og/build.py)
const card = { url: "/og.png", width: 1200, height: 630, alt: "Oscar Man Shrestha, software engineer: machine learning, security, web" };

export const metadata: Metadata = {
  // absolute links for the card: SITE_URL if set, else the Vercel production address, else local
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description,
  applicationName: "Oscar Man Shrestha",
  authors: [{ name: "Oscar Man Shrestha", url: SITE_URL }],
  creator: "Oscar Man Shrestha",
  keywords: ["Oscar Man Shrestha", "Oscar Shrestha", "oscarmanshrestha", "software engineer", "portfolio", "machine learning", "security", "web", "Bangalore"],
  icons: { icon: "/img/avatar-pixel.webp", apple: "/img/avatar-pixel.webp" },
  openGraph: { type: "profile", firstName: "Oscar", lastName: "Man Shrestha", title: TITLE, description, images: [card], siteName: "Oscar Man Shrestha", locale: "en_GB", url: "/" },
  twitter: { card: "summary_large_image", title: TITLE, description, images: [card] },
  // Google Search Console's ownership check: set GOOGLE_SITE_VERIFICATION to the code it gives (see README)
  ...(process.env.GOOGLE_SITE_VERIFICATION ? { verification: { google: process.env.GOOGLE_SITE_VERIFICATION } } : {}),
};

export const viewport: Viewport = {
  themeColor: "#09090a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// Runs before first paint: decides whether the intro film plays (skipped with ?skip, on reduced motion or when it
// was already seen this session, unless ?intro) and records the motion preference. It also sets up the card-to-page
// morph (the browser's cross-document View Transitions): just before the home page hands over to a project page, the
// opening card's art, title and number take the names the project page gives its own (globals.css, v12), so the
// browser morphs one into the other. Browsers without View Transitions simply load the page.
const bootScript = `(function(){var q=new URLSearchParams(location.search),r=document.documentElement,rm=false,seen=false,off=false;
try{rm=matchMedia("(prefers-reduced-motion: reduce)").matches}catch(e){}
try{off=localStorage.getItem("oms.motion")==="off"}catch(e){}
if(q.get("motion")==="reduce")rm=true;
try{seen=sessionStorage.getItem("oms.intro")==="1"}catch(e){}
r.classList.add("js");if(location.pathname==="/")r.classList.add("is-loading");
if(rm||off)r.classList.add("reduce-motion");
if(q.has("skip")||(seen&&!q.has("intro")))r.classList.add("no-intro");
var vtNames=[[".mission__art","pj-art"],[".mission__title","pj-title"],[".mission__num","pj-num"]];
addEventListener("pageswap",function(e){var vt=e.viewTransition;if(!vt)return;
if(r.classList.contains("reduce-motion")){vt.ready.catch(function(){});vt.skipTransition();return}
document.querySelectorAll(".mission__art,.mission__title,.mission__num").forEach(function(el){el.style.viewTransitionName=""});
var to=e.activation&&e.activation.entry&&e.activation.entry.url;if(!to)return;
var m=new URL(to).pathname.match(/^\\/work\\/([a-z0-9-]+)\\/?$/i);if(!m)return;
var t=document.getElementById("m-"+m[1]),card=t&&t.closest(".mission__card");if(!card)return;
var b=card.getBoundingClientRect();if(b.bottom<0||b.top>innerHeight)return;
vtNames.forEach(function(p){var el=card.querySelector(p[0]);if(el)el.style.viewTransitionName=p[1]})});
addEventListener("pagereveal",function(e){if(!e.viewTransition)return;
if(r.classList.contains("reduce-motion")){e.viewTransition.ready.catch(function(){});e.viewTransition.skipTransition();return}r.setAttribute("data-vt","1")});})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${mona.variable} ${michroma.variable} ${jet.variable} ${metal.variable} ${jp.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
        <link rel="preload" as="image" href={FILM.poster} fetchPriority="high" />
      </head>
      <body>{children}</body>
    </html>
  );
}
