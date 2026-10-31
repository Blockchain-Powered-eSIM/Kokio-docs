---
title: How Kokio solves it
description: "Kokio's answer to the problems with eSIMs: plans sourced from aggregators at local prices, purchase records kept onchain rather than in a provider database, a wallet controlled by a passkey the provider never holds, and no personal details asked for."
---

# How Kokio solves it {#how-kokio-solves-it}

Local prices, a purchase record anyone can read, keys only you hold, and no personal details.

---

Kokio is a **self-custodial** eSIM wallet: the user holds the only key. It answers [the problems with eSIMs](./problem.md) in four parts, and the third is the one that is hard to copy.

## Price {#price}

Roaming is expensive because you are buying from your home operator, at their rates, for time on somebody else's network.

Kokio sells eSIMs sourced from aggregators and providers who already have local agreements, so a plan for a two-week trip is priced like local data rather than like roaming. Coverage runs to more than 200 destinations, with regional and global plans as well as single-country ones.

## The record {#the-record}

Every eSIM provider today keeps what you bought in a database of their own. You cannot read it, you cannot check it, and if the company is sold or shuts down your record goes with it. Kokio writes the purchase to a public blockchain instead. Your [eSIM wallet](../contracts/esim-wallet.md) contract holds it, and anyone can read it.

## The keys {#the-keys}

The wallet holding that record is an ERC-4337 smart account owned by a passkey generated in your phone's secure enclave. Authorising a purchase is a fingerprint or a face. There is no password to phish and no seed phrase to lose.

:::note
Kokio never has the key, so it cannot sign for you or move your eSIM to another device. Kokio's admin key cannot charge your eSIM wallet unless you give it a spending allowance. A new eSIM wallet starts with none, and any allowance you set is still held to a price cap on each purchase.
:::

## Privacy {#privacy}

Kokio does not ask for your name, email, phone number, Aadhaar, passport or any other personal details. Buying a plan needs none of them.

What goes onchain names a wallet, not a person:

| Recorded onchain | What it is |
|---|---|
| The passkey's public key | The `x` and `y` co-ordinates of a P-256 key. Your fingerprint or face unlocks the private key on your phone, and neither the biometric nor the private key ever leaves it |
| A device identifier and an eSIM identifier | The ids the wallets are registered under. The eSIM identifier is a UUID |
| Each purchase | The bundle id, its price in US cents, and how it was paid for |

None of these carries your name or identity documents, so the record does not point back to you as a person.

:::note
The record is public. Anyone who already knows which wallet is yours can read its purchases. A payment sent from a wallet that is linked to you elsewhere, such as an exchange account, can tie that payment to you.
:::
