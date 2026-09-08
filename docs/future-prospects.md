---
title: Future prospects
description: "Where Kokio is heading: onboarding eSIM providers directly onchain, and a sketch of paying per request with x402."
---

# Future prospects {#future-prospects}

## Onboarding eSIM providers onchain {#onboarding-esim-providers-onchain}

Today Kokio sits in the middle. It deals with eSIM providers, processes the payment when someone buys an eSIM or a data bundle, and passes the money on to the provider that supplied it.

The plan is to bring the providers onchain themselves, so a buyer pays the provider directly and nobody holds the money in between. That drops a step, and it makes the payment something both sides can see. Kokio would still run the mobile app and the servers that talk to the provider APIs, so buying an eSIM would look no different to the person doing it.

## Paying for a request with x402 {#paying-for-a-request-with-x402}

HTTP has carried a 402 status code since version 1.1 and nothing has ever used it. x402 does. A server answers a request with 402 and a price, the client pays, sends the request again with the payment attached as proof, and gets its answer. No checkout page. Nobody clicking anything.

The point is machines buying from machines: an agent paying for one API call the way a person pays for a coffee. What makes it work is EIP-3009, a token transfer that a signature can authorise on its own without a transaction behind it. USDC implements it. As of 2026 the protocol is production-ready.

Most of what a paid endpoint needs underneath it is already deployed here. [`PaymentAdapter`](./contracts/payment-adapter.md) holds the list of currencies a purchase can be paid in, and it does the protocol's one conversion, US cents to a token amount. The [Registry](./contracts/registry.md) spends each payment reference once, so a call that gets retried cannot charge twice. Pricing and replay protection are the two hard parts of charging over HTTP, and both are contract code that already exists.

The HTTP layer does not exist yet. Something has to answer 402, name a price, and check the proof before it hands data back. The [backend](./kokio/tech-stack.md) is where that would live, since it already aggregates the provider APIs and reaches the contracts through the SDK, but nothing there does it today.

One question is still open, and code will not settle it. Every purchase now goes through a passkey signature from a device its owner is holding. An agent buying a data bundle would have no one present at the moment of payment. Whether that should be allowed has not been decided.
