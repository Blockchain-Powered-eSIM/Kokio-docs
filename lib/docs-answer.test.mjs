/**
 * Checks for the answer logic. Run with `node lib/docs-answer.test.mjs`.
 *
 * Nothing here touches the network. Both the docs fetch and the model call are
 * handed in, so the cases that matter, a used-up quota and a model that is
 * down, can be tested at all.
 */

import assert from "node:assert/strict";

import {
  answerQuestion,
  parseSections,
  rankSections,
  resetCache,
} from "./docs-answer.mjs";

const FULL_TEXT = `# Kokio documentation: full text
> preamble that is not a page

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

// Parsing: one entry per page, preamble dropped, anchor ids stripped.
assert.equal(sections.length, 3);
assert.deepEqual(
  sections.map((s) => s.url),
  ["/docs/kokio/mobile-app", "/docs/contracts/registry", "/docs/esim/intro"]
);
assert.equal(sections[0].title, "Mobile app flow");
assert.ok(!sections[0].title.includes("#"));

// Ranking: the question's subject wins, and an unrelated question matches nothing.
assert.equal(rankSections("how do passkeys work", sections)[0].url, "/docs/kokio/mobile-app");
assert.equal(rankSections("where is the price ceiling", sections)[0].url, "/docs/contracts/registry");
assert.deepEqual(rankSections("zzzz nonexistent", sections), []);

/** A fetch that only ever sees the model, since the docs come from `readImpl`. */
function fakeFetch(modelResponse) {
  return async () => ({ text: async () => "", ...modelResponse });
}

/** Stands in for the copy of the docs that ships with the code. */
const readFixture = async () => FULL_TEXT;

/** Every case reads the fixture, never the real docs sitting in static/. */
function ask(question, options) {
  return answerQuestion(question, { readImpl: readFixture, ...options });
}

const answered = await ask("how do passkeys work", {
  apiKey: "test-key",
  fetchImpl: fakeFetch({
    ok: true,
    status: 200,
    json: async () => ({
      candidates: [{ content: { parts: [{ text: "The app registers a passkey." }] } }],
    }),
  }),
});
assert.equal(answered.answer, "The app registers a passkey.");
assert.equal(answered.sources[0].url, "/docs/kokio/mobile-app");
assert.equal(answered.degraded, undefined);

// Quota gone: no answer, but the pages still come back for the reader.
resetCache();
const outOfQuota = await ask("how do passkeys work", {
  apiKey: "test-key",
  fetchImpl: fakeFetch({ ok: false, status: 429 }),
});
assert.equal(outOfQuota.answer, null);
assert.equal(outOfQuota.degraded, "quota");
assert.ok(outOfQuota.sources.length > 0);

// A busy model answers 503. Seen in practice, and it clears on a second try,
// so this must not reach the reader as a failure.
resetCache();
let calls = 0;
const busyThenFine = await ask("how do passkeys work", {
  apiKey: "test-key",
  fetchImpl: async () => {
    calls += 1;
    return calls === 1
      ? { ok: false, status: 503, text: async () => "high demand" }
      : {
          ok: true,
          status: 200,
          json: async () => ({
            candidates: [{ content: { parts: [{ text: "A passkey is a key on the phone." }] } }],
          }),
        };
  },
});
assert.equal(busyThenFine.answer, "A passkey is a key on the phone.");
assert.equal(calls, 2);

// An answer cut short still reaches the reader, and says so in the detail.
resetCache();
const truncated = await ask("how do passkeys work", {
  apiKey: "test-key",
  fetchImpl: fakeFetch({
    ok: true,
    status: 200,
    json: async () => ({
      candidates: [
        { content: { parts: [{ text: "A passkey is" }] }, finishReason: "MAX_TOKENS" },
      ],
    }),
  }),
});
assert.equal(truncated.answer, "A passkey is");
assert.match(truncated.detail, /token cap/);

// A bad key is final, so it must not be retried.
resetCache();
let keyCalls = 0;
const badKey = await ask("how do passkeys work", {
  apiKey: "wrong",
  fetchImpl: async () => {
    keyCalls += 1;
    return { ok: false, status: 400, text: async () => "API key not valid" };
  },
});
assert.equal(badKey.degraded, "unavailable");
assert.equal(keyCalls, 1);

// Model down, same deal.
resetCache();
const modelDown = await ask("how do passkeys work", {
  apiKey: "test-key",
  fetchImpl: fakeFetch({ ok: false, status: 503 }),
});
assert.equal(modelDown.answer, null);
assert.equal(modelDown.degraded, "unavailable");

// No key configured: never call the model, still answer with pages.
resetCache();
const noKey = await ask("how do passkeys work", {
  fetchImpl: fakeFetch({ ok: false, status: 500 }),
});
assert.equal(noKey.answer, null);
assert.equal(noKey.degraded, "unavailable");
assert.ok(noKey.sources.length > 0);

// An empty question is a caller mistake, not a quiet empty answer.
await assert.rejects(() => ask("   ", { apiKey: "test-key" }));

// A login page in place of the docs must fail loudly. Left to itself it parses
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

console.log("docs-answer: passed. 3 pages parsed, ranking, retry, truncation and six failure paths checked.");
