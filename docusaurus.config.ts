import { themes as prismThemes } from "prism-react-renderer";
import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";

import {
  BLOG_URL,
  DOCS_META_DESCRIPTION,
  DOCS_TITLE,
  GITHUB_ORG,
  MARKETING_URL,
  SITE_URL,
  TELEGRAM_URL,
  TWITTER_URL,
} from "./src/siteCopy.mjs";

const config: Config = {
  title: DOCS_TITLE,
  staticDirectories: ["static"],
  tagline: DOCS_META_DESCRIPTION,
  // The mark on its own, from Kokio-web `assets/logomark.svg`. The full logo
  // is a wordmark, and a wordmark at 16px in a browser tab is unreadable.
  // The extension is not optional. Without it the page emits
  // <link rel="icon" href="/images/kokio-logomark"> and that URL is a 404.
  favicon: "images/kokio-logomark.svg",

  url: SITE_URL,
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: "/",

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: "Kokio", // Usually your GitHub org/user name.
  projectName: "Kokio", // Usually your repo name.

  onBrokenLinks: "throw",

  // The two faces kokio.app uses: Anybody for headings, Lexend for everything
  // else. Weights are trimmed to the ones that get rendered.
  headTags: [
    {
      tagName: "link",
      attributes: { rel: "preconnect", href: "https://fonts.googleapis.com" },
    },
    {
      tagName: "link",
      attributes: {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossorigin: "anonymous",
      },
    },
  ],

  stylesheets: [
    "https://fonts.googleapis.com/css2?family=Anybody:wght@400..800&family=Lexend:wght@300..700&display=swap",
  ],

  markdown: {
    // Plain CommonMark, not MDX. Most of the contract reference is generated
    // from Solidity NatSpec, and it is full of text MDX reads as JSX: `<20-byte>`
    // in a return description, braces in a type. None of the docs use JSX, so
    // there is nothing to give up by parsing them as ordinary markdown.
    format: "md",

    hooks: {
      // A dead link in a doc is a dead end for a reader and a 404 for a
      // crawler. Cheaper to fail the build than to find it in the logs.
      onBrokenMarkdownLinks: "throw",
    },
  },

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: "en",
    locales: ["en"],
  },

  presets: [
    [
      "classic",
      {
        docs: {
          sidebarPath: "./sidebars.ts",
          editUrl:
            "https://github.com/Blockchain-Powered-eSIM/Kokio-docs/tree/main/",
          // Read from git. Feeds the dateModified in each page's TechArticle,
          // which is what tells a retriever the page is current.
          showLastUpdateTime: true,
        },
        blog: false,
        theme: {
          customCss: "./src/css/custom.css",
        },
        sitemap: {
          // Read from git, per file. This needs full history in CI:
          // a shallow clone gives every page the same date or none.
          lastmod: "date",
          // Google ignores both, and every URL carried the same value
          // anyway, so they were bytes carrying no signal.
          changefreq: null,
          priority: null,
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: "images/kokio-social-card.png",
    navbar: {
      logo: {
        alt: "Kokio Logo",
        src: "images/KokioLogo.svg",
        href: MARKETING_URL,
      },
      items: [
        {
          to: "/",
          label: "Home",
          position: "left",
        },
        //{to: '/docs', label: 'Docs', position: 'left'},
        {
          type: "docSidebar",
          sidebarId: "kokioSidebar",
          position: "left",
          label: "Docs",
        },
        // The icon is drawn by CSS on the class, so these carry no label. The
        // aria-label is the only name a screen reader gets.
        {
          href: TWITTER_URL,
          position: "right",
          className: "header-icon-link header-icon-link--twitter",
          "aria-label": "Kokio on X",
        },
        {
          href: TELEGRAM_URL,
          position: "right",
          className: "header-icon-link header-icon-link--telegram",
          "aria-label": "Kokio on Telegram",
        },
        {
          href: GITHUB_ORG,
          position: "right",
          className: "header-icon-link header-icon-link--github",
          "aria-label": "Kokio on GitHub",
        },
      ],
    },
    footer: {
      // No `style: "dark"`. That pins one slab colour across both themes; the
      // footer takes its colours from the theme in custom.css instead.
      links: [
        {
          title: "Docs",
          items: [
            {
              label: "What is Kokio?",
              to: "/docs/kokio/landing-intro",
            },
            {
              label: "Kokio SDK",
              to: "/docs/sdk/overview",
            },
            {
              label: "Smart contracts",
              to: "/docs/contracts/overview",
            },
          ],
        },
        {
          title: "Community",
          items: [
            {
              label: "Twitter",
              href: TWITTER_URL,
            },
            {
              label: "Telegram",
              href: TELEGRAM_URL,
            },
          ],
        },
        {
          title: "More",
          items: [
            {
              label: "GitHub",
              href: GITHUB_ORG,
            },
            {
              label: "Blogs",
              href: BLOG_URL,
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Kokio SG Pte. Ltd.`,
    },
    prism: {
      theme: prismThemes.github,
      // Dracula's background is blue-purple and fights the warm dark ground the
      // rest of the site uses. Gruvbox sits on the same hue.
      darkTheme: prismThemes.gruvboxMaterialDark,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
