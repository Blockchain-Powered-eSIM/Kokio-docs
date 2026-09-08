---
title: Principles and motivation
description: "Why Kokio was built the way it was, what it commits to as an open source project, and who it is for: people already holding crypto with little to spend it on, and people holding none."
---

# Principles and motivation {#principles-and-motivation}

Kokio is a travel eSIM app whose purchase records live onchain and whose wallets are controlled by a passkey on the user's phone. This page is about why it was built that way. For what it does rather than why, read [what is Kokio](./kokio/landing-intro.md).

## What the project commits to {#what-the-project-commits-to}

- **Open source.** The contracts, the SDK and this documentation are public. Anyone can check what the app does with a purchase instead of taking our word for it.
- **Friendly and practical.** Somebody buying a data plan for a trip should not have to learn what a wallet is. The onchain part is real and it is checkable, and it stays out of the way.
- **The [infinite garden](https://ethereum.foundation/infinitegarden).** Public infrastructure, contributed to as a shared resource rather than fenced off.

Privacy and control over your own data are the point rather than a feature. Buying mobile data should not require handing over a name, an address or an identity document, and Kokio asks for none of them.

## Who it is for {#who-it-is-for}

**People who already hold crypto** and have very little to spend it on. Mobile data is something everyone actually buys, it costs a few dollars, and Kokio takes stablecoins for it directly.

**People who hold none.** They pay by card, Apple Pay or Google Pay and never see a wallet. One is still created for them, their purchases are still recorded, and if they want the keys later the history is already there. [The lazy wallet registry](./contracts/lazy-wallet-registry.md) is the contract that makes that work.

**Both, in fewer steps than either is used to.** A purchase is authorised with a fingerprint or a face, signed by the phone's secure enclave, and submitted onchain with no seed phrase, no browser extension and no gas balance to top up.
