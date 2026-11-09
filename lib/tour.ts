// The 60-second tour: OMS-mini (the small figure of Oscar) walks a visitor through the evidence on the home page,
// one stop per section. Every line is written from the same data the page renders (lib/content and the live
// GitHub data), and keeps the projects' own caveats, so the tour can't say anything the site doesn't.
import { links, person, projects, stack } from "./content";
import { summarise } from "./contrib";
import type { GitHubData } from "./github";
import type { ProjectId } from "./guide";

export type TourStep = {
  id: string;
  /** Short label for the progress rail ("Baton Pass", "GitHub"). */
  label: string;
  /** What OMS-mini says (**bold** is the only markup). */
  text: string;
  /** How the page gets there: a section id, a project on the mission wheel, or any element (CSS selector). */
  go: { section: string } | { project: ProjectId } | { selector: string };
  /** The element the spotlight frames once the page has arrived. */
  spot: string;
};

const list = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const noDot = (s: string) => s.replace(/\.\s*$/, "");

export function buildTour(gh: Pick<GitHubData, "days" | "pullRequests">): TourStep[] {
  const c = summarise(gh.days);
  const merged = gh.pullRequests.filter((p) => p.status.kind === "merged");
  const planned = gh.pullRequests.filter((p) => p.status.kind === "planned");
  const repo = (r: string) => r.split("/")[1];
  const fact = (id: string, k: string) => projects.find((p) => p.id === id)?.page.facts.find((f) => f.k === k)?.v;

  const projectLine = (p: (typeof projects)[number]): string => {
    switch (p.id) {
      case "baton": {
        const tests = p.stats?.find((s) => /tests/.test(s.label))?.value;
        const handoffs = p.stats?.find((s) => /hand-offs/.test(s.label))?.value;
        return `**${p.title}**: a Chrome extension that carries a whole AI conversation to another assistant, on the Chrome Web Store.${handoffs ? ` ${handoffs} real hand-offs continued the work` : ""}${tests ? `, with ${tests} automated tests behind it.` : "."}`;
      }
      case "raksha":
        return `**${p.title}**: ${lower(noDot(p.description))}. Built on ${fact("raksha", "Controller") ?? "an ESP32"}.`;
      default:
        return `**${p.title}**: ${lower(noDot(p.description))}.${p.page.caveat ? ` ${p.page.caveat}` : ""}`;
    }
  };

  const oss =
    merged.length || planned.length
      ? [
          merged.length ? `${list(merged.map((p) => `**${repo(p.repo)}**`))} merged ${merged.length === 1 ? "his fix" : "his fixes"}` : "",
          planned.length ? `${list(planned.map((p) => `**${repo(p.repo)}**`))} ${planned.length === 1 ? "has his PR" : "have his PRs"} lined up to merge` : "",
        ].filter(Boolean).join("; ") + "."
      : "Pull requests to other people's libraries, listed here once they're merged or lined up to merge.";

  const langs = stack.find((s) => s.slot === "Languages")?.items.slice(0, 5) ?? [];
  const ml = stack.find((s) => s.slot === "ML / Data")?.items.slice(0, 4) ?? [];
  const github = links.find((l) => l.label === "GitHub")?.url;

  return [
    {
      id: "hello", label: "Hello", go: { section: "top" }, spot: ".hero__title",
      text: `Hi! I'm **OMS-mini**, a tiny Oscar. Here's **${person.name}** in about a minute: a ${lower(person.role)} working across ${list(person.disciplines.map(lower))}, based in ${person.base.replace(", IN", "")}.`,
    },
    ...projects.map((p): TourStep => ({
      id: p.id, label: p.title, go: { project: p.id as ProjectId }, spot: `#m-${p.id}`,
      text: projectLine(p),
    })),
    {
      id: "activity", label: "GitHub", go: { selector: ".activity__grid" }, spot: ".activity__grid",
      text: `Live from GitHub: **${c.total.toLocaleString("en-US")} contributions** in the last 12 months, on ${c.active} of ${c.span} days. Longest streak: ${c.longest} days.`,
    },
    { id: "oss", label: "Open source", go: { selector: ".patches" }, spot: ".patches", text: `Open source, also live: ${oss}` },
    {
      id: "stack", label: "Stack", go: { selector: ".slots" }, spot: ".slots",
      text: `His loadout: ${list(langs)}, and for ML ${list(ml)}. Eight slots in all, from databases to security tools.`,
    },
    {
      id: "contact", label: "Contact", go: { section: "contact" }, spot: ".contact__mail",
      text: `That's the tour. A new mission for Oscar? Brief him: **${person.email}**${github ? ", or look through his GitHub" : ""}. Or ask me anything about Oscar.`,
    },
  ];
}
