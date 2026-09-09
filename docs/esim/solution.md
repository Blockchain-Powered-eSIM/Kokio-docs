---
title: How Kokio solves it
description: "Kokio's answer to the problems with eSIMs: plans sourced from aggregators at local prices, purchase records kept onchain rather than in a provider database, and a wallet controlled by a passkey the provider never holds."
---

# How Kokio solves it {#how-kokio-solves-it}

Kokio is a self-custodial eSIM wallet. It answers [the problems with eSIMs](./problem.md) in three parts, and the third is the one that is hard to copy.

## Price {#price}

Roaming is expensive because you are buying from your home operator, at their rates, for time on somebody else's network. Kokio sells eSIMs sourced from aggregators and providers who already have local agreements, so a plan for a two-week trip is priced like local data rather than like roaming. Coverage runs to more than 200 destinations, with regional and global plans as well as single-country ones.

## The record {#the-record}

Every eSIM provider today keeps what you bought in a database of their own. You cannot read it, you cannot check it, and if the company is sold or shuts down your record goes with it. Kokio writes the purchase to a public blockchain instead. [The registry contract](../contracts/registry.md) holds it, anyone can read it, and nobody can quietly change it.

## The keys {#the-keys}

The wallet holding that record is an ERC-4337 smart account owned by a passkey generated in your phone's secure enclave. Kokio never has the key, so Kokio cannot move your eSIM, spend your balance or lock you out. Authorising a purchase is a fingerprint or a face. There is no password to phish and no seed phrase to lose.

Self-custodial is the whole point. You buy an eSIM without needing the provider to behave well, because there is nothing left for them to behave well about.
