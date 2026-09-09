---
title: Tech stack
description: "The three pieces Kokio runs on: a React Native app signing with passkeys, a suite of ERC-4337 wallet contracts on Base, and a Node.js backend aggregating eSIM provider APIs."
---

# Tech stack {#tech-stack}

Kokio is three pieces: an app on the phone, a suite of contracts on Base, and a backend sitting between them and the eSIM providers. This page says what each one is and where the boundaries between them are. [The mobile app flow](./mobile-app.md) walks the same system in the order a purchase moves through it.

## Mobile application {#mobile-application}

React Native, and the only part a user ever sees.

- **Onboarding is a passkey.** Registering generates a P-256 key in the phone's secure enclave through [`react-native-passkey`](https://github.com/f-23/react-native-passkey). No password, no seed phrase, no recovery file.
- **Fiat payments**: credit and debit cards, Apple Pay, Google Pay, and other digital wallet and QR methods.
- **Crypto payments**: stablecoins from the user's own wallet, with an on-ramp for buying them inside the app.
- **Signing is biometric.** A purchase is a WebAuthn assertion over the transaction, authorised with a fingerprint or a face. The app builds it through the [Kokio SDK](../sdk/mobile/setup.md), which wraps [viem](https://viem.sh) and a bundler, so the app never holds a private key or a gas balance.

## Smart contract suite {#smart-contract-suite}

Eighteen Solidity units, deployed on Base Sepolia. [The wallet suite overview](../contracts/overview.md) covers all of them. The shape is:

- **A wallet per device and a wallet per eSIM.** Both are ERC-4337 smart accounts, deployed by factories at addresses that can be computed before the wallets exist. An eSIM can move between devices without moving anything else.
- **[A registry](../contracts/registry.md)** mapping a user's device and eSIM identifiers to those wallets, and holding the purchase history.
- **[A lazy wallet registry](../contracts/lazy-wallet-registry.md)** recording purchases for users who paid by card and have no wallet yet, then copying the history across once wallets exist.
- **Passkey verification onchain**, through the [P256 verifier](../contracts/p256-verifier.md) and the [WebAuthn library](../contracts/webauthn.md), which use the RIP-7212 precompile where the chain has one and fall back to a Solidity implementation where it does not.
- **Ownership behind a timelock**, [ProtocolAdmin](../contracts/protocol-admin.md), so no upgrade or parameter change lands without a delay anyone can watch.

Both the app and the backend reach all of this through the [Kokio SDK](../sdk/overview.md) rather than assembling calldata by hand.

## Unified backend service {#unified-backend-service}

Node.js, doing the work that can happen neither on the phone nor onchain.

- **Aggregates providers.** Kokio does not run a mobile network. The backend integrates the supplier and aggregator APIs that issue eSIM profiles, and presents them to the app as one catalogue of plans.
- **Provisions the eSIM.** Once a purchase settles it orders the profile from the provider and returns the QR code or install details the app shows the user.
- **Records what the chain cannot see.** A card payment leaves no onchain proof, so the backend writes it in through [the SDK's admin entry point](../sdk/backend/setup.md). That key deploys wallets for users and records settled purchases, which is why it belongs on a server you control and never in an app bundle.

The backend can write history and deploy wallets. It cannot take a user's eSIM, spend from their wallet or upgrade a contract: those need either the user's passkey or the [timelock](../contracts/protocol-admin.md).
