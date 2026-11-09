// Runs the parts of Baton that decide what a hand-off carries, on a chat a visitor gives the Baton project page:
//  - the evidence: the same steps as Baton's updateBrief (src/core/brief.ts): key findings from the last reply,
//    chosen by selectEvidence against the goal and the last request, then the best point of each earlier reply;
//  - the topic: Baton's trained topic layer on the MiniLM embedding of the request (entrypoints/offscreen).
// Baton also redacts secrets, drops hand-off requests and tracks decisions; those steps aren't shown here.
import { encode } from "gpt-tokenizer";
import { classify, embed, parseVocab, type TopicHead } from "./embed";
import { selectEvidence } from "./extractive";
import head from "./topic-head.json";
import type { Runtime } from "../minilm";

export type Turn = { role: "user" | "assistant"; text: string };
export const TOPIC_NAMES: Record<string, string> = { code: "Code", research: "Research", news: "Current events", writing: "Writing", math: "Maths & reasoning", image: "Images", general: "General" };

export function evidence(turns: Turn[]) {
  const users = turns.filter((t) => t.role === "user");
  const lastUser = users.at(-1), lastAssistant = [...turns].reverse().find((t) => t.role === "assistant");
  const goal = (users[0]?.text ?? "").slice(0, 300);
  const assistantIsLatest = turns.at(-1)?.role === "assistant";
  const findings = assistantIsLatest ? selectEvidence(lastAssistant?.text || "", `${goal} ${lastUser?.text || ""}`) : [];
  const query = `${goal} ${users.map((u) => u.text.replace(/\s+/g, " ").trim()).join(" ")}`;
  const earlier: string[] = [];
  let spent = 0;
  for (const turn of turns.filter((t) => t.role === "assistant" && t !== lastAssistant).reverse()) {
    const point = selectEvidence(turn.text, query, 90)[0];
    if (!point || earlier.includes(point)) continue;
    const tokens = encode(point).length;
    if (spent + tokens > 600) break;
    earlier.push(point); spent += tokens;
  }
  const tokens = findings.reduce((s, f) => s + encode(f).length, 0);
  return { goal, findings, findingsTokens: tokens, earlier };
}

export async function topic(text: string, rt: Runtime) {
  const vector = await embed(text, parseVocab(rt.vocabText), { Tensor: rt.ort.Tensor as never, session: rt.session as never });
  return classify(vector, head as TopicHead);
}

/** "User: …" / "Assistant: …" lines (also You/AI/ChatGPT/Claude/Gemini) into turns. */
export function parseChat(text: string): Turn[] {
  const turns: Turn[] = [];
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*(user|you|me|human|assistant|ai|chatgpt|claude|gemini|bot)\s*:\s*(.*)$/i);
    if (m) turns.push({ role: /^(user|you|me|human)$/i.test(m[1]) ? "user" : "assistant", text: m[2] });
    else if (turns.length) turns[turns.length - 1].text += "\n" + line;
  }
  return turns.map((t) => ({ ...t, text: t.text.trim() })).filter((t) => t.text);
}
