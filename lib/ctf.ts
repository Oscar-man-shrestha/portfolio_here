// The hidden puzzle (components/Ctf): three stages in the browser console for curious developers. The page's <head>
// carries a Base64 "transmission" (how to decrypt) and the XOR-encrypted flag; the browser only ever gets the flag's
// SHA-256 to check an answer against. (This file is public on GitHub, so the puzzle is a bit of fun, not a secret.)
import { createHash } from "node:crypto";

const FLAG = "flag{press_start_player_two}";
const KEY = "OMS";

/** The flag XOR-ed with the key, as hex. */
export const CTF_CIPHER = Buffer.from([...Buffer.from(FLAG)].map((b, i) => b ^ KEY.charCodeAt(i % KEY.length))).toString("hex");
/** Stage 2's instructions, Base64-encoded. */
export const CTF_TRANSMISSION = Buffer.from(
  `OMS // transmission 02. The flag sits in <meta name="oms:cipher">: hex bytes, XOR-ed with the operator's initials (${KEY}). Decrypt it and submit it with oms.flag("...").`,
).toString("base64");
/** SHA-256 of the flag, so the browser can check an answer without containing it. */
export const CTF_HASH = createHash("sha256").update(FLAG).digest("hex");
