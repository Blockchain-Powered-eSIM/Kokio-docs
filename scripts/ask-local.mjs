/**
 * Asks a question locally, without deploying.
 *
 *   npm run build                       # writes static/llms-full.txt
 *   node --env-file=.env.local scripts/ask-local.mjs "how do passkeys work"
 *
 * Reads the docs off disk, so it tests the ranking and the model call without
 * needing the site to be live. Pass --url <origin> to read a deployment
 * instead, which is how to tell a broken deployment from broken code.
 */

import { answerQuestion, resetCache } from "../lib/docs-answer.mjs";

const args = process.argv.slice(2);
const rest = [];
let origin = null;

// Accepts --url https://site, --url=https://site, or a bare https://site.
for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === "--url") origin = args[++i];
  else if (arg.startsWith("--url=")) origin = arg.slice("--url=".length);
  else if (/^https?:\/\//.test(arg)) origin = arg;
  else rest.push(arg);
}

const question = rest.join(" ");

if (!question) {
  console.error('usage: node scripts/ask-local.mjs "your question" [--url https://site]');
  process.exit(1);
}

if (origin) {
  let host;
  try {
    const parsed = new URL(origin);
    origin = parsed.origin;
    host = parsed.hostname;
  } catch {
    host = null;
  }
  // "https://https" parses fine and then fails at DNS, which is what a shell
  // leaves behind when it swallows part of a pasted address.
  if (!host || (!host.includes(".") && host !== "localhost")) {
    console.error(`not a usable address: ${process.argv.slice(2).join(" ")}`);
    console.error("paste the deployment address in quotes, as in:");
    console.error('  node scripts/ask-local.mjs "your question" --url "https://my-site.vercel.app"');
    process.exit(1);
  }
}

const realFetch = globalThis.fetch;

/** Fetches the docs from a deployment, and says what came back. */
async function fetchImpl(url, options) {
  if (!String(url).endsWith("/llms-full.txt")) return realFetch(url, options);

  const target = `${origin}/llms-full.txt`;
  let response;
  try {
    response = await realFetch(target, { redirect: "manual" });
  } catch (error) {
    console.error(`could not reach ${target}: ${error.cause?.code ?? error.message}`);
    process.exit(1);
  }

  const body = await response.text();
  console.log(
    `${target}: ${response.status}, ${body.length} chars, ` +
      `${response.headers.get("content-type")}`
  );

  const location = response.headers.get("location");
  if (location?.includes("sso-api")) {
    console.error("\nthis deployment is behind Vercel protection, so nothing can read it.");
    console.error("turn protection off for previews, or test against production.");
    process.exit(1);
  }
  if (location) console.log(`redirects to: ${location.slice(0, 120)}`);

  return { ok: response.ok, status: response.status, text: async () => body };
}

resetCache();

const key = process.env.GEMINI_API_KEY;
if (key) {
  console.log(`key: set, ${key.length} chars`);
} else {
  console.log("key: missing, so pages will come back with no answer.");
  console.log("  node --env-file=<file> scripts/ask-local.mjs ...");
  console.log("  the flag goes before the script path, and the file needs a");
  console.log("  plain GEMINI_API_KEY=... line with no 'export' in front of it.");
}

let result;
try {
  result = await answerQuestion(question, {
    apiKey: key,
    fetchImpl,
    // With no address given, read the copy on disk, same as a deployment does.
    ...(origin && { readImpl: async () => null }),
  });
} catch (error) {
  console.error(`\nfailed: ${error.message}`);
  process.exit(1);
}

console.log(`\npages: ${result.sources.map((s) => s.url).join(", ") || "none"}`);
console.log(`degraded: ${result.degraded ?? "no"}`);
if (result.detail) console.log(`reason: ${result.detail}`);
console.log(`\n${result.answer ?? "(no answer)"}`);
