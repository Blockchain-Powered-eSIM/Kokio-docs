/**
 * Canonical strings for this site. Import them instead of writing the name or
 * a description as a literal, so every surface says the same thing byte for
 * byte.
 *
 * Models build an entity record out of repeated strings. Four spellings of the
 * name split one product into four weakly supported entities, and two
 * different descriptions make a model hedge instead of answering.
 *
 * Plain JavaScript rather than TypeScript because the build scripts in
 * `scripts/` import it too, and those run under plain node.
 */

/** The only spelling allowed in prose, headings, metadata and JSON-LD `name`. */
export const PRODUCT_NAME = "Kokio";

/**
 * Everything that is not the canonical name: shipped spellings, and what
 * people type. All of them have to resolve to this product, so they go in
 * schema `alternateName`. Never use one as the name in new copy.
 */
export const PRODUCT_NAME_VARIANTS = ["Koki'o", "KOKI'O", "KOKIO", "kokio"];

export const SITE_URL = "https://docs.kokio.app";
export const MARKETING_URL = "https://kokio.app";

/**
 * JSON-LD node ids. The organisation is defined once on the marketing site and
 * referenced from here, never redefined, or the two hosts describe two
 * different companies.
 */
export const ORGANIZATION_ID = `${MARKETING_URL}/#organization`;
export const WEBSITE_ID = `${SITE_URL}/#website`;

/**
 * The product description, copied byte for byte from
 * `Kokio-web/lib/site-copy.ts`. Do not paraphrase it. If the marketing site
 * changes it, change it here the same day.
 */
export const CANONICAL_DESCRIPTION =
  "Kokio is a privacy-first travel eSIM app. Buy eSIM data plans in over 200 destinations with card, Apple Pay, Google Pay or stablecoins. No KYC and no personal information collected. Every Kokio account is a passkey-controlled smart wallet, so the eSIM is owned by the user rather than held in a provider database.";

/**
 * What this site is, as opposed to what the product is. Used in `llms.txt`,
 * the `WebSite` schema and the home page.
 */
export const DOCS_DESCRIPTION =
  "Technical documentation for Kokio, a privacy-first travel eSIM app. Covers how eSIM provisioning works, the Kokio mobile app flow, and the onchain wallet suite: ERC-4337 smart accounts controlled by a device passkey, one wallet per device and one per eSIM, with data bundle purchases recorded onchain.";

/** Same claims, trimmed to fit a `<meta name="description">` without truncation. */
export const DOCS_META_DESCRIPTION =
  "Technical documentation for Kokio: how eSIM provisioning works, the mobile app flow, and the onchain wallet suite of passkey-controlled smart accounts.";

export const DOCS_TITLE = `${PRODUCT_NAME} documentation`;

/**
 * The site itself, as a schema node.
 *
 * Every page carries a copy rather than referencing one defined on the home
 * page. A crawler reads one page at a time, so an `@id` whose definition lives
 * on a different URL resolves to nothing on the page that names it.
 */
export const WEBSITE_SCHEMA = {
  "@type": "WebSite",
  "@id": WEBSITE_ID,
  url: SITE_URL,
  name: DOCS_TITLE,
  description: DOCS_DESCRIPTION,
  // Every spelling people actually type has to resolve to this product.
  alternateName: PRODUCT_NAME_VARIANTS.map((variant) => `${variant} documentation`),
  publisher: { "@id": ORGANIZATION_ID },
  inLanguage: "en",
};

/** Source repositories, and the one place their URLs are written down. */
export const GITHUB_ORG = "https://github.com/Blockchain-Powered-eSIM";
export const CONTRACTS_REPO = `${GITHUB_ORG}/smart-contract-suite`;
export const SDK_REPO = `${GITHUB_ORG}/kokio-sdk`;
