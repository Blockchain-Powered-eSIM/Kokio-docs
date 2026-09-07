import React, { type ReactNode } from "react";
import Layout from "@theme-original/DocItem/Layout";
import type LayoutType from "@theme/DocItem/Layout";
import type { WrapperProps } from "@docusaurus/types";
import Head from "@docusaurus/Head";
import { useDoc } from "@docusaurus/plugin-content-docs/client";

import {
  ORGANIZATION_ID,
  SITE_URL,
  WEBSITE_ID,
} from "@site/src/siteCopy.mjs";

type Props = WrapperProps<typeof LayoutType>;

/**
 * What the page is about, by section. A single value would be wrong on most
 * pages: calling the eSIM explainer a Solidity document is worse than saying
 * nothing, because it is a claim a retriever will act on.
 */
function subjectOf(docId: string) {
  if (docId.startsWith("SmartContracts/")) {
    return {
      about: { "@type": "Thing", name: "Ethereum smart contract" },
      programmingLanguage: "Solidity",
    };
  }
  if (docId.startsWith("eSIM/")) {
    return { about: { "@type": "Thing", name: "eSIM" } };
  }
  return { about: { "@type": "Thing", name: "Kokio" } };
}

export default function LayoutWrapper(props: Props): ReactNode {
  const { metadata } = useDoc();
  const url = `${SITE_URL}${metadata.permalink}`;

  const article = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    // The page URL, with no fragment. A fragment in an @id is a citation
    // target, so it has to match a real element id or the citation lands at
    // the top of the page anyway. Nothing here carries one.
    "@id": url,
    headline: metadata.title,
    ...(metadata.description ? { description: metadata.description } : {}),
    ...subjectOf(metadata.id),
    ...(metadata.lastUpdatedAt
      ? {
          dateModified: new Date(metadata.lastUpdatedAt)
            .toISOString()
            .split("T")[0],
        }
      : {}),
    inLanguage: "en",
    isPartOf: { "@id": WEBSITE_ID },
    // Defined once on the marketing site and referenced, never redefined
    // here, or the two hosts describe two different companies.
    publisher: { "@id": ORGANIZATION_ID },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
  };

  return (
    <>
      <Head>
        <script type="application/ld+json">{JSON.stringify(article)}</script>
      </Head>
      <Layout {...props} />
    </>
  );
}
