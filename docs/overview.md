---
title: Kokio and the eSIM stack
description: Kokio is an open source travel eSIM app built on passkeys and smart contracts. What the project is, the three layers every eSIM runs on, and where Kokio sits in them.
---

# Kokio and the eSIM stack {#kokio-and-the-esim-stack}

Kokio is a travel eSIM app. You buy a data plan for wherever you are going, it installs on your phone as an eSIM, and the record of what you bought is written to a public blockchain instead of a provider's database. There is no account and no password, and nothing asks for a name or a document scan. The wallet holding that record is controlled by a passkey on your phone, so it belongs to you and Kokio cannot spend from it.

The project is open source, and it sits where mobile telecoms and blockchain overlap. It takes three things from those two worlds:

- eSIMs, so a plan can be bought and installed remotely, with no plastic card and no shop
- a public chain, so a purchase is recorded somewhere the buyer can read and the seller cannot quietly edit
- passkeys and P-256 cryptography, so the phone's secure enclave is the only thing that can authorise a purchase

## The three layers of an eSIM {#the-three-layers-of-an-esim}

Every eSIM runs on the same three pieces, Kokio's included.

| Layer | What it is | Where it runs |
|---|---|---|
| LPA, Local Profile Assistant | Downloads and installs profiles, and manages the ones already on the device | The phone, in the OS or an app |
| RSP, Remote SIM Provisioning | The servers and the protocol that prepare a profile and deliver it | The operator's side |
| eUICC, Embedded Universal Integrated Circuit Card | The chip that stores profiles and switches between them | Soldered into the phone |

[How eSIM provisioning works](./esim/working.md) walks the same three layers in the order a purchase moves through them.

Kokio is the app on top. It is the entry point a user buys through, and it adds a fourth piece the standard stack does not have: a suite of [smart contracts](./contracts/overview.md) holding the ownership record.
