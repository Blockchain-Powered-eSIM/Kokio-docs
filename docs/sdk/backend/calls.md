---
title: Calls (backend)
description: admin.calls builds the calls a user's device wallet signs as one user operation, so a backend can prepare a purchase or an eSIM handover and hand it to the app to sign.
---

# Calls (backend) {#calls-backend}

`admin.calls`

Builds the calls a user's device wallet signs as one user operation. Nothing is signed or sent here. The backend returns the calls to the app, and the app passes them to [`kokio.deviceWallet.sendUserOperation`](../mobile/device-wallet.md#senduseroperation). Use it when a mobile SDK method batches several calls and the backend wants to keep that logic on its side.

Every method takes the target address as an argument, so one `KokioAdmin` builds calls for any user without `setESIMWalletAddress`.

```ts
import { Settlement } from "kokio-sdk/types";

// Backend, in the "buy" endpoint
const calls = await admin.calls.buyDataBundleWithTransfer(
  eSIMWalletAddress,
  { id: bundleId, priceUSDCents: 500n, settlement: Settlement.DeviceWallet },
  asset,
  maxAmountIn,
  paymentReference,
);
return calls; // plain { to, data } strings, safe to send as JSON

// App
const userOpHash = await kokio.deviceWallet!.sendUserOperation(calls);
```

## buyDataBundleWithTransfer {#buydatabundlewithtransfer}

Builds the same calls as [`kokio.eSIMWallet.buyDataBundleWithTransfer`](../mobile/esim-wallet.md#buydatabundlewithtransfer): an ERC-20 `transfer` from the device wallet for whatever the eSIM wallet is short of the quote, then `buyDataBundleWithToken`. When the eSIM wallet already holds enough, only the purchase is returned. The arguments after the address are the same as `buyDataBundleWithToken`.

```ts
import { stringToHex } from "viem";

const asset = stringToHex("USDC", { size: 32 });
const maxAmountIn = await admin.paymentAdapter.quote(asset, 500n);

const calls = await admin.calls.buyDataBundleWithTransfer(
  eSIMWalletAddress,
  { id: bundleId, priceUSDCents: 500n, settlement: Settlement.DeviceWallet },
  asset,
  maxAmountIn,
  paymentReference,
);
```

The shortfall is worked out from the eSIM wallet's balance and the quote when the calls are built. If either changes before the user signs, the operation reverts. On a retry, build the calls again with the same `paymentReference` rather than resending the old ones.

The purchase emits `DataBundleBoughtWithToken` on the eSIM wallet, the same event as a plain `buyDataBundleWithToken`, so a webhook filtering on that event and `_paymentReference` needs no change. The user signs this purchase, so it does not spend the wallet's admin allowance.

Returns `Promise<Call[]>`, one or two `{ to, data }` entries.

## acceptAndBindESIMWallet {#acceptandbindesimwallet}

Builds the calls a new device wallet signs to take over an eSIM wallet: `acceptOwnershipTransfer` on the eSIM wallet, then `addESIMWallet` on the new device wallet, which also updates the registry and clears the standby flag. Pass `grantAccessToFunds: true` to add a `toggleAccessToFunds` after the bind. These are the same calls as [`kokio.eSIMWallet.acceptAndBindESIMWallet`](../mobile/esim-wallet.md#acceptandbindesimwallet).

Build them when the old device's `requestTransferOwnership` emits `OwnershipTransferRequested` on the eSIM wallet. Its `_newOwner` is the device wallet that has to sign, and that device wallet must already be registered with `admin.deviceWalletFactory.postCreateAccount`.

```ts
// Backend, when the webhook delivers OwnershipTransferRequested(_currentOwner, _newOwner)
const calls = admin.calls.acceptAndBindESIMWallet(
  eSIMWalletAddress,
  newDeviceWalletAddress, // _newOwner
  { grantAccessToFunds: true },
);

// App, on the new device
const userOpHash = await kokio.deviceWallet!.sendUserOperation(calls);
```

The operation reverts if any other device wallet signs it, or if the old device cancelled the transfer first.

Returns `Call[]`, two or three `{ to, data }` entries. Nothing is read, so this one is synchronous.
