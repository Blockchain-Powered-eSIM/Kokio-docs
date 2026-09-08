/**
 * POST /api/ask, the endpoint behind the search box.
 *
 * Takes a question, returns an answer written from the docs plus the pages it
 * came from. When the model cannot answer, the pages still come back, so the
 * box degrades into plain search rather than into an error.
 *
 * The response never carries the reason. It can name the key or the model, so
 * it goes to the logs instead.
 */

import { answerQuestion, MAX_QUESTION_LENGTH } from "../lib/docs-answer.mjs";

const WINDOW_MS = 60 * 1000;

/** Per reader, and for everyone this instance is serving. */
const MAX_PER_ADDRESS = 8;
const MAX_PER_INSTANCE = 60;

const recent = new Map();
let instanceHits = [];

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
    const { answer, sources, degraded, detail } = await answerQuestion(question, {
      apiKey: process.env.GEMINI_API_KEY,
    });
    if (detail) console.error("ask:", degraded ?? "answered", detail);
    return send(response, 200, { answer, sources, degraded });
  } catch (error) {
    console.error("ask failed:", error);
    return send(response, 500, { error: "could not answer" });
  }
}
