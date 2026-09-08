/**
 * POST /api/ask, the endpoint behind the search box.
 *
 * Takes a question, returns an answer written from the docs plus the pages it
 * came from. When the model cannot answer, the pages still come back, so the
 * box degrades into plain search rather than into an error.
 */

import { answerQuestion, MAX_QUESTION_LENGTH } from "../lib/docs-answer.mjs";

const WINDOW_MS = 60 * 1000;
const MAX_PER_WINDOW = 8;

/**
 * Requests per address, kept in memory.
 *
 * Serverless spreads traffic across instances, so this slows one impatient
 * reader rather than a determined attacker. The real ceiling is the daily
 * quota on the model, which fails closed on its own.
 */
const recent = new Map();

function rateLimited(address, now = Date.now()) {
  const seen = (recent.get(address) ?? []).filter((at) => now - at < WINDOW_MS);
  seen.push(now);
  recent.set(address, seen);
  if (recent.size > 5000) recent.clear();
  return seen.length > MAX_PER_WINDOW;
}

function send(response, status, body) {
  response.status(status);
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.setHeader("cache-control", "no-store");
  response.end(JSON.stringify(body));
}

export default async function handler(request, response) {
  if (request.method !== "POST") return send(response, 405, { error: "use POST" });

  const address =
    request.headers["x-forwarded-for"]?.split(",")[0]?.trim() ?? "unknown";
  if (rateLimited(address)) return send(response, 429, { error: "rate_limited" });

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
    // Why the model refused stays in the logs. It can name the key or the
    // model, and neither belongs in a public response.
    if (detail) console.error("ask degraded:", degraded, detail);
    return send(response, 200, { answer, sources, degraded });
  } catch (error) {
    console.error("ask failed:", error);
    return send(response, 500, { error: "could not answer" });
  }
}
