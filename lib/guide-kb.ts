// OMS-mini's knowledge: every answer card is written from the same data the page renders (lib/content,
// lib/contrib), so the guide can only say what the site says. Built on the server and passed to the panel as props.
import { fmtDay, fmtMonth, summarise } from "./contrib";
import { links, person, projects, stack } from "./content";
import type { GitHubData } from "./github";
import { PROJECT_IDS, SECTION_LABELS, type GuideAction, type GuideCard, type GuideKB, type ProjectId, type SectionId } from "./guide";

const contentIds = projects.map((p) => p.id).sort().join(",");
if (contentIds !== [...PROJECT_IDS].sort().join(",")) throw new Error(`Guide PROJECT_IDS (${PROJECT_IDS}) differ from lib/content (${contentIds})`);

const list = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const noDot = (s: string) => s.replace(/\.\s*$/, "");
const show = (target: SectionId): GuideAction => ({ name: "show_section", target, label: SECTION_LABELS[target] });
const shown = links.filter((l) => l.url);
const link = (label: string) => shown.find((l) => l.label === label);
const contactLine = `email **${person.email}**, or find him on ${list(shown.map((l) => `[${l.label}](${l.url})`))}`;

// one short phrase per project, from its description
const SHORT: Record<ProjectId, string> = {
  baton: "a Chrome extension that carries a whole AI conversation to another assistant",
  malware: "a Markov-chain classifier for fingerprinting malware",
  raksha: "a bench safety node for informal workshops",
  eval: "research on whether next-item metrics in educational logs measure learning or just repetition",
};
// extra ways visitors may name each project
const ALIASES: Record<ProjectId, { q: string[]; keys: string[]; main: string[] }> = {
  baton: {
    q: ["the Chrome extension", "his browser extension", "moving a chat to another AI", "AI conversation hand-off", "continue a ChatGPT chat in Claude"],
    keys: ["baton", "chrome", "extension", "handoff", "hand-off"],
    main: ["Works with", "Automated tests", "Privacy"],
  },
  malware: {
    q: ["his security work", "show me his security work", "the malware classifier", "the Markov chain project", "cybersecurity project", "malware detection"],
    keys: ["malware", "fingerprint", "markov", "security", "cyber"],
    main: ["Feature space", "Status"],
  },
  raksha: {
    q: ["the IoT project", "the ESP32 project", "his hardware project", "workshop safety device", "sensor project", "embedded systems work"],
    keys: ["raksha", "esp32", "iot", "hardware", "sensor", "workshop", "embedded", "arduino"],
    main: ["Controller", "Sensors", "Process air"],
  },
  eval: {
    q: ["his research project", "the education research", "learning analytics research", "next-item prediction research", "the evaluation study"],
    keys: ["eval", "validity", "research", "education", "educational", "edtech"],
    main: ["Datasets", "Status", "Contribution"],
  },
};

function projectCards(): GuideCard[] {
  const cards: GuideCard[] = [];
  projects.forEach((p, i) => {
    const id = p.id as ProjectId, al = ALIASES[id];
    const action: GuideAction = { name: "show_project", target: id, label: `the ${p.title} card` };
    const other = projects[(i + 1) % projects.length].title;
    const links = [`[Project page and demo](/work/${id})`, `[Source on GitHub](${p.url})`, ...(p.page.extraLinks ?? []).map((l) => `[${l.label}](${l.url})`)].join(" · ");
    const caveat = p.page.caveat ? `\n\n${p.page.caveat}` : "";
    const facts = p.page.facts.filter((f) => al.main.includes(f.k));
    cards.push({
      id, project: id, facet: "main", action, keys: al.keys,
      q: [p.title, `tell me about ${p.title}`, `what is ${p.title}`, `what does ${p.title} do`, ...(p.title.includes(" ") ? [`what is ${p.title.split(" ")[0]}`] : []), ...al.q],
      a: `**${p.title}**: ${p.description} ${p.page.tagline}\n\n${facts.map((f) => `- ${f.k}: ${f.v}`).join("\n")}${caveat}\n\n${links}`,
      next: [`How does ${p.title} work?`, `What is ${p.title} built with?`, `Tell me about ${other}`],
    });
    cards.push({
      id: `${id}:how`, project: id, facet: "how", action, keys: al.keys,
      q: [`how does ${p.title} work`, `explain ${p.title}`, `${p.title} in detail`, `walk me through ${p.title}`],
      a: `How **${p.title}** works:\n\n${p.page.how.map((h) => `- ${h}`).join("\n")}${caveat}`,
      next: [`What is ${p.title} built with?`, `${p.title} links`, `Tell me about ${other}`],
    });
    cards.push({
      id: `${id}:stack`, project: id, facet: "stack", action, keys: al.keys,
      q: [`what is ${p.title} built with`, `${p.title} tech stack`, `what technologies does ${p.title} use`, `what language is ${p.title} written in`],
      a: `**${p.title}** is built with ${list(p.page.stack)}.`,
      next: [`How does ${p.title} work?`, `${p.title} links`, "What are his skills?"],
    });
    cards.push({
      id: `${id}:facts`, project: id, facet: "facts", action, keys: al.keys,
      q: [`${p.title} results`, `how well does ${p.title} work`, `${p.title} accuracy`, `${p.title} numbers`, `status of ${p.title}`, ...(id === "eval" ? ["which datasets did he use", "what data does the research use"] : [])],
      a: `**${p.title}**, by the numbers and facts on its page:\n\n${p.page.facts.map((f) => `- ${f.k}: ${f.v}`).join("\n")}${p.stats ? `\n- On the card: ${p.stats.map((s) => `${s.value} ${s.label}`).join("; ")}` : ""}${caveat}`,
      next: [`How does ${p.title} work?`, `${p.title} links`, `Tell me about ${other}`],
    });
    cards.push({
      id: `${id}:links`, project: id, facet: "links", action, keys: al.keys,
      q: [`${p.title} links`, `${p.title} source code`, `${p.title} demo`, `where can I try ${p.title}`, `${p.title} on GitHub`],
      a: `${links}\n\nThe project page has a short interactive demo.`,
      next: [`How does ${p.title} work?`, `Tell me about ${other}`, "How can I contact him?"],
    });
  });
  return cards;
}

// follow-ups that refer to the project last discussed ("how does it work?")
const GENERIC: GuideCard[] = [
  { id: "it:how", generic: "how", a: "", q: ["how does it work", "how does that work", "explain it", "how did he build it", "walk me through it"] },
  { id: "it:stack", generic: "stack", a: "", q: ["what is it built with", "what tech does it use", "which language is it written in", "what stack", "what technologies"] },
  { id: "it:facts", generic: "facts", a: "", q: ["does it work", "what are the results", "is it finished", "how accurate is it", "tell me more", "more details"] },
  { id: "it:links", generic: "links", a: "", q: ["where is the code", "source code", "can I try it", "is there a demo", "link to it", "github repo"] },
];

export function buildKB(gh: Pick<GitHubData, "days" | "pullRequests" | "releases">): GuideKB {
  const { pullRequests } = gh;
  const contrib = summarise(gh.days);
  const byId = Object.fromEntries(projects.map((p) => [p.id, p])) as Record<ProjectId, (typeof projects)[number]>;
  const repos = list(pullRequests.map((pr) => pr.repo.split("/")[1]));
  const cards: GuideCard[] = [
    {
      id: "overview", action: show("work"),
      q: ["who is Oscar", "tell me about Oscar", "what does Oscar do", "what does he build", "what does he work on", "who is this guy", "introduce him", "what kind of engineer is he", "what does he specialise in", "give me a summary", "about him"],
      a: `**${person.name}** is a ${lower(person.role)} working across ${list(person.disciplines.map((d) => (d === "Web" ? "the web" : lower(d))))}, based in ${person.base}. On this site: ${list(PROJECT_IDS.map((id) => `**${byId[id].title}** (${SHORT[id]})`))}, plus open-source pull requests to ${repos}.`,
      next: ["Show me his security work", "What has he contributed to open source?", "What are his skills?"],
    },
    {
      id: "projects", action: show("work"),
      q: ["what projects has he done", "list his projects", "show me his work", "his portfolio", "selected work", "what has he built", "all projects"],
      a: `Four projects, each with its own page and a short interactive demo:\n\n${PROJECT_IDS.map((id) => `- **${byId[id].title}**: ${byId[id].description}`).join("\n")}`,
      next: PROJECT_IDS.map((id) => `Tell me about ${byId[id].title}`),
    },
    {
      id: "best", action: { name: "show_project", target: "baton", label: "the Baton Pass card" },
      q: ["which project should I look at first", "what is his best project", "most impressive project", "favourite project", "where should I start", "flagship project"],
      a: `They cover different ground: ${list(PROJECT_IDS.map((id) => `**${byId[id].title}** is ${SHORT[id]}`))}. If you want something you can install today, start with **Baton Pass**: it's on the Chrome Web Store and has 357 automated tests.`,
      next: ["Tell me about Baton Pass", "Show me his security work", "What are his skills?"],
    },
    {
      id: "ml", action: show("work"), keys: ["ml", "machine", "ai", "pytorch", "data"],
      q: ["machine learning work", "ML projects", "AI projects", "data science work", "deep learning", "does he do machine learning"],
      a: `His machine-learning work: **Malware Fingerprint**, ${noDot(lower(byId.malware.description))}, and **Eval Validity**, ${noDot(lower(byId.eval.description))}. **Baton Pass** also ranks on the device with ONNX Runtime.${byId.malware.page.caveat ? ` ${byId.malware.page.caveat}` : ""}`,
      next: ["Tell me about Malware Fingerprint", "Tell me about Eval Validity", "What are his skills?"],
    },
    {
      id: "web", action: { name: "show_project", target: "baton", label: "the Baton Pass card" }, keys: ["web", "frontend", "react", "javascript", "typescript"],
      q: ["web projects", "frontend work", "web development experience", "does he do web dev", "full stack work"],
      a: `**Baton Pass** is a Chrome extension built with ${list(byId.baton.page.stack.slice(0, 3))}. His Loadout lists ${list([...(stack.find((s) => s.slot === "Frontend & mobile")?.items ?? []), ...(stack.find((s) => s.slot === "Backend")?.items ?? [])])}.`,
      next: ["Tell me about Baton Pass", "How was this site built?", "What are his skills?"],
    },
    {
      id: "oss", action: show("oss"), keys: ["opensource", "pr", "prs", "pull", "upstream", "merged"], names: pullRequests.map((pr) => pr.repo.split("/")[1]),
      q: ["has he contributed to open source", "open-source contributions", "his pull requests", "which libraries has he contributed to", "upstream fixes", "has any of his code been merged", "which projects merged his code", "his contributions to other projects"],
      a: `${pullRequests.length} pull requests, each merged or lined up by the maintainers:\n\n${pullRequests.map((pr) => `- **${pr.title}** in ${pr.repo} ([#${pr.number}](${pr.url})): ${pr.status.detail}`).join("\n")}`,
      next: ["How active is he on GitHub?", "What are his skills?", "How can I contact him?"],
    },
    {
      id: "skills", action: show("oss"), keys: ["skill", "skills", "stack", "loadout", "languages", "tools", "technologies"],
      q: ["what are his skills", "tech stack", "what languages does he know", "programming languages", "what tools does he use", "his loadout", "technologies he knows"],
      a: `His Loadout:\n\n${stack.map((s) => `- **${s.slot}**: ${list(s.items)}`).join("\n")}`,
      next: ["Does he know Python?", "Show me his security work", "What has he contributed to open source?"],
    },
    {
      id: "activity", action: show("activity"), keys: ["github", "activity", "commits", "streak", "contributions"],
      q: ["how active is he on GitHub", "GitHub activity", "how many contributions", "his commit history", "contribution graph", "longest streak"],
      a: `From ${fmtDay(contrib.from)} to ${fmtDay(contrib.to)}: **${contrib.total.toLocaleString("en-US")} contributions** on GitHub, on ${contrib.active} of ${contrib.span} days. Longest streak: ${contrib.longest} days. Best day: ${contrib.best.count} contributions on ${fmtDay(contrib.best.date)}. Busiest month: ${fmtMonth(contrib.bestMonth)}, with ${contrib.bestMonthCount}.`,
      next: ["What has he contributed to open source?", "What are his skills?", "How can I contact him?"],
    },
    {
      id: "contact", action: show("contact"), keys: ["contact", "email", "mail", "reach", "linkedin", "instagram", "threads", "touch"],
      q: ["how can I contact him", "what is his email", "how do I reach him", "get in touch", "his LinkedIn", "social media", "his GitHub profile"],
      a: `You can ${contactLine}.`,
      next: ["Is he available for work?", "Where is he based?", "What does Oscar build?"],
    },
    {
      id: "hire", action: show("contact"), keys: ["hire", "hiring", "job", "available", "availability", "freelance", "internship", "opportunity"],
      q: ["is he available for work", "can I hire him", "is he looking for a job", "is he open to opportunities", "freelance work", "internship"],
      a: `This site doesn't say whether he's available, so the best way to find out is to ask him: **${person.email}**${link("LinkedIn") ? `, or [LinkedIn](${link("LinkedIn")!.url})` : ""}.`,
      next: ["What does Oscar build?", "What are his skills?", "Where is he based?"],
    },
    {
      id: "location", action: show("profile"), keys: ["based", "location", "live", "city", "timezone"],
      q: ["where is he based", "where does he live", "which city", "his location", "what time zone is he in"],
      a: `He's based in ${person.base}, in the ${person.timeZone} time zone.`,
      next: ["How can I contact him?", "What does he do for fun?", "What does Oscar build?"],
    },
    {
      id: "hobbies", action: show("profile"), keys: ["hobby", "hobbies", "fun", "guitar", "karate", "skateboarding", "skateboard"],
      q: ["what are his hobbies", "what does he do for fun", "interests outside work", "off the clock", "does he play guitar", "does he do karate", "does he skateboard"],
      a: `Off the clock: ${list(person.offClock.map(lower))}.`,
      next: ["What does Oscar build?", "Where is he based?", "How can I contact him?"],
    },
    {
      id: "site", action: show("top"), keys: ["site", "website", "portfolio", "flow", "video", "videos", "film", "three", "gsap", "nextjs"],
      q: ["how was this site built", "what is this website built with", "the tech behind this site", "how did he make this portfolio", "are the videos AI generated", "the intro film", "is the portrait real"],
      a: "Oscar designed and built this site himself: the 3D scenes, the scroll animations and OMS-mini all run in your browser. The intro film, the hero portrait animation, the profile turntable and the project films were generated with AI video from his own photos.",
      next: ["What are you?", "What does Oscar build?", "What are his skills?"],
    },
    {
      id: "bot", keys: ["bot", "ai", "chatgpt", "gpt", "model", "oms-mini", "omsmini"],
      q: ["who are you", "what are you", "are you an AI", "are you a bot", "how do you work", "is this Oscar", "am I talking to Oscar", "are you ChatGPT"],
      a: "I'm OMS-mini, the small model built into this site. A small pretrained language model (23 MB) runs in your browser to understand your question, and every answer is written from the facts on this site, so I can't make things up about Oscar. I'm not Oscar, and nothing you type leaves your device.",
      next: ["What does Oscar build?", "How was this site built?", "How can I contact him?"],
    },
    {
      id: "unknown", action: show("contact"), keys: ["education", "university", "college", "degree", "study", "school", "salary", "earn", "pay", "age", "old", "phone", "resume", "cv", "employer", "experience"],
      q: ["where did he study", "what is his education", "which university", "what degree does he have", "his work experience", "previous jobs", "who does he work for", "his salary", "how much does he earn", "how old is he", "his phone number", "can I see his resume"],
      a: `That isn't on this site, so I can't tell you. Oscar can: **${person.email}**.`,
      next: ["What does Oscar build?", "What are his skills?", "How can I contact him?"],
    },
    {
      id: "hello", keys: ["hi", "hello", "hey", "yo", "hiya"],
      q: ["hi", "hello", "hey there", "good morning", "good evening", "yo"],
      a: "Hi! I'm OMS-mini, a small model running in your browser. Ask me about Oscar's projects, skills or open-source work, or how to reach him.",
      next: ["What does Oscar build?", "Show me his security work", "How can I contact him?"],
    },
    {
      id: "thanks", keys: ["thanks", "thank", "cheers", "thx"],
      q: ["thanks", "thank you", "cheers", "great, thanks", "that helps"],
      a: "Any time. Anything else you'd like to see?",
      next: ["What does Oscar build?", "What are his skills?", "How can I contact him?"],
    },
    ...projectCards(),
    ...GENERIC,
  ];
  // "does he know X?": every technology he lists, with where it appears
  const where = new Map<string, Set<string>>();
  const add = (name: string, w: string) => { const k = name.trim(); if (!where.has(k)) where.set(k, new Set()); where.get(k)!.add(w); };
  for (const s of stack) for (const it of s.items) add(it, `his Loadout (${s.slot})`);
  for (const p of projects) for (const it of p.page.stack) add(it.replace(/\s*\(.*\)$/, ""), p.title);
  return {
    cards,
    skills: [...where].map(([name, w]) => ({ name, where: [...w] })),
    email: person.email,
    projects: projects.map((p) => ({ id: p.id as ProjectId, title: p.title, stack: p.page.stack })),
  };
}
