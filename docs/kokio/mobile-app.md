---
title: Mobile app flow
description: "What happens in the Kokio app from installing it to using the eSIM: passkey registration, device and eSIM wallet deployment, buying a data bundle with crypto or fiat, and the three ways to install the profile."
---

# Mobile app flow {#mobile-app-flow}

What happens in the Kokio app, from installing it to using the eSIM.

---

The Kokio app is where a user does everything: registers a passkey, gets a wallet, buys a data bundle and installs the eSIM. The pieces behind it are described in [the tech stack](./tech-stack.md), and the contracts each step touches are under [smart contracts](../contracts/overview.md).

## Checkout {#checkout}

Buying a plan runs in this order:

| Stage | What happens |
|---|---|
| Select eSIM plan | The user picks from the catalogue the backend aggregates out of the eSIM provider APIs |
| Checkout | The app reads the plan and its price back from the backend |
| Is this a new user? | The flow forks here, on whether the user already has a device wallet |
| Payment method, returning user | Credit card, stablecoins from their own [device wallet](../contracts/device-wallet.md), or **Other crypto wallet** |
| Payment method, new user | Credit card, stablecoins from a device wallet, or **Other crypto wallet**. To pay from a device wallet, the app deploys one if the user does not have one yet, and the user funds it by sending USDC, USDT or DAI from any wallet they already hold |
| Make payment | Card payments settle offchain, wallet payments settle onchain through the [payment adapter](../contracts/payment-adapter.md) |
| Get eSIM and data bundle | The backend orders the profile from the provider once the payment has settled |

## Step by step {#step-by-step}

1. **Install the app and register a passkey.** The passkey is a P-256 key generated in the device's secure enclave. It never leaves the phone.

   :::note
   The passkey is the only key that can sign for the user's device wallet.
   :::

2. **Deploy the wallets.** On a new device the app asks for a [device wallet](../contracts/device-wallet.md) and an [eSIM wallet](../contracts/esim-wallet.md), which are linked to each other as they are deployed. Both addresses can be computed before either exists, so the app can show them straight away.

3. **Choose a data bundle and pay for it.** The plan is picked before the eSIM is generated, and how the purchase settles depends on how it is paid for.

   - Paid in crypto, there are two options:
     - **Device wallet.** Pay with a supported stablecoin from the device wallet. A user without one deploys it in the app, then funds it by sending USDC, USDT or DAI from any wallet they already hold.
     - **Other crypto wallet.** Pay with tokens on other chains, EVM and non-EVM, through MoonPay, which handles the multi-chain payment options.
   - Paid in fiat by a user with no device wallet, the purchase is recorded against the device in [the lazy wallet registry](../contracts/lazy-wallet-registry.md). When the user deploys their device wallet, every recorded purchase is copied onto it. From then on, every purchase, fiat or crypto, goes through the device wallet.
   - Once the payment settles, the server orders the eSIM and the data bundle from the provider.
   - The purchase gets a unique identifier, which is what ties the onchain record to the provisioned profile.

4. **Install the eSIM.** Three ways, and the user picks one:

   - scan a QR code,
   - enter the eSIM details by hand in the device settings,
   - or tap **install** in the app and let it do the rest.

5. **Keep using the wallet.** The device wallet is an ordinary ERC-4337 smart account, so it works across DeFi as a primary wallet, and funds move between a user's wallets whenever they want.
