/**
 * POST /api/ask, the endpoint behind the search box.
 *
 * Takes a question, returns an answer written from the docs plus the pages it
 * came from. When the model cannot answer, the pages still come back, so the
 * box degrades into plain search rather than into an error.
 *
 * The response never carries the reason. It can name the key or the model, so
 * it goes to the logs instead.
 *
 * Every question is also posted to Discord when `DISCORD_WEBHOOK_URL` is set,
 * which is how gaps in the docs get noticed.
 */

import { answerQuestion, MAX_QUESTION_LENGTH } from "../lib/docs-answer.mjs";

const WINDOW_MS = 60 * 1000;

/** Long enough for Discord on a bad day, short enough to never matter. */
const NOTIFY_TIMEOUT_MS = 1500;

/** Discord refuses a message over 2000 characters. */
const DISCORD_MAX_CHARS = 1990;

/** Per reader, and for everyone this instance is serving. */
const MAX_PER_ADDRESS = 8;
const MAX_PER_INSTANCE = 60;

const recent = new Map();
let instanceHits = [];
let warnedNoWebhook = false;

/**
 * Requests per address, kept in memory.
 *
 * Serverless spreads traffic across instances, so this slows one impatient
 * reader rather than a determined attacker. The instance cap below is the
 * cost stop, and the model's own daily quota is the one behind that.
 */
function overLimit(address, now) {
  instanceHits = instanceHits.filter((at) => now - at < WINDOW_MS);
  instanceHits.push(now);
  if (instanceHits.length > MAX_PER_INSTANCE) return "instance";

  const seen = (recent.get(address) ?? []).filter((at) => now - at < WINDOW_MS);
  seen.push(now);
  recent.set(address, seen);
  // Addresses stop arriving but never leave, so drop the lot now and then.
  if (recent.size > 5000) recent.clear();

  return seen.length > MAX_PER_ADDRESS ? "address" : null;
}

/**
 * Rejects a browser on another site posting here.
 *
 * A request with no Origin, such as curl or a test script, is allowed: the
 * header only proves where a browser came from, and blocking its absence
 * stops honest tools without stopping anyone else.
 */
function fromAnotherSite(request) {
  const origin = request.headers.origin;
  if (!origin) return false;
  try {
    return new URL(origin).host !== request.headers.host;
  } catch {
    return true;
  }
}

/**
 * Posts what was asked and what came back to a Discord channel.
 *
 * Sent after the reader has their answer, so a slow or broken webhook costs
 * them nothing. Failures are logged and go no further: a missed notification
 * is not worth turning into a failed search.
 */
async function notify(question, { answer, sources, degraded }) {
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url) {
    // Once per instance. Silence here is indistinguishable from a webhook that
    // is set but refused, and both look the same from the channel.
    if (!warnedNoWebhook) {
      warnedNoWebhook = true;
      console.error("discord notify skipped: DISCORD_WEBHOOK_URL is not set");
    }
    return;
  }

  const pages = sources.map((source) => source.url).join(", ") || "none";
  const outcome = answer ? "answered" : (degraded ?? "no match");
  const content = `**Q:** ${question}\n\`${outcome}\` · ${pages}\n${answer ?? ""}`;

  try {
    const posted = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        content: content.slice(0, DISCORD_MAX_CHARS),
        // The question is whatever a reader typed, so it must not be able to
        // ping the server.
        allowed_mentions: { parse: [] },
      }),
      signal: AbortSignal.timeout(NOTIFY_TIMEOUT_MS),
    });
    // A deleted or mistyped webhook answers 401 or 404 rather than throwing,
    // so without this the channel just stays empty.
    if (!posted.ok) {
      console.error(`discord notify rejected: ${posted.status} ${await posted.text()}`);
    }
  } catch (error) {
    console.error("discord notify failed:", error.message);
  }
}

function send(response, status, body) {
  response.status(status);
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.setHeader("cache-control", "no-store");
  response.end(JSON.stringify(body));
}

export default async function handler(request, response) {
  if (request.method !== "POST") return send(response, 405, { error: "use POST" });
  if (fromAnotherSite(request)) return send(response, 403, { error: "wrong origin" });

  const type = request.headers["content-type"] ?? "";
  if (!type.includes("application/json")) {
    return send(response, 415, { error: "send JSON" });
  }

  const address =
    request.headers["x-forwarded-for"]?.split(",")[0]?.trim() ?? "unknown";
  const limit = overLimit(address, Date.now());
  if (limit) {
    if (limit === "instance") console.error("ask: instance rate limit hit");
    return send(response, 429, { error: "rate_limited" });
  }

  let question = "";
  try {
    const body =
      typeof request.body === "string" ? JSON.parse(request.body) : request.body;
    question = String(body?.question ?? "").trim();
  } catch {
    return send(response, 400, { error: "body must be JSON" });
  }

  if (!question) return send(response, 400, { error: "question is required" });
  if (question.length > MAX_QUESTION_LENGTH) {
    return send(response, 400, { error: "question is too long" });
  }

  try {
    const { answer, sources, degraded, detail, cached } = await answerQuestion(question, {
      apiKey: process.env.GEMINI_API_KEY,
    });
    if (detail) console.error("ask:", degraded ?? "answered", detail);

    send(response, 200, { answer, sources, degraded });
    // A repeat inside the cache window was posted the first time it was asked.
    if (!cached) await notify(question, { answer, sources, degraded });
    return;
  } catch (error) {
    console.error("ask failed:", error);
    return send(response, 500, { error: "could not answer" });
  }
}
