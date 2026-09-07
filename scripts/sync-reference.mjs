#!/usr/bin/env node

/**
 * Keeps the generated Solidity reference on the contract pages in step with the
 * repository that produces it.
 *
 * The contract pages are half hand-written and half generated. The written half
 * is the intro at the top of the page; the generated half is whatever sits
 * between a `docgen:start` / `docgen:end` pair, copied from another repo's
 * `hardhat docgen` output. That other repo ships on its own schedule and nobody
 * editing this site has a reason to open it, so the check has to come here.
 *
 * Usage, from the project root:
 *
 *   node scripts/sync-reference.mjs             report drift, exit 0
 *   node scripts/sync-reference.mjs --strict    report drift, exit 1
 *   node scripts/sync-reference.mjs --write     rewrite the drifted blocks
 *
 * Only the text between the markers is ever replaced. Everything else on the
 * page belongs to whoever wrote it.
 */

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { createSlugger } from "@docusaurus/utils";

const DOCS = "docs";

/** Where a `source=` prefix resolves to. First path segment picks the repo. */
const REPOS = {
  "smart-contract-suite": "Blockchain-Powered-eSIM/smart-contract-suite",
};

const BRANCH = "main";

const START = /^<!-- docgen:start source=(\S+) -->$/;
const END = "<!-- docgen:end -->";

const args = new Set(process.argv.slice(2));
const write = args.has("--write");
const strict = args.has("--strict");

function findFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return findFiles(full);
    return entry.name.endsWith(".md") ? [full] : [];
  });
}

/**
 * Every docgen block on a page, in order, with the line span it occupies.
 * A start with no end is a malformed page rather than an empty block, so it
 * throws instead of quietly syncing nothing.
 */
function findBlocks(file) {
  const lines = readFileSync(file, "utf8").split("\n");
  const blocks = [];

  for (let i = 0; i < lines.length; i += 1) {
    const match = START.exec(lines[i]);
    if (!match) continue;

    const end = lines.indexOf(END, i + 1);
    if (end === -1) throw new Error(`${file}: docgen:start at line ${i + 1} has no docgen:end`);

    blocks.push({ source: match[1], from: i + 1, to: end });
    i = end;
  }

  return blocks.length ? { file, lines, blocks } : null;
}

/**
 * Turns one `hardhat docgen` file into the body committed on a page.
 *
 * Four things happen here, and all four have to be a pure function of the
 * source, because `--check` recomputes this and compares. Anything that
 * depended on the page around it would report drift on a page nobody touched.
 *
 * 1. The `# Solidity API` wrapper goes. The page has its own h1.
 * 2. `#### Parameters` and `#### Return Values` become bold labels. They are
 *    captions inside a member, not places anyone links to, and as headings they
 *    fill the table of contents with 166 entries reading "Parameters".
 * 3. Every remaining heading gets an explicit id, prefixed with the unit it
 *    belongs to. The prefix is what lets two units share a page: `Registry` and
 *    `RegistryHelper` both declare a `registry` member, and without it the two
 *    anchors collide and Docusaurus renumbers one of them.
 * 4. Wrapped prose is joined back into one line per paragraph. docgen re-emits
 *    the source comment's own line breaks, indented, and five spaces of indent
 *    after a blank line is a code block to any other markdown reader.
 */
export function transform(markdown) {
  const out = [];
  let fenced = false;
  let unit = "";

  for (const raw of markdown.split("\n")) {
    if (raw.startsWith("```")) {
      fenced = !fenced;
      out.push(raw);
      continue;
    }

    if (fenced) {
      out.push(raw);
      continue;
    }

    const line = raw.trim();

    if (line === "# Solidity API") continue;

    if (line === "#### Parameters" || line === "#### Return Values") {
      out.push(`**${line.slice(5)}**`);
      continue;
    }

    if (line.startsWith("## ")) {
      unit = slug(line.slice(3));
      out.push(`## ${line.slice(3)} {#${unit}}`);
      continue;
    }

    if (line.startsWith("### ")) {
      out.push(`### ${line.slice(4)} {#${unit}-${slug(line.slice(4))}}`);
      continue;
    }

    // Join a continuation line back onto the paragraph it was broken off from.
    const previous = out[out.length - 1];
    if (line && previous && canTakeMore(previous) && !ownsItsLine(line)) {
      out[out.length - 1] = `${previous} ${line}`;
      continue;
    }

    out.push(line);
  }

  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** A heading, a table row or a label is finished; nothing gets appended to it. */
function canTakeMore(line) {
  return !/^(#|\||```|\*\*)/.test(line);
}

/** A bullet takes continuation lines of its own but never joins the line above. */
function ownsItsLine(line) {
  return !canTakeMore(line) || /^[-*] /.test(line);
}

/** The same slugs Docusaurus generates, so `write-heading-ids` has nothing to add. */
function slug(text) {
  return createSlugger().slug(text);
}

async function fetchSource(source) {
  const [repoKey, ...rest] = source.split("/");
  const repo = REPOS[repoKey];
  if (!repo) throw new Error(`unknown source repo in "${source}"`);

  const url = `https://raw.githubusercontent.com/${repo}/${BRANCH}/${rest.join("/")}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.text();
}

const pages = findFiles(DOCS).map(findBlocks).filter(Boolean);
const sources = new Set(pages.flatMap((page) => page.blocks.map((block) => block.source)));

if (!sources.size) {
  console.log("sync-reference: no docgen blocks to check.");
  process.exit(0);
}

/** A build must not fail because GitHub was briefly unreachable. */
const bodies = new Map();
try {
  await Promise.all(
    [...sources].map(async (source) => bodies.set(source, transform(await fetchSource(source))))
  );
} catch (error) {
  console.warn(`sync-reference: skipped, upstream unreadable. ${error.message}`);
  process.exit(0);
}

const drifted = [];

for (const page of pages) {
  const lines = [...page.lines];
  let changed = false;

  // Back to front, so an earlier block's replacement does not move a later one.
  for (const block of [...page.blocks].reverse()) {
    const upstream = bodies.get(block.source).split("\n");
    const committed = lines.slice(block.from, block.to);
    if (committed.join("\n") === upstream.join("\n")) continue;

    drifted.push(`${page.file} ← ${block.source}`);
    changed = true;
    if (write) lines.splice(block.from, block.to - block.from, ...upstream);
  }

  if (changed && write) writeFileSync(page.file, lines.join("\n"));
}

if (!drifted.length) {
  console.log(`sync-reference: ${sources.size} reference file(s) up to date.`);
  process.exit(0);
}

for (const entry of drifted) console.warn(`${write ? "updated " : "drifted "} ${entry}`);

if (write) {
  console.log(`\nsync-reference: rewrote ${drifted.length} block(s). Review the diff before committing.`);
  process.exit(0);
}

console.warn(`\nsync-reference: ${drifted.length} block(s) behind ${BRANCH}. Run with --write to update.`);
process.exit(strict ? 1 : 0);
