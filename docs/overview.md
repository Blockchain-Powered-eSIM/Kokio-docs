---
title: Kokio and the eSIM stack
description: Kokio is an open source travel eSIM app built on passkeys and smart contracts. What the project is, the three layers every eSIM runs on, and where Kokio sits in them.
---

# Kokio and the eSIM stack {#kokio-and-the-esim-stack}

What Kokio is, and where it sits in the stack every eSIM runs on.

---

Kokio is a travel eSIM app. You buy a data plan for wherever you are going, it installs on your phone as an eSIM, and the record of what you bought is written to a public blockchain instead of a provider's database.

There is no account and no password, and nothing asks for a name or a document scan.

:::note
The wallet holding your purchase record is controlled by a passkey on your phone. Kokio's admin key cannot charge it for anything unless you give it a spending allowance. A new eSIM wallet starts with none, and any allowance you set is still held to a price cap on each purchase.
:::

The project is open source, and it sits where mobile telecoms and blockchain overlap. It takes three things from those two worlds:

- eSIMs, so a plan can be bought and installed remotely, with no plastic card and no shop
- a public chain, so a purchase is recorded somewhere the buyer can read and the seller cannot quietly edit
- passkeys and P-256 cryptography, so the phone's secure enclave holds the only key that can sign for the wallet

![How Kokio works. The Kokio app on the phone signs in with a passkey and Face ID, with no seed phrase, and the user approves each purchase with Face ID. The Kokio backend sets up the user's Kokio wallet, gets the eSIM from the network provider, records card and coupon payments, and cannot change protocol rules. On Base, one Kokio wallet per phone holds USDC, USDT or DAI and owns one eSIM wallet per eSIM. Each eSIM wallet pays for its data bundles, keeps the full purchase history and can move to a new phone, and the registry checks that each order is paid only once. The payment adapter turns the USD price into the exact token amount and sends it to the Kokio vault, a 2-of-3 multisig. Protocol rules change only after a 2-day public wait, and the emergency pause cannot move anyone's money.](../resources/how-kokio-works-clean.png)

## The three layers of an eSIM {#the-three-layers-of-an-esim}

Every eSIM runs on the same three pieces, Kokio's included.

| Layer | What it is | Where it runs |
|---|---|---|
| LPA, Local Profile Assistant | Downloads and installs profiles, and manages the ones already on the device | The phone, in the OS or an app |
| RSP, Remote SIM Provisioning | The servers and the protocol that prepare a profile and deliver it | The operator's side |
| eUICC, Embedded Universal Integrated Circuit Card | The chip that stores profiles and switches between them | Soldered into the phone |

[How eSIM provisioning works](./esim/working.md) walks the same three layers in the order a purchase moves through them.

Kokio is the app on top. It is the entry point a user buys through, and it adds a fourth piece the standard stack does not have: a suite of [smart contracts](./contracts/overview.md) holding the ownership record.

## Next steps {#next-steps}

- See [how eSIM provisioning works](./esim/working.md), layer by layer.
- Read the [smart contracts overview](./contracts/overview.md).
- Build against the protocol with the [Kokio SDK](./sdk/overview.md).
