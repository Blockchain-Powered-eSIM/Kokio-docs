#!/usr/bin/env node

/**
 * Checks the built site against the things agents and crawlers rely on.
 *
 * Most of this is invisible when it breaks. A page missing from the sitemap
 * still renders. A dead link in llms.txt still looks fine in the file. A schema
 * @id pointing at nothing still validates as JSON. Nobody notices until a model
 * answers from a page it could not fetch, which is weeks later and unattributable.
 *
 * Run after `npm run build`, from the project root. Wired as `postbuild`.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

import { PRODUCT_NAME, SITE_URL } from "../src/siteCopy.mjs";

const BUILD = "build";
const DOCS = "docs";

/** Built pages deliberately outside the sitemap. Each entry needs a reason. */
const NOT_INDEXED = {
  "/404": "error page, has no content of its own",
  "/search": "search box, its results are the doc pages that are indexed already",
};

/**
 * Sitemap URLs that are not doc pages, so they have no markdown twin.
 * The home page is navigation, and llms.txt already says everything it says.
 */
const NO_MARKDOWN = new Set(["/"]);

const failures = [];
const warnings = [];

function fail(check, message) {
  failures.push(`${check}: ${message}`);
}

function warn(check, message) {
  warnings.push(`${check}: ${message}`);
}

function read(file) {
  return readFileSync(join(BUILD, file), "utf8");
}

/** `/` is built to index.html, every other route to <route>/index.html. */
function htmlFile(pathname) {
  return pathname === "/" ? "index.html" : `${pathname.slice(1)}/index.html`;
}

function findFiles(dir, extension) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return findFiles(full, extension);
    return entry.name.endsWith(extension) ? [full] : [];
  });
}

/**
 * Route to source file, for every doc page.
 *
 * Ids come out of the file tree the same way `scripts/build-text.mjs` derives
 * them, and a `slug` in the frontmatter overrides the path.
 */
function docPages() {
  return findFiles(DOCS, ".md").map((file) => {
    const id = relative(DOCS, file).replace(/\.md$/, "");
    const frontmatter = readFileSync(file, "utf8").match(/^---\r?\n([\s\S]*?)\r?\n---/);
    const slug = frontmatter?.[1].match(/^slug:\s*["']?([^"'\r\n]+)["']?\s*$/m)?.[1].trim();
    const route = slug ? `/docs${slug.startsWith("/") ? slug : `/${slug}`}` : `/docs/${id}`;
    return { id, file, route };
  });
}

const pages = docPages();
const byRoute = new Map(pages.map((page) => [page.route, page]));

const builtPages = findFiles(BUILD, ".html")
  .map((file) => `/${relative(BUILD, file).replace(/(?:^|\/)index\.html$|\.html$/, "")}`)
  .map((pathname) => (pathname === "/" || pathname === "" ? "/" : pathname));

const sitemap = read("sitemap.xml");
const sitemapPaths = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
  (match) => new URL(match[1]).pathname
);

const llms = read("llms.txt");
const llmsFull = read("llms-full.txt");
const robots = read("robots.txt");

// 1. Every built page is in the sitemap, or excluded on purpose.
for (const pathname of builtPages) {
  if (pathname in NOT_INDEXED) continue;
  if (!sitemapPaths.includes(pathname)) {
    fail(
      "sitemap",
      `${pathname} was built but has no sitemap entry. Check the sidebar, or add it to NOT_INDEXED here with a reason.`
    );
  }
}

// 2. Every doc URL in the sitemap has text an agent can read, in both forms.
for (const pathname of sitemapPaths) {
  if (NO_MARKDOWN.has(pathname)) continue;

  if (!llmsFull.includes(`\n# ${pathname}\n`)) {
    fail("llms-full", `${pathname} is in the sitemap but has no section in llms-full.txt.`);
  }

  const page = byRoute.get(pathname);
  if (!page) {
    fail("markdown", `${pathname} is in the sitemap but maps to no file under docs/.`);
  } else if (!existsSync(join(BUILD, "md", `${page.id}.md`))) {
    fail("markdown", `${pathname} has no .md output. Run scripts/build-text.mjs.`);
  }
}

// 3. Links written for agents have to resolve. Nothing retries a 404.
const linked = new Set(
  [...`${llms}\n${llmsFull}`.matchAll(new RegExp(`${SITE_URL}(/[^\\s)]*)`, "g"))].map(
    (match) => match[1].replace(/[.,]$/, "")
  )
);

for (const link of linked) {
  // `/md/<path>.md` describes the pattern rather than naming a page.
  if (link.includes("<")) continue;

  const known =
    builtPages.includes(link) ||
    existsSync(join(BUILD, link.slice(1))) ||
    existsSync(join(BUILD, link.slice(1), "index.html"));

  if (!known) fail("links", `${link} is linked but was not built.`);
}

// 4. A schema reference pointing at nothing is worse than no reference.
for (const pathname of sitemapPaths) {
  const html = read(htmlFile(pathname));
  const domIds = new Set([...html.matchAll(/id="([^"]+)"/g)].map((match) => match[1]));

  const nodes = [
    ...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>(.*?)<\/script>/gs),
  ].flatMap((match) => {
    const parsed = JSON.parse(match[1]);
    return parsed["@graph"] ?? [parsed];
  });

  if (nodes.length === 0) fail("schema", `${pathname} carries no JSON-LD.`);

  const defined = new Set(nodes.map((node) => node["@id"]).filter(Boolean));
  const referenced = [...JSON.stringify(nodes).matchAll(/\{"@id":"([^"]+)"\}/g)].map(
    (match) => match[1]
  );

  for (const id of referenced) {
    if (defined.has(id)) continue;

    // An id defined on another host is a reference to that host's entity and
    // is resolved there. Only same-site ids are ours to define.
    if (!id.startsWith(SITE_URL)) continue;

    const fragment = id.split("#")[1];
    if (fragment && domIds.has(fragment)) continue;

    fail("schema", `${pathname} references @id ${id}, which nothing defines and no element matches.`);
  }
}

// 5. Both ways of reading a page have to be discoverable from the page itself.
for (const pathname of sitemapPaths) {
  const html = read(htmlFile(pathname));
  const canonical = html.match(/<link[^>]*rel="canonical"[^>]*href="([^"]+)"/)?.[1];
  const trim = (url) => url.replace(/\/$/, "");

  if (!canonical || trim(canonical) !== trim(`${SITE_URL}${pathname}`)) {
    fail("canonical", `${pathname} has canonical ${canonical ?? "(none)"}.`);
  }
  if (!NO_MARKDOWN.has(pathname) && !html.includes('type="text/markdown"')) {
    fail("markdown", `${pathname} does not link its own .md version.`);
  }
}

// 6. Groups in robots.txt are independent, so a disallow stated once is stated
//    only for the group it sits in and every other crawler is still free to fetch.
const groups = robots.split(/\n(?=User-[Aa]gent:)/).filter((part) => /User-[Aa]gent:/.test(part));
const expected = new Set([...robots.matchAll(/^Disallow:\s*(\S+)$/gm)].map((match) => match[1]));

if (!/User-[Aa]gent:\s*\*/.test(robots)) fail("robots", "no wildcard group.");

for (const group of groups) {
  const agent = group.match(/User-[Aa]gent:\s*(\S+)/)?.[1] ?? "(unknown)";
  for (const path of expected) {
    if (!group.includes(`Disallow: ${path}`)) {
      fail("robots", `${agent} is not disallowed from ${path}, but other agents are.`);
    }
  }
}

// 7. Dates. Every lastmod is read from git, so a missing one means the clone had
//    no history and every page now looks undated. A stale one means the build
//    ran against an older commit than the file.
function day(date) {
  return date.toISOString().slice(0, 10);
}

function lastCommitDay(file) {
  try {
    const out = execFileSync("git", ["log", "-1", "--format=%cI", "--", file], {
      encoding: "utf8",
    }).trim();
    return out ? day(new Date(out)) : null;
  } catch {
    return null;
  }
}

const lastmod = new Map(
  [...sitemap.matchAll(/<loc>([^<]+)<\/loc><lastmod>([^<]+)</g)].map(([, url, date]) => [
    new URL(url).pathname,
    date,
  ])
);

for (const pathname of sitemapPaths) {
  const stamp = lastmod.get(pathname);
  const page = byRoute.get(pathname);
  const committed = page && lastCommitDay(page.file);

  if (!stamp) {
    // A page with no commit yet has nothing to read a date from, which is
    // normal while writing one. Only a committed page missing its date means
    // the clone was shallow, and in CI every page is committed.
    const message = `${pathname} has no lastmod`;
    if (committed) {
      fail("freshness", `${message}. The build needs full git history: fetch-depth: 0 in CI.`);
    } else {
      warn("freshness", `${message}, because it is not committed yet.`);
    }
    continue;
  }

  if (committed && committed !== stamp) {
    warn("freshness", `${pathname} says ${stamp} but its last commit was ${committed}.`);
  }
}

// 8. A page has to answer on its own, because that is how it is retrieved. A
//    model is handed one chunk, not the sidebar around it, so a page that is
//    too short to say anything or never names the product is retrieved and
//    then discarded. Measured on the markdown output rather than the source:
//    frontmatter is stripped there, so a name that only appears in a
//    `description` does not count, and that is the surface agents read.
const MIN_WORDS = 100;
const NAMED_WITHIN = 60;

for (const page of pages) {
  const markdown = join(BUILD, "md", `${page.id}.md`);
  if (!existsSync(markdown)) continue; // already reported by check 2

  const words = readFileSync(markdown, "utf8")
    .replace(/```[\s\S]*?```/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  if (words.length < MIN_WORDS) {
    fail("standalone", `${page.route} is ${words.length} words. Under ${MIN_WORDS} is one chunk that answers nothing.`);
  }

  const opening = words.slice(0, NAMED_WITHIN).join(" ");
  if (!new RegExp(PRODUCT_NAME, "i").test(opening)) {
    fail("standalone", `${page.route} does not name ${PRODUCT_NAME} in its first ${NAMED_WITHIN} words.`);
  }
}

for (const message of warnings) console.warn(`warning  ${message}`);
for (const message of failures) console.error(`FAIL     ${message}`);

if (failures.length) {
  console.error(`\n${failures.length} check(s) failed.`);
  process.exit(1);
}

console.log(
  `verify-site: passed. ${builtPages.length} built pages, ${sitemapPaths.length} sitemap URLs, ${linked.size} agent-facing links.` +
    (warnings.length ? ` ${warnings.length} warning(s).` : "")
);
