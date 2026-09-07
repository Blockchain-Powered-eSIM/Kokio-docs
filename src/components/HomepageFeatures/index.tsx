import type {ReactNode} from 'react';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

type FeatureItem = {
  title: string;
  image: string;
  description: ReactNode;
};

const FeatureList: FeatureItem[] = [
  {
    title: 'Easy to Use',
    image: '/images/feature-easy-to-use.png',
    description: (
      <>
        Set up your mobile plan in a few taps. Provisioning your device wallet happens in the background, so there is nothing extra to configure.
      </>
    ),
  },
  {
    title: 'eSIM Wallet',
    image: '/images/feature-esim-wallet.png',
    description: (
      <>
        Buying your first Kokio data bundle creates an eSIM wallet that holds the plan. You own it, not a provider database, and you never handle a seed phrase.
      </>
    ),
  },
  {
    title: 'Quick Pay',
    image: '/images/feature-quick-pay.png',
    description: (
      <>
        Pay by card, Apple Pay, Google Pay or stablecoins. No KYC, and no personal information collected at checkout.
      </>
    ),
  },
];

function Feature({title, image, description}: FeatureItem) {
  return (
    <div className="col col--4">
      <div className="text--center">
        <img src={image} className={styles.featureImg} alt={title} />
      </div>
      <div className="text--center padding-horiz--md">
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures(): ReactNode {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
