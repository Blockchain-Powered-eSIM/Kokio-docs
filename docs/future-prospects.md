---
title: Future prospects
description: "Where Kokio is heading: onboarding eSIM providers directly onchain, and a sketch of paying per request with x402."
---

# Future prospects {#future-prospects}

## Onboarding eSIM providers onchain {#onboarding-esim-providers-onchain}

Currently, Kokio operates as an intermediary, partnering with eSIM providers to facilitate transactions. When users purchase eSIMs or data bundles, Kokio collects the payments and transfers them to the respective eSIM provider.

In the future, Kokio aims to onboard eSIM providers directly onchain, eliminating the need for a middleman. This will enable users to make payments directly to the eSIM providers, enhancing transparency and reducing friction in the transaction process. Kokio will continue to maintain the mobile app and the servers that integrate with the eSIM provider partner APIs, so the app keeps working the same way for the user.

## Paying for a request with x402 {#paying-for-a-request-with-x402}

x402 is a payment protocol built on the HTTP 402 status code, the one that has sat unused in the HTTP spec since HTTP/1.1. A server answers a request with 402 and a set of payment terms, the client pays, retries the request with proof of payment attached, and gets the resource. It targets machine-to-machine commerce: an agent paying for an API call the way a person pays for a coffee, with no checkout page and no human in the loop. It works because of EIP-3009, a token transfer authorised by a signature rather than a transaction, which USDC implements. As of 2026 the protocol is production-ready.

The fit with Kokio is closer than it looks, because of what already exists rather than what would need to be built. [`PaymentAdapter`](./contracts/payment-adapter.md) already holds the currencies a purchase can be paid in, and already does the one conversion in the protocol from a price in US cents to a token amount. The [Registry](./contracts/registry.md) already spends each payment reference once, so a retried call cannot charge twice. Those are the pieces a paid HTTP endpoint needs underneath it, and in Kokio's case they are contract code already deployed rather than something an x402 integration would have to invent.

What is missing is the HTTP layer itself: a server that answers 402, states a price, and checks the proof of payment before returning data. The [backend](./kokio/tech-stack.md) is the natural place for that, since it already aggregates provider APIs and reaches the contracts through the SDK, but nothing there does this today. There is also a decision nobody has made yet: whether an agent should be able to buy a data bundle on a user's behalf with no person present at the moment of payment, given that every purchase today runs through a passkey signature from a device the user is holding.

None of this is built. Nothing is scheduled, and there is no date. This is a direction, not a plan.
