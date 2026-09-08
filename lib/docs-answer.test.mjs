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

/** A fetch that serves the docs, then whatever the model case needs. */
function fakeFetch(modelResponse) {
  return async (url) => {
    if (String(url).endsWith("/llms-full.txt")) {
      return { ok: true, status: 200, text: async () => FULL_TEXT };
    }
    return modelResponse;
  };
}

const answered = await answerQuestion("how do passkeys work", {
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
const outOfQuota = await answerQuestion("how do passkeys work", {
  apiKey: "test-key",
  fetchImpl: fakeFetch({ ok: false, status: 429 }),
});
assert.equal(outOfQuota.answer, null);
assert.equal(outOfQuota.degraded, "quota");
assert.ok(outOfQuota.sources.length > 0);

// Model down, same deal.
resetCache();
const modelDown = await answerQuestion("how do passkeys work", {
  apiKey: "test-key",
  fetchImpl: fakeFetch({ ok: false, status: 503 }),
});
assert.equal(modelDown.answer, null);
assert.equal(modelDown.degraded, "unavailable");

// No key configured: never call the model, still answer with pages.
resetCache();
const noKey = await answerQuestion("how do passkeys work", {
  fetchImpl: fakeFetch({ ok: false, status: 500 }),
});
assert.equal(noKey.answer, null);
assert.equal(noKey.degraded, "unavailable");
assert.ok(noKey.sources.length > 0);

// An empty question is a caller mistake, not a quiet empty answer.
await assert.rejects(() => answerQuestion("   ", { apiKey: "test-key" }));

console.log("docs-answer: passed. 3 pages parsed, ranking and all four model paths checked.");
