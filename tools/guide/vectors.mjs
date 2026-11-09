// Works out OMS-mini's example-question vectors ahead of time and saves them to public/guide/vectors.json,
// so a visitor's first open of the guide only has to load the model. Run it after changing lib/content or
// lib/guide-kb (the guide still works without it: it notices the file is out of date and computes them itself).
//
//   npx next build && npx next start -p 4500      (in another terminal)
//   node tools/guide/vectors.mjs http://localhost:4500
//
// It opens the page in a headless Chrome-family browser (set CHROME to its binary if it isn't found), lets the guide
// load its model exactly as a visitor's browser does, and copies the vectors the guide stored. Nothing is downloaded.
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const site = (process.argv[2] ?? "http://localhost:4500").replace(/\/$/, "");
const out = join(dirname(fileURLToPath(import.meta.url)), "../../public/guide/vectors.json");
const browser = [
  process.env.CHROME,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].find((p) => p && existsSync(p));
if (!browser) throw new Error("No Chrome-family browser found; set CHROME to its binary.");

const port = 9600 + Math.floor(Math.random() * 300);
const profile = mkdtempSync(join(tmpdir(), "guide-vectors-"));
const proc = spawn(browser, ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--no-first-run", "about:blank"], { stdio: "ignore" });
const cleanup = () => { try { proc.kill("SIGKILL"); } catch {} try { rmSync(profile, { recursive: true, force: true }); } catch {} };
process.on("exit", cleanup);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let wsUrl;
for (let i = 0; i < 80 && !wsUrl; i++) {
  try { wsUrl = (await (await fetch(`http://127.0.0.1:${port}/json/version`)).json()).webSocketDebuggerUrl; } catch { await sleep(250); }
}
if (!wsUrl) throw new Error("The browser didn't start.");
const ws = new WebSocket(wsUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pending = new Map();
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pending.has(d.id)) { const { res, rej } = pending.get(d.id); pending.delete(d.id); d.error ? rej(new Error(d.error.message)) : res(d.result); }
};
const send = (method, params = {}, sessionId) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params, sessionId })); });
const { targetId } = await send("Target.createTarget", { url: "about:blank" });
const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
const ev = async (expression) => (await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }, sessionId)).result?.value;
const waitFor = async (expr, ms) => { for (let t = 0; t < ms; t += 250) { if (await ev(expr)) return true; await sleep(250); } return false; };

await send("Page.navigate", { url: `${site}/?skip` }, sessionId);
if (!(await waitFor("!!window.__omsGuide && !!document.querySelector('.guide__pet')", 30000))) throw new Error(`OMS-mini didn't appear on ${site}.`);
// the shipped file would be reused as it is; ignore it so the vectors always come from the current questions
await send("Fetch.enable", { patterns: [{ urlPattern: "*/guide/vectors.json*" }] }, sessionId);
ws.addEventListener("message", (m) => {
  const d = JSON.parse(m.data);
  if (d.method === "Fetch.requestPaused") send("Fetch.fulfillRequest", { requestId: d.params.requestId, responseCode: 404, body: "" }, sessionId);
});
await ev(`document.querySelector(".guide__pet").click()`);
process.stdout.write("Loading the model and working out the vectors");
const t0 = Date.now();
for (;;) {
  const phase = await ev("window.__omsGuide.model().phase");
  if (phase === "ready") break;
  if (phase === "keywords") throw new Error("The model didn't load (see the browser console on the site).");
  if (Date.now() - t0 > 300000) throw new Error("Timed out after five minutes.");
  process.stdout.write(".");
  await sleep(2000);
}
const stored = await ev(`localStorage.getItem("oms.guide.vectors")`);
const j = JSON.parse(stored ?? "null");
if (!j?.key || !j.scales?.length) throw new Error("The guide didn't store any vectors.");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(j));
console.log(`\nSaved ${j.scales.length} vectors (key ${j.key}, ${Math.round(stored.length / 1024)} KB) to public/guide/vectors.json in ${((Date.now() - t0) / 1000).toFixed(0)} s.`);
ws.close();
process.exit(0);
