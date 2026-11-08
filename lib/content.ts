// Every fact on the site lives here. Nothing in this file is invented: project copy and metrics come from
// Oscar's READMEs and the previous site, links from his own profiles. Decorative HUD labels in the
// components never state facts about him.

import headTurn from "./headturn.json";
import turn360 from "./turn360.json";

export type LinkStatus = "confirmed" | "from-readme" | "missing";

export interface ProfileLink {
  label: string;
  url: string | null;
  status: LinkStatus;
  /** Keyboard shortcut on the contact screen. */
  key?: string;
  note?: string;
}

export const person = {
  name: "Oscar Man Shrestha",
  first: "Oscar",
  rest: "Man Shrestha",
  initials: "OMS",
  role: "Software engineer",
  disciplines: ["Machine learning", "Security", "Web"],
  base: "Bangalore, IN",
  timeZone: "Asia/Kolkata",
  email: "oscarmanshrestha@gmail.com",
  about:
    "I'm a software engineer working across machine learning, security and the web. My work ranges from a Markov-chain malware classifier and a Chrome extension to upstream fixes in Hugging Face Datasets, xarray and skrub.",
  offClock: ["Guitar", "Karate", "Skateboarding"],
};

export const links: ProfileLink[] = [
  { label: "LinkedIn", url: "https://www.linkedin.com/in/oscar-man-shrestha-701455313/", status: "confirmed", key: "L" },
  {
    label: "GitHub",
    url: "https://github.com/Oscar-man-shrestha",
    status: "confirmed",
    key: "G",
    note: "Confirmed 8 Nov 2026: Oscar's GitHub CLI is signed in to this account and he pushed this site to it.",
  },
  { label: "Instagram", url: "https://www.instagram.com/oscar_man_shrestha/", status: "confirmed", key: "I" },
  { label: "Threads", url: "https://www.threads.com/@oscar_man_shrestha", status: "confirmed", key: "T" },
  // Missing until Oscar provides it. Never rendered while url is null.
  { label: "X", url: null, status: "missing", note: "Profile URL not provided." },
];

export interface Stat {
  value: string;
  label: string;
}

export interface Project {
  id: string;
  title: string;
  description: string;
  url: string;
  tags: string[];
  stats?: Stat[];
  /** Which line-art diagram represents the project (drawn in code, not a fake screenshot). */
  visual: "relay" | "markov" | "beacon" | "gauge";
  /** Facts for the project's demo page, taken from the repository README (8 Nov 2026). */
  page: {
    tagline: string;
    problem: string;
    how: string[];
    facts: { k: string; v: string }[];
    stack: string[];
    extraLinks?: { label: string; url: string }[];
    caveat?: string;
  };
}

export const projects: Project[] = [
  {
    id: "baton",
    title: "Baton Pass",
    description:
      "A Chrome extension that carries a whole AI conversation, including the chat, files and decisions, to another assistant in one click. It then checks that the next AI actually picked it up.",
    url: "https://github.com/Oscar-man-shrestha/Baton",
    tags: ["Chrome MV3", "On-device ranking", "v1.1.0 · MIT"],
    stats: [
      { value: "100%", label: "must-keep facts carried (benchmark)" },
      { value: "12/12", label: "real hand-offs continued the work" },
      { value: "357", label: "automated tests" },
    ],
    visual: "relay",
    page: {
      tagline: "Your AI ran out mid-project? Keep going in another one, with nothing lost.",
      problem:
        "Free AI chats run out in the middle of the work, and long chats quietly get worse. Starting over in another AI means copying the conversation by hand, and something always gets lost: the first messages, the decisions, what you already turned down, the exact file names.",
      how: [
        "Chat as usual on any of the six AIs. A Baton button sits next to the chat box, with a bar showing how much you have left.",
        "Click the Baton button (or press Ctrl/Cmd+Shift+U) and pick the next AI. Baton suggests the best one for the task.",
        "Read the draft and press Send. The new AI opens with the whole project typed in and your files attached. Baton never sends anything for you.",
        "Baton checks the first reply. If the new AI ignored a rule, brought back something you rejected or changed a settled number, one click puts a correction in the chat box.",
      ],
      facts: [
        { k: "Works with", v: "ChatGPT, Claude, Gemini, DeepSeek, Grok, Perplexity" },
        { k: "Must-keep facts that reach the next AI", v: "100% (offline benchmark, 6 chats; v1.0: 80%)" },
        { k: "Real replies that continued the work", v: "12 / 12" },
        { k: "Real slips caught by the reply check", v: "1 of 1, no false alarms" },
        { k: "Automated tests", v: "357 passing" },
        { k: "Privacy", v: "Chats stay in the browser. No account, no analytics, no server in between." },
      ],
      stack: ["TypeScript", "Chrome Manifest V3", "WXT", "ONNX Runtime (on-device ranking)"],
      extraLinks: [
        { label: "Add to Chrome", url: "https://chromewebstore.google.com/detail/baton-pass/geklhdkeioejfjlpkgjcgmnhbifabknb" },
        { label: "Project website", url: "https://oscar-man-shrestha.github.io/Baton/" },
      ],
    },
  },
  {
    id: "malware",
    title: "Malware Fingerprint",
    description: "A Markov-chain classifier for fingerprinting malware.",
    url: "https://github.com/Oscar-man-shrestha/malware_fingerprint",
    tags: ["Machine learning", "Security"],
    visual: "markov",
    page: {
      tagline: "A probability-first malware classifier with explainable maths and confidence intervals.",
      problem:
        "Neural malware classifiers often report accuracy without uncertainty bounds. This engine models Windows API call sequences as Markov chains and classifies families in a three-dimensional metric space with closed-form statistical checks.",
      how: [
        "Abstract each API trace at three levels: behaviour categories (file, registry, network, process, memory, crypto…), subcategories, and raw API names.",
        "Build five transition matrices per trace (first-order on each level, second-order on the first two) and combine them into one hybrid fingerprint with density-based softmax weights.",
        "Compare the fingerprint with each family reference on three features: Jensen-Shannon divergence, entropy-rate gap and stationary-distribution distance.",
        "Classify by nearest family in that 3D space, with Hoeffding confidence intervals and McNemar tests against single-order baselines.",
      ],
      facts: [
        { k: "Fingerprint", v: "Φ_hybrid = w1·P_L1 + w2·P_L2 + w3·P_L3 + w4·P_L1² + w5·P_L2² (row-renormalised)" },
        { k: "Feature space", v: "JS divergence · entropy-rate gap · stationary L1 distance" },
        { k: "Family references", v: "Built by count pooling (maximum-likelihood), not by averaging matrices" },
        { k: "Status", v: "Current results are simulation-study findings on synthetic traces; real-data result pending" },
      ],
      stack: ["Python", "NumPy", "SciPy"],
      caveat: "The repository reports simulation-study findings only; no real-data accuracy is claimed here.",
    },
  },
  {
    id: "raksha",
    title: "RAKSHA",
    description: "A bench safety node for informal workshops: heat index, process-air risk, fall detection and an exposure record.",
    url: "https://github.com/Oscar-man-shrestha/RAKSHA",
    tags: ["IoT", "ESP32", "Safety"],
    visual: "beacon",
    page: {
      tagline: "A bench safety node for informal workshops, built for SDG 8.",
      problem:
        "People in brick kilns, tailoring units, welding shops and small construction sites work in heat, dust and fumes with no instrument on the bench. A bad hour is invisible until someone is already hurt, and employers have no record of how long a named worker was in those conditions.",
      how: [
        "A worker signs onto the shift with an RFID card; a second tap acknowledges an alarm.",
        "A Rothfusz heat index from the DHT22 is placed on a five-step band: below 27 °C, caution, extreme caution, danger, extreme.",
        "Exposure seconds count only while PIR or IR sees a person, so an empty bench adds no hours.",
        "A fall is free-fall, then impact, then a still posture, so shaking the bench never triggers it. Fan and beacon relays react; a CSV record and a local dashboard keep working without the workshop router.",
      ],
      facts: [
        { k: "Controller", v: "ESP32 DevKit V1, Arduino C++" },
        { k: "Sensors", v: "DHT22, NTC, MPU6050, PIR + IR, KY-037 sound, RC522 RFID" },
        { k: "Worker interface", v: "SSD1306 OLED, RGB LED, vibration motor" },
        { k: "Record", v: "LittleFS /shift.csv every 15 s and on every edge" },
        { k: "Network", v: "Station for 10 s, then its own access point at 192.168.4.1" },
        { k: "Process air", v: "A risk score from noise, humidity and heat. The kit has no gas sensor; the score is not a ppm reading." },
      ],
      stack: ["ESP32", "Arduino C++", "LittleFS", "HTML dashboard", "Logicraft simulation"],
    },
  },
  {
    id: "eval",
    title: "Eval Validity",
    description: "Research on whether next-item metrics in educational logs measure learning or just repetition.",
    url: "https://github.com/Oscar-man-shrestha/eval-validity-edu",
    tags: ["Research", "Data"],
    visual: "gauge",
    page: {
      tagline: "Do next-item scores in educational logs measure learning, or just reward repetition?",
      problem:
        "EdTech models are often judged by how well they predict the next item a learner touches. If repetition and curriculum order alone score well, a high number may say little about learning.",
      how: [
        "Compare simple recency and Markov baselines with local GRU sequence probes.",
        "Re-run the comparison with an action represented as a question, topic, skill or knowledge-component cluster, and see how conclusions change.",
        "Freeze the protocol and input hashes in a preregistration before any confirmatory test.",
        "Audit findings, effect thresholds and non-claims in a research integrity report.",
      ],
      facts: [
        { k: "Datasets", v: "Junyi, ASSISTments 2009, XES3G5M" },
        { k: "Preregistration", v: "Protocol frozen in the prereg-v1 release; OSF submission recorded 7 Oct 2026" },
        { k: "Status", v: "Confirmatory holdout not yet run; exploratory rankings are not presented as results" },
        { k: "Contribution", v: "An evaluation protocol and its audit, not a state-of-the-art recommender" },
      ],
      stack: ["Python", "PyTorch (GRU probes)", "pytest", "GitHub Actions"],
      caveat: "The confirmatory test has not been run, so no result is claimed here.",
    },
  },
];

export interface PullRequest {
  repo: string;
  title: string;
  number: number;
  url: string;
}

// Opened by Oscar. The site does not claim they were merged.
export const pullRequests: PullRequest[] = [
  { repo: "huggingface/datasets", title: "Read-only shared caches", number: 8902, url: "https://github.com/huggingface/datasets/pull/8902" },
  { repo: "pydata/xarray", title: "Shared HDF5 file handles", number: 11809, url: "https://github.com/pydata/xarray/pull/11809" },
  { repo: "skrub-data/skrub", title: "GeoPandas column warning", number: 2374, url: "https://github.com/skrub-data/skrub/pull/2374" },
];

export const stack: { slot: string; items: string[] }[] = [
  { slot: "Languages", items: ["Python", "TypeScript", "Java", "C", "Dart"] },
  { slot: "ML / Data", items: ["PyTorch", "scikit-learn", "NumPy", "Pandas"] },
  { slot: "Web", items: ["React", "Next.js", "Node", "Express", "MongoDB"] },
  { slot: "Systems", items: ["ESP32", "Chrome MV3", "Linux", "GitHub Actions"] },
];

export const nav = [
  { id: "work", label: "Work" },
  { id: "activity", label: "Activity" },
  { id: "oss", label: "Open source" },
  { id: "profile", label: "Profile" },
  { id: "contact", label: "Contact" },
] as const;

/** Oscar's own images (refs 1–5), cut out locally with macOS Vision. Pixels inside the subject are untouched. */
export const images = {
  /** Frame 0 of the hero clip: Oscar's real photo as the clip's first frame. */
  hero: { src: `${headTurn.dir}/d/00.webp`, w: headTurn.w, h: headTurn.h, alt: "Oscar Man Shrestha in a black suit and sunglasses" },
  /**
   * The hero performance: a short Google Flow clip Oscar animated from his real photo (frame 0 is that photo), cut
   * out frame by frame with macOS Vision (tools/headturn). `frames` are clip frame numbers, `pos` spaces them by
   * measured motion, `marks` name the moments the site rests on. `dir` is named after the clip, so browsers that
   * cached an earlier clip's frames (cached for a year) can never mix them in. `d` holds full-size frames, `m` phone ones.
   */
  headTurn,
  /**
   * The profile turntable: a Google Flow clip of Oscar turning on a studio turntable, made from his turnaround photos
   * and cut out frame by frame (tools/headturn, --person-only drops the turntable disc). `marks` are the four views.
   */
  turn360,
  avatar: { src: "/img/avatar-pixel.webp", w: 480, h: 480, alt: "Pixel-art portrait of Oscar" },
  avatarAlt: { src: "/img/avatar-pixel-2.webp", w: 480, h: 480, alt: "Pixel-art portrait of Oscar in a track jacket" },
  full: { src: "/img/full-cutout.webp", w: 607, h: 1877, alt: "Oscar smiling, in a grey hoodie with headphones and a lanyard, holding a laptop" },
  turnW: 451,
  turnH: 1294,
  // in the order the turntable passes them; the photos show when WebGL is off
  turnaround: [
    { src: "/img/turn-1.webp", label: "Front", alt: "Oscar, front view, black hoodie with headphones, holding a laptop" },
    { src: "/img/turn-3.webp", label: "Three-quarter", alt: "Oscar, three-quarter view" },
    { src: "/img/turn-2.webp", label: "Side", alt: "Oscar, side view" },
    { src: "/img/turn-4.webp", label: "Back", alt: "Oscar, back view" },
  ],
};
