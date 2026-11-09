// OMS-mini: the guide on the home page. It runs entirely in the visitor's browser: a small pretrained
// language model (MiniLM, lib/minilm.ts) understands the question, and the answer is one of the cards written from
// the site's own content (lib/guide-kb.ts), so it can't invent anything. This file holds the shared types.

/** Sections OMS-mini can scroll to (element ids on the home page). */
export const SECTIONS = ["top", "work", "activity", "oss", "profile", "contact"] as const;
export type SectionId = (typeof SECTIONS)[number];
export const SECTION_LABELS: Record<SectionId, string> = {
  top: "the top of the page",
  work: "Selected work",
  activity: "Contribution city",
  oss: "Open source",
  profile: "Profile",
  contact: "Contact",
};

/** Projects OMS-mini can turn the mission wheel to. Must match the ids in lib/content (guide-kb checks). */
export const PROJECT_IDS = ["baton", "malware", "raksha", "eval"] as const;
export type ProjectId = (typeof PROJECT_IDS)[number];

export type GuideAction =
  | { name: "show_project"; target: ProjectId; label: string }
  | { name: "show_section"; target: SectionId; label: string };

/** Project facets a follow-up question can ask about ("how does it work?" after a project was discussed). */
export type Facet = "main" | "how" | "stack" | "facts" | "links";

/** One answer. `q` are example questions the matcher compares against; `a` is the answer (a small markdown subset). */
export interface GuideCard {
  id: string;
  q: string[];
  /** Words that point strongly at this card. */
  keys?: string[];
  /** Names that settle the question on their own (the repositories Oscar contributed to, from GitHub). */
  names?: string[];
  a: string;
  action?: GuideAction;
  /** Suggested follow-up questions shown as chips under the answer. */
  next?: string[];
  /** For project cards: which project and which facet. */
  project?: ProjectId;
  facet?: Facet;
  /** A follow-up phrasing ("how does it work?") answered for the project last discussed. */
  generic?: Facet;
}

export interface GuideKB {
  cards: GuideCard[];
  /** Technologies Oscar lists, for "does he know X?" questions: name, where it appears. */
  skills: { name: string; where: string[] }[];
  email: string;
  projects: { id: ProjectId; title: string; stack: string[] }[];
}

export const MAX_QUESTION = 300;

/** Checks an action against the lists above; anything else is dropped. */
export function isAction(a: unknown): a is GuideAction {
  if (!a || typeof a !== "object") return false;
  const { name, target, label } = a as Record<string, unknown>;
  if (typeof label !== "string") return false;
  if (name === "show_project") return (PROJECT_IDS as readonly unknown[]).includes(target);
  if (name === "show_section") return (SECTIONS as readonly unknown[]).includes(target);
  return false;
}

/**
 * Links the panel will render as links: this site, Oscar's email, and the hosts his own content links to. Anything
 * else in an answer stays plain text.
 */
export const LINK_HOSTS = [
  "github.com",
  "www.linkedin.com",
  "www.instagram.com",
  "www.threads.com",
  "chromewebstore.google.com",
  "oscar-man-shrestha.github.io",
] as const;
