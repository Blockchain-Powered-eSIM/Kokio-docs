/**
 * Checks for the answer logic. Run with `node lib/docs-answer.test.mjs`.
 *
 * Nothing here touches the network. The docs and the model call are both
 * handed in, so the cases that matter, a refused field, a busy model, a
 * used-up quota, can be checked without spending any.
 */

import assert from "node:assert/strict";

import {
  answerQuestion,
  buildRequest,
  parseSections,
  rankSections,
  resetCache,
} from "./docs-answer.mjs";

const FULL_TEXT = `# Kokio documentation: full text
> Kokio collects no personal information and asks for no document scan.
> Generated from https://docs.kokio.app on 2026-09-08, commit abc1234.

---
# /docs/kokio/mobile-app

# Mobile app flow {#mobile-app-flow}

The app registers a passkey on the phone, then deploys a wallet for the device.
Passkey signatures authorise every purchase.

---
# /docs/contracts/registry

# Registry {#registry}

The registry records every device wallet and every eSIM wallet, plus the vault
address and the price ceiling.

---
# /docs/esim/intro

# What an eSIM is {#what-an-esim-is}

An eSIM is a profile downloaded onto a chip already soldered into the phone.
`;

const sections = parseSections(FULL_TEXT);
const readFixture = async () => FULL_TEXT;

/** Every case reads the fixture, never the real docs sitting in static/. */
function ask(question, options) {
  return answerQuestion(question, { readImpl: readFixture, ...options });
}

/** A fetch that only ever sees the model, since the docs come from `readImpl`. */
function fakeFetch(...responses) {
  const sent = [];
  const queue = [...responses];
  const impl = async (url, options) => {
    sent.push({ url, body: JSON.parse(options.body) });
    const next = queue.length > 1 ? queue.shift() : queue[0];
    return { text: async () => "", ...next };
  };
  impl.sent = sent;
  return impl;
}

const ok = (text, finishReason = "STOP") => ({
  ok: true,
  status: 200,
  json: async () => ({ candidates: [{ content: { parts: [{ text }] }, finishReason }] }),
});

const failure = (status, body = "") => ({
  ok: false,
  status,
  text: async () => body,
});

// Parsing: one entry per page, plus the opening description as its own page,
// since some of what it says appears nowhere else. The build stamp is not part
// of the docs and must not be indexed.
assert.equal(sections.length, 4);
assert.deepEqual(
  sections.map((s) => s.url),
  ["/", "/docs/kokio/mobile-app", "/docs/contracts/registry", "/docs/esim/intro"]
);
assert.match(sections[0].body, /no personal information/);
assert.ok(!sections[0].body.includes("commit abc1234"));
assert.equal(sections[1].title, "Mobile app flow");

// The description answers what no page covers.
assert.equal(rankSections("what personal information is collected", sections)[0].url, "/");

// Ranking: the subject wins, and an unrelated question matches nothing.
assert.equal(rankSections("how do passkeys work", sections)[0].url, "/docs/kokio/mobile-app");
assert.equal(rankSections("where is the price ceiling", sections)[0].url, "/docs/contracts/registry");
assert.deepEqual(rankSections("zzzz nonexistent", sections), []);

/**
 * The request shape, pinned.
 *
 * A field the API does not know fails every question with a 400, and it looks
 * like a broken key from the outside. Only names checked against Google's REST
 * reference belong here, so adding one has to be a deliberate edit of this
 * list rather than a guess in the request body.
 */
const full = buildRequest("prompt");
assert.deepEqual(Object.keys(full).sort(), ["contents", "generationConfig", "systemInstruction"]);
assert.deepEqual(
  Object.keys(full.generationConfig).sort(),
  ["maxOutputTokens", "temperature", "thinkingConfig"]
);
assert.deepEqual(full.generationConfig.thinkingConfig, { thinkingLevel: "low" });
assert.deepEqual(Object.keys(buildRequest("prompt", { minimal: true }).generationConfig).sort(), [
  "maxOutputTokens",
  "temperature",
]);

// The happy path.
resetCache();
const answered = await ask("how do passkeys work", {
  apiKey: "test-key",
  fetchImpl: fakeFetch(ok("The app registers a passkey.")),
});
assert.equal(answered.answer, "The app registers a passkey.");
assert.equal(answered.sources[0].url, "/docs/kokio/mobile-app");
assert.equal(answered.degraded, undefined);

// The same question again is served from memory, not from quota.
const repeat = await ask("How do passkeys work", {
  apiKey: "test-key",
  fetchImpl: fakeFetch(failure(500)),
});
assert.equal(repeat.answer, "The app registers a passkey.");
assert.equal(repeat.cached, true);

// A refused config drops the optional tuning and tries once more, which is
// what turns a renamed field into a slower answer instead of a dead box.
resetCache();
const refusedConfig = fakeFetch(failure(400, "Unknown name at generation_config"), ok("Fine."));
const recovered = await ask("how do passkeys work", {
  apiKey: "test-key",
  fetchImpl: refusedConfig,
});
assert.equal(recovered.answer, "Fine.");
assert.equal(refusedConfig.sent.length, 2);
assert.ok(refusedConfig.sent[0].body.generationConfig.thinkingConfig);
assert.equal(refusedConfig.sent[1].body.generationConfig.thinkingConfig, undefined);

// A busy model clears on a retry.
resetCache();
const busy = fakeFetch(failure(503, "high demand"), ok("A passkey is a key on the phone."));
const busyThenFine = await ask("how do passkeys work", { apiKey: "test-key", fetchImpl: busy });
assert.equal(busyThenFine.answer, "A passkey is a key on the phone.");
assert.equal(busy.sent.length, 2);

// A used-up quota is final: one call, no answer, pages still returned.
resetCache();
const quota = fakeFetch(failure(429, "RESOURCE_EXHAUSTED"));
const outOfQuota = await ask("how do passkeys work", { apiKey: "test-key", fetchImpl: quota });
assert.equal(outOfQuota.answer, null);
assert.equal(outOfQuota.degraded, "quota");
assert.equal(quota.sent.length, 1);
assert.ok(outOfQuota.sources.length > 0);

// A bad key is final too, and must not be retried on every model.
resetCache();
const badKeyCalls = fakeFetch(failure(403, "API key not valid"));
const badKey = await ask("how do passkeys work", { apiKey: "wrong", fetchImpl: badKeyCalls });
assert.equal(badKey.degraded, "unavailable");
assert.equal(badKeyCalls.sent.length, 1);

// A hanging model must not hold the request open. The abort surfaces as this.
resetCache();
const timedOut = await ask("how do passkeys work", {
  apiKey: "test-key",
  fetchImpl: async () => {
    const error = new Error("aborted");
    error.name = "AbortError";
    throw error;
  },
});
assert.equal(timedOut.answer, null);
assert.equal(timedOut.degraded, "unavailable");
assert.match(timedOut.detail, /timed out/);

// An answer cut short still reaches the reader, and says so in the detail.
resetCache();
const truncated = await ask("how do passkeys work", {
  apiKey: "test-key",
  fetchImpl: fakeFetch(ok("A passkey is", "MAX_TOKENS")),
});
assert.equal(truncated.answer, "A passkey is");
assert.match(truncated.detail, /token cap/);

// No key configured: never call the model, still answer with pages.
resetCache();
const noKey = await ask("how do passkeys work", { fetchImpl: fakeFetch(failure(500)) });
assert.equal(noKey.answer, null);
assert.ok(noKey.sources.length > 0);

// An empty question is a caller mistake, not a quiet empty answer.
await assert.rejects(() => ask("   ", { apiKey: "test-key" }));

// A login page in place of the docs must fail loudly. Left alone it parses
// into nothing, and every question then answers "nothing matches".
resetCache();
await assert.rejects(
  () =>
    answerQuestion("how do passkeys work", {
      apiKey: "test-key",
      readImpl: async () => "<!DOCTYPE html><html><body>Sign in</body></html>",
    }),
  /no pages/
);

console.log("docs-answer: passed. Request shape pinned, parsing, ranking and 11 behaviours checked.");
