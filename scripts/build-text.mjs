/**
 * Builds the two plain-text surfaces from one pass over `docs/`:
 *
 *   static/md/<path>.md   one file per page, served at /md/<path>.md
 *   static/llms-full.txt  every page in one file
 *
 * One script on purpose. Two generators over the same corpus drift, and the
 * drift is invisible because nobody reads either output.
 *
 * Both outputs are generated and gitignored. Run by `prebuild`.
 */

import { execSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  CANONICAL_DESCRIPTION,
  DOCS_DESCRIPTION,
  DOCS_TITLE,
  SITE_URL,
} from "../src/siteCopy.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const docsDir = join(root, "docs");
const mdOutDir = join(root, "static", "md");
const llmsFullPath = join(root, "static", "llms-full.txt");

/** Every `.md` under `docs/`, as paths relative to `docs/`. */
function findDocs(dir = docsDir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return findDocs(full);
    return entry.name.endsWith(".md") ? [relative(docsDir, full)] : [];
  });
}

/**
 * Splits a leading `---` frontmatter block off the body.
 *
 * Deliberately not a YAML parser: the only key read here is `slug`, and
 * pulling in a dependency to find one string is not worth it.
 */
function splitFrontmatter(source) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return { frontmatter: "", body: source };
  return { frontmatter: match[1], body: source.slice(match[0].length) };
}

function readSlug(frontmatter) {
  const match = frontmatter.match(/^slug:\s*["']?([^"'\r\n]+)["']?\s*$/m);
  return match ? match[1].trim() : null;
}

/**
 * Everything a reader should not see.
 *
 * HTML comments matter most. Two pages keep old drafts commented out, which
 * never reach the rendered HTML, so they must not reach the text surface
 * either. Without this the markdown route would carry content the website
 * does not, including a paragraph contradicting the one above it.
 */
function toPlainMarkdown(body) {
  return body
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/^\s*(?:import|export)\s.+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function readTitle(body, fallback) {
  const match = body.match(/^#\s+(.+?)\s*$/m);
  return match ? match[1].trim() : fallback;
}

/** Doc ids in sidebar order, so llms-full.txt reads in the site's own order. */
function sidebarOrder() {
  const source = readFileSync(join(root, "sidebars.ts"), "utf8");
  return [...source.matchAll(/id:\s*"([^"]+)"/g)].map((m) => m[1]);
}

function gitShortSha() {
  try {
    return execSync("git rev-parse --short HEAD", { cwd: root }).toString().trim();
  } catch {
    return "unknown";
  }
}

const pages = findDocs().map((relPath) => {
  const id = relPath.replace(/\.md$/, "");
  const source = readFileSync(join(docsDir, relPath), "utf8");
  const { frontmatter, body } = splitFrontmatter(source);
  const text = toPlainMarkdown(body);
  const slug = readSlug(frontmatter);
  return {
    id,
    relPath,
    route: slug ? `/docs${slug.startsWith("/") ? slug : `/${slug}`}` : `/docs/${id}`,
    title: readTitle(text, id),
    text,
  };
});

// Sidebar order first, then anything the sidebar does not list. A doc missing
// from the sidebar is a bug caught elsewhere; dropping it here silently would
// hide it from the one surface that would have shown it.
const order = sidebarOrder();
const ranked = [...pages].sort((a, b) => {
  const ai = order.indexOf(a.id);
  const bi = order.indexOf(b.id);
  return (ai === -1 ? order.length : ai) - (bi === -1 ? order.length : bi);
});

const unlisted = pages.filter((p) => !order.includes(p.id));
if (unlisted.length > 0) {
  console.warn(
    `build-text: ${unlisted.length} page(s) not in sidebars.ts, appended last: ${unlisted
      .map((p) => p.id)
      .join(", ")}`
  );
}

rmSync(mdOutDir, { recursive: true, force: true });
for (const page of pages) {
  const out = join(mdOutDir, page.relPath);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${page.text}\n`);
}

const header = [
  `# ${DOCS_TITLE}: full text`,
  `> ${DOCS_DESCRIPTION}`,
  `> Generated from ${SITE_URL} on ${new Date().toISOString().split("T")[0]}, commit ${gitShortSha()}.`,
  `> Product description: ${CANONICAL_DESCRIPTION}`,
  "",
  `Every page below is also available on its own at ${SITE_URL}/md/<path>.md`,
];

const body = ranked.map(
  (page) => `---\n# ${page.route}\n\n${page.text}\n`
);

writeFileSync(llmsFullPath, `${header.join("\n")}\n\n${body.join("\n")}`);

console.log(
  `build-text: ${pages.length} markdown files in static/md/, ${ranked.length} sections in llms-full.txt`
);
