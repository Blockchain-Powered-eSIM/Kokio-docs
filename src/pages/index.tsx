import clsx from "clsx";
import Link from "@docusaurus/Link";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import Layout from "@theme/Layout";
import HomepageFeatures from "@site/src/components/HomepageFeatures";
import Heading from "@theme/Heading";

import Head from "@docusaurus/Head";

import styles from "./index.module.css";
import {
  DOCS_DESCRIPTION,
  DOCS_META_DESCRIPTION,
  DOCS_TITLE,
  ORGANIZATION_ID,
  PRODUCT_NAME_VARIANTS,
  SITE_URL,
  WEBSITE_ID,
} from "@site/src/siteCopy.mjs";

const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": WEBSITE_ID,
  url: SITE_URL,
  name: DOCS_TITLE,
  description: DOCS_DESCRIPTION,
  // Every spelling people actually type has to resolve to this product.
  alternateName: PRODUCT_NAME_VARIANTS.map((v) => `${v} documentation`),
  publisher: { "@id": ORGANIZATION_ID },
  inLanguage: "en",
};

function HomepageHeader() {
  const { siteConfig } = useDocusaurusContext();
  return (
    <header className={clsx("hero hero--primary", styles.heroBanner)}>
      <div className="container">
        <Heading as="h1" className="hero__title">
          {siteConfig.title}
        </Heading>
        <p className="hero__subtitle">{siteConfig.tagline}</p>
        <div className={styles.buttons}>
          <Link
            className="button button--secondary button--lg"
            to="/docs/kokio/landingIntro"
          >
            What is Kokio?
          </Link>
        </div>
      </div>
    </header>
  );
}

export default function Home(): JSX.Element {
  return (
    <Layout title={DOCS_TITLE} description={DOCS_META_DESCRIPTION}>
      <Head>
        <script type="application/ld+json">
          {JSON.stringify(websiteSchema)}
        </script>
      </Head>
      <HomepageHeader />
      <main>
        <HomepageFeatures />
      </main>
    </Layout>
  );
}
