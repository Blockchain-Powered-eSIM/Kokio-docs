import type { ReactNode } from "react";
import Link from "@docusaurus/Link";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import Layout from "@theme/Layout";
import HomepageFeatures from "@site/src/components/HomepageFeatures";
import Heading from "@theme/Heading";

import Head from "@docusaurus/Head";

import styles from "./index.module.css";
import {
  DOCS_META_DESCRIPTION,
  DOCS_TITLE,
  WEBSITE_SCHEMA,
} from "@site/src/siteCopy.mjs";

const websiteSchema = { "@context": "https://schema.org", ...WEBSITE_SCHEMA };

function HomepageHeader() {
  const { siteConfig } = useDocusaurusContext();
  return (
    <header className={styles.heroBanner}>
      <div className="container">
        <img
          src="/images/beach-fun.svg"
          alt=""
          aria-hidden="true"
          className={styles.heroArt}
        />
        <p className={styles.eyebrow}>Documentation</p>
        <Heading as="h1" className={styles.title}>
          {siteConfig.title}
        </Heading>
        <p className={styles.subtitle}>{siteConfig.tagline}</p>
        <div className={styles.buttons}>
          <Link
            className={`button button--lg ${styles.primaryButton}`}
            to="/docs/kokio/landing-intro"
          >
            What is Kokio?
          </Link>
          <Link className="button button--outline button--lg" to="/docs/contracts/overview">
            Contract reference
          </Link>
        </div>
      </div>
    </header>
  );
}

export default function Home(): ReactNode {
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
