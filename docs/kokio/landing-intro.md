---
sidebar_position: 1
title: What is Kokio
description: Kokio is a travel eSIM app that takes card, Apple Pay, Google Pay or stablecoins, works without a password or a seed phrase, and records every purchase onchain in a wallet the buyer controls.
---

# What is Kokio {#what-is-kokio}

Kokio is a travel eSIM app. Pick a data plan for where you are going, pay with a card or with crypto, and install the eSIM on your phone. Coverage runs to more than 200 destinations, with regional and global plans alongside single-country ones.

Two things separate it from every other eSIM app.

## No password and no seed phrase {#no-password-and-no-seed-phrase}

You authenticate with your fingerprint or your face. The key that signs for you is a passkey generated in your phone's secure enclave, and it never leaves the device. Kokio does not have a copy, which is what stops Kokio spending your money or taking your eSIM back.

The first time you buy, the app creates a [smart account](../contracts/device-wallet.md) owned by that passkey. It is an ERC-4337 wallet rather than a closed-off balance, so it works with the rest of the onchain ecosystem and you can use it as an everyday wallet, not only for eSIMs.

## The purchase record is yours {#the-purchase-record-is-yours}

Every purchase is written onchain, to a wallet you own, instead of into a row in a provider's database. You can read it, check it and move it between your own devices without asking anyone. [The registry](../contracts/registry.md) is the contract that holds it.

Paying with a card does not opt you out. Card purchases are recorded too, held against your device until you want a wallet, then copied across the moment one exists. Starting with fiat and moving to crypto later costs you no history.

The same records work in the other direction as well. For a telecom operator they are a shared, verifiable ledger of what was sold, which is easier to integrate against than a separate private API per partner.
