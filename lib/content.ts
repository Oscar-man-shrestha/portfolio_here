// Every fact on the site lives here. Nothing in this file is invented: project copy and metrics come from
// Oscar's READMEs and the previous site, links from his own profiles. Decorative HUD labels in the
// components never state facts about him.

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
    status: "from-readme",
    key: "G",
    note: "Taken from the repository READMEs; not yet confirmed by Oscar as his public profile URL.",
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
  },
  {
    id: "malware",
    title: "Malware Fingerprint",
    description: "A Markov-chain classifier for fingerprinting malware.",
    url: "https://github.com/Oscar-man-shrestha/malware_fingerprint",
    tags: ["Machine learning", "Security"],
    visual: "markov",
  },
  {
    id: "raksha",
    title: "RAKSHA",
    description: "An IoT safety node.",
    url: "https://github.com/Oscar-man-shrestha/RAKSHA",
    tags: ["IoT", "Embedded"],
    visual: "beacon",
  },
  {
    id: "eval",
    title: "Eval Validity",
    description: "A study of the metrics used to evaluate EdTech.",
    url: "https://github.com/Oscar-man-shrestha/eval-validity-edu",
    tags: ["Research", "Data"],
    visual: "gauge",
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
  hero: { src: "/img/hero-cutout.webp", w: 1024, h: 930, alt: "Oscar Man Shrestha in a black suit and sunglasses" },
  avatar: { src: "/img/avatar-pixel.webp", w: 480, h: 480, alt: "Pixel-art portrait of Oscar" },
  avatarAlt: { src: "/img/avatar-pixel-2.webp", w: 480, h: 480, alt: "Pixel-art portrait of Oscar in a track jacket" },
  full: { src: "/img/full-cutout.webp", w: 607, h: 1877, alt: "Oscar smiling, in a grey hoodie with headphones and a lanyard, holding a laptop" },
  turnW: 451,
  turnH: 1294,
  turnaround: [
    { src: "/img/turn-1.webp", label: "Front", alt: "Oscar, front view, black hoodie with headphones, holding a laptop" },
    { src: "/img/turn-2.webp", label: "Side", alt: "Oscar, side view" },
    { src: "/img/turn-3.webp", label: "Three-quarter", alt: "Oscar, three-quarter view" },
    { src: "/img/turn-4.webp", label: "Back", alt: "Oscar, back view" },
  ],
};
