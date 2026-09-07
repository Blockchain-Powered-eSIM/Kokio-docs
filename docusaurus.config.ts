import { themes as prismThemes } from "prism-react-renderer";
import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";

const config: Config = {
  title: "Kokio",
  staticDirectories: ["static"],
  tagline: "Blockchain powered eSIM",
  favicon: "images/KokioLogo",

  // Set the production url of your site here
  url: "https://docs.kokio.app",
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: "/",

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: "Kokio", // Usually your GitHub org/user name.
  projectName: "Kokio", // Usually your repo name.

  onBrokenLinks: "throw",

  markdown: {
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
        },
        blog: false,
        theme: {
          customCss: "./src/css/custom.css",
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
        href: "https://www.kokio.app",
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
        {
          href: "https://github.com/Blockchain-Powered-eSIM",
          label: "GitHub",
          position: "right",
        },
      ],
    },
    footer: {
      style: "dark",
      links: [
        {
          title: "Docs",
          items: [
            {
              label: "What is Kokio?",
              to: "/docs/kokio/landingIntro",
            },
          ],
        },
        {
          title: "Community",
          items: [
            {
              label: "Discord",
              href: "https://discord.gg/hkXvABaG",
            },
            {
              label: "Twitter",
              href: "https://x.com/kokiodotapp",
            },
            {
              label: "Telegram",
              href: "https://t.me/+b44BXiy8d5k4M2Q1",
            },
          ],
        },
        {
          title: "More",
          items: [
            {
              label: "GitHub",
              href: "https://github.com/Blockchain-Powered-eSIM",
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Kokio SG Pte. Ltd.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
