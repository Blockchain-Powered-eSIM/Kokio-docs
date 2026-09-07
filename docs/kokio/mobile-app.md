---
title: Mobile app flow
description: "What happens in the Kokio app from installing it to using the eSIM: passkey registration, device and eSIM wallet deployment, buying a data bundle with crypto or fiat, and the three ways to install the profile."
---

# Mobile app flow {#mobile-app-flow}

The Kokio app is where a user does everything: registers a passkey, gets a wallet, buys a data bundle and installs the eSIM. This page follows that path in order. The pieces behind it are described in [the tech stack](./tech-stack.md), and the contracts each step touches are under [smart contracts](../contracts/overview.md).

## Checkout {#checkout}

![Flowchart of buying a plan in the Kokio app. Select an eSIM plan, then checkout, which reads the catalogue and the price from the backend. The flow then forks on whether this is a new user. A returning user pays by credit card or from their own device wallet. A new user pays by credit card or from a third-party wallet, since they have no device wallet yet, and after payment the app gets the eSIM and data bundle from the backend and deploys and funds a device wallet for them. The backend is labelled as the eSIM API aggregator.](../../resources/kokio-user-flow-mobile-app.png)

The same flow in text:

| Stage | What happens |
|---|---|
| Select eSIM plan | The user picks from the catalogue the backend aggregates out of the eSIM provider APIs |
| Checkout | The app reads the plan and its price back from the backend |
| Is this a new user? | The flow forks here, on whether the user already has a device wallet |
| Payment method, returning user | Credit card, or their own [device wallet](../contracts/device-wallet.md) |
| Payment method, new user | Credit card, or a third-party wallet. There is no device wallet to pay from yet |
| Make payment | Card payments settle offchain, wallet payments settle onchain through the [payment adapter](../contracts/payment-adapter.md) |
| Get eSIM and data bundle | The backend orders the profile from the provider once the payment has settled |
| Deploy and fund wallet | A new user's device wallet is deployed and funded out of the same payment |

## Step by step {#step-by-step}

1. **Install the app and register a passkey.** The passkey is a P-256 key generated in the device's secure enclave. It never leaves the phone, and it is the only thing that can authorise anything that follows.

2. **Deploy the wallets.** On a new device the app asks for a [device wallet](../contracts/device-wallet.md) and an [eSIM wallet](../contracts/esim-wallet.md), which are linked to each other as they are deployed. Both addresses can be computed before either exists, so the app can show them straight away.

3. **Choose a data bundle and pay for it.** The plan is picked before the eSIM is generated, and how the purchase settles depends on how it is paid for.

   - Paid in crypto, the wallet is deployed and funded there and then.
   - Paid in fiat, the purchase is recorded against the device and the wallet can be deployed later, whenever the user wants it. [The lazy wallet registry](../contracts/lazy-wallet-registry.md) holds the history until then.
   - Once the payment settles, the server orders the eSIM and the data bundle from the provider.
   - The purchase gets a unique identifier, which is what ties the onchain record to the provisioned profile.

4. **Install the eSIM.** Three ways, and the user picks one:

   - scan a QR code,
   - enter the eSIM details by hand in the device settings,
   - or tap **install** in the app and let it do the rest.

5. **Keep using the wallet.** The device wallet is an ordinary ERC-4337 smart account, so it works across DeFi as a primary wallet, and funds move between a user's wallets whenever they want.
