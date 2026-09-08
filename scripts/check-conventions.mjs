#!/usr/bin/env node

/**
 * Checks the docs source against the conventions this repo keeps.
 *
 * These are rules that are cheap to state and expensive to notice. A file
 * named in camelCase quietly gives its page a camelCase URL. A heading with no
 * explicit id gets one derived from its text, so every link to it breaks the
 * next time the wording changes. A page with no description hands the
 * retriever whatever its first paragraph happens to be.
 *
 * Source only. Anything needing the built site lives in `verify-site.mjs`.
 * Wired as `prebuild`, so a file breaking a rule never reaches a build.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join, relative } from "node:path";

import { PRODUCT_NAME, PRODUCT_NAME_VARIANTS } from "../src/siteCopy.mjs";

/** Directories walked in full. Every file in them has to be named correctly. */
const TREES = ["docs", "resources"];

/** Lowercase words joined by single dashes, with at most one extension. */
const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\.[a-z0-9]+)?$/;

/** Long enough to say something, short enough that no surface truncates it. */
const DESCRIPTION_RANGE = [60, 320];

/** Enough to describe a diagram rather than label it. */
const MIN_ALT_TEXT = 40;

/**
 * Words that make writing sound generated. Each is banned because a plainer
 * word always exists, not because the concept is wrong.
 */
const FILLER = [
  "seamless",
  "utilize",
  "utilise",
  "streamlined",
  "empower",
  "leverage",
  "leveraging",
  "delve",
  "cutting-edge",
  "revolutionize",
  "game-changer",
  "in the realm",
  "worth noting",
  "effortless",
  "dive into",
  "tapestry",
];

/** Spellings that split one product into several entities. */
const NAME_ERRORS = PRODUCT_NAME_VARIANTS.filter((name) => name !== PRODUCT_NAME.toLowerCase());

/** Hyphenated forms of terms the Ethereum community writes as one word. */
const HYPHENATED_TERMS = ["on-chain", "off-chain"];

const failures = [];

function fail(rule, where, message) {
  failures.push(`${rule.padEnd(14)} ${where}: ${message}`);
}

function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? [full, ...walk(full)] : [full];
  });
}

/**
 * Prose only: fenced blocks and inline code are exempt from every wording
 * rule, because code says what it says and renaming it is not our call.
 */
function prose(body) {
  return body.replace(/```[\s\S]*?```/g, "").replace(/`[^`\n]*`/g, "");
}

function splitFrontmatter(source) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return { frontmatter: null, body: source, offset: 0 };
  return {
    frontmatter: match[1],
    body: source.slice(match[0].length),
    offset: match[0].split("\n").length - 1,
  };
}

/** Reads one scalar key. Not a YAML parser: only two keys are ever read. */
function field(frontmatter, key) {
  const match = frontmatter.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
  if (!match) return null;
  return match[1].trim().replace(/^["'](.*)["']$/, "$1");
}

// 1. Every file and folder is kebab-case, so a path is never a surprise and a
//    page's URL always matches the name of the file it came from.
for (const tree of TREES) {
  for (const path of walk(tree)) {
    const name = basename(path);
    if (!KEBAB.test(name)) {
      fail("naming", path, `"${name}" is not kebab-case. Lowercase words joined by single dashes.`);
    }
  }
}

const docs = walk("docs").filter((path) => path.endsWith(".md"));

for (const file of docs) {
  const source = readFileSync(file, "utf8");
  const { frontmatter, body, offset } = splitFrontmatter(source);
  const at = (index) => `${file}:${offset + body.slice(0, index).split("\n").length}`;

  // 2. Frontmatter. `title` names the page in the sidebar, the tab and the
  //    schema; `description` is the one sentence a retriever is handed before
  //    it decides whether to open the page at all. Neither has a good default.
  if (!frontmatter) {
    fail("frontmatter", file, "has no frontmatter block.");
  } else {
    const title = field(frontmatter, "title");
    const description = field(frontmatter, "description");

    if (!title) fail("frontmatter", file, "has no title.");
    if (!description) {
      fail("frontmatter", file, "has no description.");
    } else {
      const [min, max] = DESCRIPTION_RANGE;
      if (description.length < min || description.length > max) {
        fail("frontmatter", file, `description is ${description.length} chars, wanted ${min} to ${max}.`);
      }
      if (!description.endsWith(".")) {
        fail("frontmatter", file, "description is not a full sentence, it needs a full stop.");
      }
    }
  }

  // 3. Headings. One h1 and it comes first, no skipped levels, and an explicit
  //    id on each so links survive the heading being reworded.
  const headings = [];
  let fenced = false;
  let cursor = 0;

  for (const line of body.split("\n")) {
    const index = cursor;
    cursor += line.length + 1;

    if (line.startsWith("```")) fenced = !fenced;
    if (fenced) continue;

    const match = line.match(/^(#{1,6})\s+(.*)$/);
    if (match) headings.push({ level: match[1].length, text: match[2], index });
  }

  const h1s = headings.filter((heading) => heading.level === 1);
  if (h1s.length !== 1) fail("headings", file, `has ${h1s.length} h1 headings, wanted exactly 1.`);
  if (headings.length > 0 && headings[0].level !== 1) {
    fail("headings", at(headings[0].index), "the first heading is not the h1.");
  }

  const ids = new Set();
  let previous = 1;

  for (const heading of headings) {
    if (heading.level > previous + 1) {
      fail("headings", at(heading.index), `jumps from h${previous} to h${heading.level}.`);
    }
    previous = heading.level;

    const id = heading.text.match(/\{#([^}]+)\}\s*$/)?.[1];
    if (!id) {
      fail("headings", at(heading.index), `"${heading.text}" has no explicit {#id}. Run npm run write-heading-ids.`);
    } else if (ids.has(id)) {
      fail("headings", at(heading.index), `{#${id}} is used twice on this page.`);
    } else {
      ids.add(id);
    }
  }

  // 4. Images. A diagram is invisible to a screen reader and to every text
  //    surface this site generates, so what it shows has to be written down
  //    as well. Short alt text is a caption, not a description.
  for (const image of body.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g)) {
    const [, alt, src] = image;
    if (alt.trim().length < MIN_ALT_TEXT) {
      fail("images", at(image.index), `${src} has ${alt.trim().length ? "alt text too short to describe it" : "no alt text"}.`);
    }
  }

  // 5. Wording. Prose only, so nothing here judges a code sample.
  const text = prose(body);

  if (text.includes("—")) fail("wording", file, "contains an em dash. Use a comma, a full stop or parentheses.");

  for (const word of FILLER) {
    if (new RegExp(`\\b${word}\\b`, "i").test(text)) {
      fail("wording", file, `contains "${word}". Say it plainly instead.`);
    }
  }

  for (const variant of NAME_ERRORS) {
    if (text.includes(variant)) {
      fail("wording", file, `spells the product "${variant}". It is "${PRODUCT_NAME}" everywhere.`);
    }
  }

  for (const term of HYPHENATED_TERMS) {
    if (new RegExp(term, "i").test(text)) {
      fail("wording", file, `writes "${term}" with a hyphen. It is one word.`);
    }
  }

  if (/\bTODO\b|\bFIXME\b/.test(text)) {
    fail("wording", file, "carries a TODO or FIXME. Published pages do not.");
  }

  // A bare `$` is a math delimiter to some markdown renderers, so a price
  // renders as an equation or swallows the text after it.
  const dollar = text.match(/(?<!\\)\$\d/);
  if (dollar) fail("wording", file, `has an unescaped "${dollar[0]}". Write it as \\$.`);

  // 6. Layout. Prose is one line per paragraph, wrapped by the reader's editor
  //    rather than by us, and a trailing space is an invisible line break.
  for (const [line, content] of body.split("\n").entries()) {
    if (/\s+$/.test(content)) {
      fail("layout", `${file}:${offset + line + 1}`, "line ends in whitespace.");
    }
  }
}

for (const message of failures) console.error(`FAIL  ${message}`);

if (failures.length) {
  console.error(`\n${failures.length} convention(s) broken.`);
  process.exit(1);
}

console.log(`check-conventions: passed. ${docs.length} pages, ${TREES.map((t) => walk(t).length).reduce((a, b) => a + b, 0)} files named correctly.`);
