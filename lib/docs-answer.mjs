/**
 * Answers a question about Kokio from the docs themselves.
 *
 * The docs are already published as one text file at /llms-full.txt, so this
 * reads that rather than keeping a second copy. Ranking picks the few pages
 * most likely to hold the answer, and only those pages are sent to the model.
 *
 * Plain JavaScript so it runs under node with no build step, same as the
 * scripts in `scripts/`.
 */

import { readFile } from "node:fs/promises";

import { SITE_URL } from "../src/siteCopy.mjs";

/**
 * Where to read the docs from when there is no copy on disk.
 *
 * The live site, not the deployment's own address. A preview sits behind
 * Vercel's protection and answers its own requests with a login page, so
 * reading itself is the one thing that cannot work.
 */
function fullTextUrl() {
  return `${SITE_URL}/llms-full.txt`;
}

/**
 * Tried in order. The second is smaller and separately loaded, which is what
 * makes it useful when the first reports high demand.
 */
const MODELS = ["gemini-3.8-flash", "gemini-3.5-flash-lite"];

const RETRY_MS = 600;

function apiUrl(model) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
}

/** How long a fetched copy of the docs is reused before fetching again. */
const CACHE_MS = 60 * 60 * 1000;

/** Pages sent to the model, and how much of each. */
const PAGES_PER_ANSWER = 3;
const CHARS_PER_PAGE = 6000;

export const MAX_QUESTION_LENGTH = 300;

const RULES = `You answer questions about Kokio, a privacy-first travel eSIM app, using only the documentation pages given to you.

Rules:
- Use only the pages provided. If they do not answer the question, say so plainly and stop.
- Never invent contract names, function names, addresses, prices or features.
- Answer in three to six sentences. Short bullet lines starting with "- " are fine for lists.
- Write plain sentences. No markdown headings, no bold, no links, no code fences.
- Do not tell the reader to check the documentation. They are reading it.`;

let cache = { at: 0, sections: null };

/**
 * Splits the published full text into one entry per page.
 *
 * The file writes each page as a `---` rule, then its site path, then the
 * page. Everything before the first rule is the file's own preamble.
 */
export function parseSections(fullText) {
  return fullText
    .split(/\n---\n/)
    .slice(1)
    .map((chunk) => {
      const [pathLine, ...rest] = chunk.split("\n");
      const url = pathLine.replace(/^#\s*/, "").trim();
      const body = rest.join("\n").trim();
      const heading = body.match(/^#\s+(.+)$/m);
      // Headings carry an explicit anchor id that readers never see.
      const title = heading ? heading[1].replace(/\s*\{#.*\}\s*$/, "") : url;
      return { url, title, body };
    })
    .filter((section) => section.url.startsWith("/") && section.body);
}

/**
 * Trims a plural so "wallets" finds "wallet".
 *
 * Crude on purpose. A real stemmer is a dependency, and readers of these docs
 * mostly get plurals wrong, not tenses.
 */
function stem(word) {
  const plural =
    word.length > 3 && word.endsWith("s") && !word.endsWith("ss") && !word.endsWith("us");
  return plural ? word.slice(0, -1) : word;
}

/**
 * Words that carry no subject. Rarity weighting alone does not hold them
 * down, because a title like "How eSIM provisioning works" then scores on
 * "how" and beats the page the reader actually wants.
 */
const IGNORED = new Set([
  "and", "any", "are", "but", "can", "did", "doe", "does", "for", "from",
  "get", "got", "has", "have", "how", "into", "its", "may", "not", "now",
  "off", "one", "our", "out", "own", "print", "say", "see", "she", "that",
  "the", "their", "them", "then", "there", "these", "they", "thi", "this",
  "use", "used", "using", "wa", "was", "what", "when", "where", "which",
  "who", "why", "will", "with", "work", "would", "you", "your",
]);

function words(text) {
  return (text.toLowerCase().match(/[a-z0-9]{3,}/g) ?? [])
    .map(stem)
    .filter((word) => !IGNORED.has(word));
}

/**
 * Ranks pages against a question by weighted word overlap.
 *
 * A word that appears on every page says nothing about which page to pick, so
 * each match is weighted by how rare the word is across the whole set.
 */
export function rankSections(question, sections, limit = PAGES_PER_ANSWER) {
  const asked = [...new Set(words(question))];
  if (asked.length === 0) return [];

  const containing = new Map();
  const counted = sections.map((section) => {
    const counts = new Map();
    for (const word of words(`${section.title} ${section.body}`)) {
      counts.set(word, (counts.get(word) ?? 0) + 1);
    }
    for (const word of counts.keys()) {
      containing.set(word, (containing.get(word) ?? 0) + 1);
    }
    return { section, counts, length: Math.max(counts.size, 1) };
  });

  return counted
    .map(({ section, counts, length }) => {
      let score = 0;
      for (const word of asked) {
        const hits = counts.get(word);
        if (!hits) continue;
        const rarity = Math.log(sections.length / (containing.get(word) ?? 1) + 1);
        // Titles are short and deliberate, so a hit there is worth more.
        const inTitle = words(section.title).includes(word) ? 2 : 1;
        score += ((hits / length) * rarity + rarity * 0.5) * inTitle;
      }
      return { section, score };
    })
    .filter((hit) => hit.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((hit) => hit.section);
}

/**
 * Reads the docs shipped alongside this code.
 *
 * Preferred over fetching the site, because a deployment behind Vercel's
 * protection answers its own requests with a login page, and that parses into
 * nothing at all.
 */
async function readLocalDocs() {
  const candidates = [
    new URL("../static/llms-full.txt", import.meta.url),
    new URL("static/llms-full.txt", `file://${process.cwd()}/`),
  ];
  for (const path of candidates) {
    try {
      return await readFile(path, "utf8");
    } catch {
      // Try the next one. Where the file sits depends on how this was bundled.
    }
  }
  return null;
}

/** Loads the docs, from disk if they shipped with this code, else over HTTP. */
export async function loadSections({
  fetchImpl = fetch,
  readImpl = readLocalDocs,
  now = Date.now(),
} = {}) {
  if (cache.sections && now - cache.at < CACHE_MS) return cache.sections;

  let text = await readImpl();

  if (text === null) {
    const response = await fetchImpl(fullTextUrl());
    if (!response.ok) {
      // An older copy answers better than nothing while the site is redeploying.
      if (cache.sections) return cache.sections;
      throw new Error(`docs fetch failed: ${response.status}`);
    }
    text = await response.text();
  }

  const sections = parseSections(text);
  if (sections.length === 0) {
    throw new Error("docs loaded but no pages parsed out of them");
  }
  cache = { at: now, sections };
  return sections;
}

function buildPrompt(question, sections) {
  const pages = sections
    .map(
      (section) =>
        `Page: ${section.title}\nURL: ${section.url}\n\n${section.body.slice(0, CHARS_PER_PAGE)}`
    )
    .join("\n\n=====\n\n");
  return `${pages}\n\n=====\n\nQuestion: ${question}`;
}

async function callModel(model, prompt, apiKey, fetchImpl) {
  const response = await fetchImpl(apiUrl(model), {
    method: "POST",
    headers: {
      // The key goes in a header, not the query string, so it stays out of logs.
      "x-goog-api-key": apiKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: RULES }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        // Room for the model's own reasoning, which is spent from the same
        // budget as the answer. Too small and the answer stops mid-sentence.
        maxOutputTokens: 2048,
        // Short factual answers from pages already picked out for it. Deep
        // reasoning here buys nothing and eats the budget.
        thinking_level: "low",
      },
    }),
  });

  // The reason never reaches the browser, but without it a failing key and a
  // wrong model name look identical from the outside.
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    return {
      status: response.status,
      degraded: response.status === 429 ? "quota" : "unavailable",
      detail: `${response.status} ${detail.slice(0, 300)}`.trim(),
    };
  }

  const body = await response.json();
  const candidate = body.candidates?.[0];
  const text = (candidate?.content?.parts ?? [])
    .map((part) => part.text ?? "")
    .join("")
    .trim();

  if (!text) {
    return {
      status: 200,
      degraded: "unavailable",
      detail: `the model returned nothing, finish reason ${candidate?.finishReason ?? "unknown"}`,
    };
  }

  // A cut-off answer is still worth showing, but it needs to be visible in the
  // logs, because the reader cannot tell a short answer from a truncated one.
  const truncated = candidate?.finishReason === "MAX_TOKENS";
  return { answer: text, detail: truncated ? "answer hit the token cap" : undefined };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Asks the model, working around the one failure seen in practice.
 *
 * A busy model answers 503, which clears in a moment or on the smaller model.
 * Anything else, a bad key or a used-up quota, is final and returns at once.
 */
async function askModel(prompt, apiKey, fetchImpl) {
  let last;
  for (const [index, model] of MODELS.entries()) {
    if (index > 0) await sleep(RETRY_MS);
    last = await callModel(model, prompt, apiKey, fetchImpl);
    if (last.answer || last.status !== 503) return last;
  }
  return last;
}

/**
 * Answers a question, or returns the pages that look closest when it cannot.
 *
 * `degraded` is set whenever the model did not answer. The pages are still
 * worth showing, so this is a normal result rather than an error.
 */
export async function answerQuestion(question, { apiKey, fetchImpl = fetch, readImpl } = {}) {
  const asked = String(question ?? "").trim().slice(0, MAX_QUESTION_LENGTH);
  if (!asked) throw new Error("empty question");

  const sections = await loadSections({ fetchImpl, ...(readImpl && { readImpl }) });
  const hits = rankSections(asked, sections);
  const sources = hits.map(({ title, url }) => ({ title, url }));

  if (sources.length === 0) return { answer: null, sources: [], degraded: undefined };
  if (!apiKey) {
    return { answer: null, sources, degraded: "unavailable", detail: "no api key set" };
  }

  const result = await askModel(buildPrompt(asked, hits), apiKey, fetchImpl);
  return {
    answer: result.answer ?? null,
    sources,
    degraded: result.degraded,
    detail: result.detail,
  };
}

/** Only for tests, which need each case to start from an empty cache. */
export function resetCache() {
  cache = { at: 0, sections: null };
}
