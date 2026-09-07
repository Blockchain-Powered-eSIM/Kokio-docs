---
title: Backend-built calldata
description: How a Kokio backend can build the calldata for a purchase, have the mobile app sign it with its passkey, and track the result onchain rather than relying on a payment processor's webhook.
---

# Backend-built calldata {#backend-built-calldata}

How a Kokio backend can own a purchase from start to finish across all three ways a data bundle gets paid for: a crypto purchase from the user's own device wallet, a crypto purchase from somewhere else such as an onramp, and a card or wallet-app charge. Nothing here needs new SDK code. Every piece is either already exported by [`kokio-sdk`](./overview.md) or a standard viem call against what the SDK exposes.

This page assumes the encodings covered on the [backend payments](./backend/payments.md) page: prices in whole US cents, currencies as `bytes32`, and the `Settlement` enum.

## Why {#why}

Today a purchase is either signed and submitted entirely by the mobile app through [`kokio.eSIMWallet.buyDataBundleWithToken`](./mobile/esim-wallet.md#buydatabundlewithtoken), or paid outside the protocol and recorded afterwards through [`admin.registry.recordSettledPurchase`](./backend/registry.md#recordsettledpurchase), fed by a processor's webhook. Neither gives the backend a purchase it originates and tracks end to end onchain, and the two settled paths still lean on the processor's own webhook as the only source of truth for whether a payment happened.

Three pieces close that gap for the device wallet path: the backend builds the exact calldata a purchase needs, the mobile app signs and submits it as a user operation with the passkey it already holds, and the backend tracks that operation through the bundler and then confirms it from the chain's own event log. No new contract, no new SDK method.

| Settlement | Who signs what | How the backend confirms it |
|---|---|---|
| `DeviceWallet` | the app signs a user operation the backend built | three checkpoints: bundler acceptance, bundler receipt, then the `DataBundleBoughtWithToken` event |
| `ExternalWallet` | nobody signs onchain, the onramp already moved the crypto | one transaction: the backend's own `recordSettledPurchase`, confirmed by its receipt or the `DataBundleSettled` event |
| `Fiat` | nobody signs onchain, the processor already took the card charge | the same as `ExternalWallet` |

## Device wallet purchases {#device-wallet-purchases}

```text
backend                          mobile app                      chain
--------                         ----------                      -----
1. build calldata      ------>   2. sign + submit       ------>   included in a block
   (encodeFunctionData)             (sendUserOperation)               |
                                                                      v
3. track                <------------------------------------   DataBundleBoughtWithToken
   (bundler receipt,                                             (definitive)
    then the event log)
```

### 1. The backend builds the calldata {#build-calldata}

Pure encoding. No RPC call, no wallet client. `encodeFunctionData` against the `ESIMWallet` ABI the SDK already exports produces the exact bytes `buyDataBundleWithToken` expects.

```ts
import { encodeFunctionData } from "viem";
import { ESIMWallet } from "kokio-sdk/abis";
import { Settlement, type Call } from "kokio-sdk/types";

async function buildPurchaseCall(
  admin: KokioAdmin,
  eSIMWalletAddress: Address,
  bundleId: Hex,
  priceUSDCents: bigint,
  asset: Hex,
  paymentReference: Hex,
): Promise<Call> {
  // Quote on the backend so the app needs no extra read before it can sign.
  // Nothing moves the price between this quote and the purchase today.
  const maxAmountIn = await admin.paymentAdapter.quote(asset, priceUSDCents);

  const data = encodeFunctionData({
    abi: ESIMWallet,
    functionName: "buyDataBundleWithToken",
    args: [
      { id: bundleId, priceUSDCents, settlement: Settlement.DeviceWallet },
      asset,
      maxAmountIn,
      paymentReference,
    ],
  });

  return { to: eSIMWalletAddress, data }; // no value, the function is not payable
}
```

The return type, `Call`, is exactly the shape `sendUserOperation` takes: `{ to, value?, data? }`. Mint `paymentReference` here too and store it against the order before handing the call back, so a retry reuses the same reference instead of risking a double charge.

Expose this as an endpoint the app calls when the user taps buy. The response is one `Call` object, ready to sign.

### 2. The app signs and submits {#app-signs}

The app never sees `buyDataBundleWithToken`'s parameters, only the built call. It hands that to [`sendUserOperation`](./mobile/device-wallet.md#senduseroperation), the escape hatch on the device wallet surface.

```ts
const hash = await session.deviceWallet!.sendUserOperation([call]);
// hash is the user operation hash, return it to the backend right away
```

Everything ERC-4337 specific, the nonce, gas estimation, paymaster sponsorship and the passkey signature, is handled by the smart account client the same way as any other write on that surface. The backend's calldata is the only input, and the app does not need to know it came from a purchase flow rather than anywhere else.

### 3. The backend tracks it {#track}

Three checkpoints, weakest guarantee first.

**Submitted.** The app returns the user operation hash as soon as `sendUserOperation` resolves. Record it against the order now. It only means the bundler accepted the operation, not that it landed.

**Included.** Poll the bundler for the receipt. `KokioAdmin` holds a plain wallet client rather than a bundler client, so make one against the same bundler endpoint the app uses.

```ts
import { createBundlerClient } from "viem/account-abstraction";
import { http } from "viem";

const { pimlicoRpcURL, chain } = await admin.constants; // resolved from admin's own chain

const bundlerClient = createBundlerClient({ chain, transport: http(pimlicoRpcURL) });

const receipt = await bundlerClient.getUserOperationReceipt({ hash: userOpHash });
// null while pending; once non-null, receipt.success tells you whether the
// operation reverted onchain rather than merely landing
```

Poll on an interval, or once when a webhook or push tells the backend the app thinks it landed. `receipt.success === false` means the operation was included but its inner call reverted. That is a failed purchase, not a pending one.

**Confirmed.** The receipt says the operation landed. The event log says the purchase happened. `DataBundleBoughtWithToken` on `ESIMWallet` indexes `_asset`, `_token` and `_paymentReference`, so the reference minted in step 1 finds the exact purchase without scanning unrelated logs.

```ts
import { createPublicClient, http } from "viem";
import { ESIMWallet } from "kokio-sdk/abis";

const { rpcURL, chain } = await admin.constants;
const publicClient = createPublicClient({ chain, transport: http(rpcURL) });

const logs = await publicClient.getContractEvents({
  address: eSIMWalletAddress,
  abi: ESIMWallet,
  eventName: "DataBundleBoughtWithToken",
  args: { _paymentReference: paymentReference },
  fromBlock: submittedAtBlock, // narrow the range once you have it, avoid an unbounded scan
});

const confirmed = logs.length > 0;
```

`publicClient.watchContractEvent` with the same filter turns this into a push rather than a poll, for a backend that wants to update order state as soon as a block lands.

**A cheaper fallback.** If watching logs is more infrastructure than the order volume justifies, [`registry.usedPaymentReferences`](./backend/registry.md#usedpaymentreferences) answers the same question with one storage read, once the reference is scoped.

```ts
import { keccak256, encodeAbiParameters } from "viem";

const scopedReference = keccak256(encodeAbiParameters(
  [{ type: "address" }, { type: "bytes32" }],
  [eSIMWalletAddress, paymentReference],
));

const spent = await admin.registry.usedPaymentReferences(scopedReference);
```

This only says the reference was consumed, not what the purchase held. Use the event log when the order record needs the price, asset or amount. Use this when a boolean is enough.

## Fiat and external wallet purchases {#settled-purchases}

No calldata to build and no signature to hand the app. By the time either webhook fires, the payment already happened outside the protocol. The backend's only onchain action is `admin.registry.recordSettledPurchase`, one ordinary transaction it signs itself with the admin EOA. No bundler, no user operation, and no pending phase to poll: the transaction either lands or the promise throws.

### A card charge {#card-charge}

```ts
import { Settlement } from "kokio-sdk/types";
import { keccak256, toBytes } from "viem";
import { ASSETS } from "./assets";

app.post("/webhooks/stripe", async (req, res) => {
  const event = stripe.webhooks.constructEvent(
    req.body, req.headers["stripe-signature"], process.env.STRIPE_WEBHOOK_SECRET!,
  );

  if (event.type === "charge.succeeded") {
    const charge = event.data.object;
    const order = await ordersDb.findByStripeChargeId(charge.id);

    // Nothing needs this reference before the payment is confirmed, so
    // minting it here is fine as long as it stays unique per order.
    const paymentReference = keccak256(toBytes(order.id));
    await ordersDb.update(order.id, { paymentReference, status: "settling" });

    const hash = await admin.registry.recordSettledPurchase(
      order.eSIMWalletAddress,
      {
        id: order.bundleId,
        priceUSDCents: order.priceUSDCents,
        settlement: Settlement.Fiat,
      },
      ASSETS.USD.symbol,   // fiat, not a token
      order.priceUSDCents, // USD's own decimals are 2, matching cents exactly
      paymentReference,
    );

    await confirmSettledPurchase(hash, order.id, order.eSIMWalletAddress, paymentReference);
  }

  res.sendStatus(200);
});
```

### An onramp purchase {#onramp-purchase}

Real crypto moved here, just not out of the device wallet, so use the onramp's own reported crypto amount for `tokenAmount`.

```ts
app.post("/webhooks/moonpay", async (req, res) => {
  const payload = verifyMoonPaySignature(req);

  if (payload.data.status === "completed") {
    const order = await ordersDb.findByMoonPayTransactionId(payload.data.id);
    const paymentReference = keccak256(toBytes(order.id));
    await ordersDb.update(order.id, { paymentReference, status: "settling" });

    const hash = await admin.registry.recordSettledPurchase(
      order.eSIMWalletAddress,
      {
        id: order.bundleId,
        priceUSDCents: order.priceUSDCents,
        settlement: Settlement.ExternalWallet,
      },
      ASSETS.USDC.symbol,                       // whatever crypto was actually delivered
      BigInt(payload.data.quoteCurrencyAmount), // in USDC's smallest unit
      paymentReference,
    );

    await confirmSettledPurchase(hash, order.id, order.eSIMWalletAddress, paymentReference);
  }

  res.sendStatus(200);
});
```

### Confirming either one {#confirming}

One transaction, so a single wait rather than three checkpoints. Two equally valid ways, so pick whichever fits how the backend already tracks work.

```ts
import { createPublicClient, http } from "viem";
import { Registry } from "kokio-sdk/abis";

async function confirmSettledPurchase(
  hash: Hash, orderId: string, eSIMWalletAddress: Address, paymentReference: Hex,
) {
  const { rpcURL, chain, factoryAddresses } = await admin.constants;
  const publicClient = createPublicClient({ chain, transport: http(rpcURL) });

  // Option A: wait on the transaction. Simplest, and enough for most needs.
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status === "reverted") {
    await ordersDb.update(orderId, { status: "failed" });
    return;
  }

  // Option B: confirm from the event log, same as the device wallet path's
  // step 3. Worth adding when the order record wants the emitted details.
  const logs = await publicClient.getContractEvents({
    address: factoryAddresses.REGISTRY,
    abi: Registry,
    eventName: "DataBundleSettled",
    args: { _eSIMWallet: eSIMWalletAddress, _paymentReference: paymentReference },
    fromBlock: receipt.blockNumber,
    toBlock: receipt.blockNumber,
  });

  await ordersDb.update(orderId, { status: logs.length > 0 ? "confirmed" : "failed" });
}
```

## What this does and does not give you {#scope}

It gives an order lifecycle the backend fully owns across all three payment paths, submitted, pending for device wallet purchases only, confirmed, or failed, driven entirely by data the backend can already read, with no dependency on a payment processor's webhook reliability for the onchain leg.

It replaces the tracking role a processor plays today, not the payment itself. A processor is still how money or crypto changes hands for the external wallet and fiat paths, and the user's device wallet still has to hold the token being spent for the device wallet path. What changes is who tracks the purchase once payment has happened, and that the backend gets one order-tracking model instead of three.

## Failure modes worth handling {#failure-modes}

**A dropped user operation.** The bundler accepted it but it never lands. Set a timeout on the pending state, a few minutes is reasonable on Base Sepolia, and expose a retry that rebuilds the call with the same `paymentReference`. `usedPaymentReferences` blocks a genuine double spend, so a retry against an already confirmed reference reverts instead of charging twice.

**A reverted inclusion.** `receipt.success === false`. Decode the revert the same way as any other contract call, with `decodeContractRevert` from `kokio-sdk`. A stale quote above `priceCapUSDCents`, an insufficient token balance, or a paused protocol are the likely causes.

**A reference collision.** Two orders racing for the same reference is a backend bug rather than a chain concern. Derive it from something already unique per order, such as the order's own database id, and confirm that uniqueness in your own database before it reaches the chain.

**A duplicate webhook.** Processors redeliver. Check the order's current status before calling `recordSettledPurchase` again. If it already ran, the reference is already spent and a second attempt reverts rather than double-recording, but skipping the call avoids spending gas on a transaction that was always going to fail.
