---
title: Calls (backend)
description: admin.calls builds the calls a user's device wallet signs as one user operation, so a backend can prepare a purchase or an eSIM handover and hand it to the app to sign.
---

# Calls (backend) {#calls-backend}

Reference for `admin.calls`: build on the backend the calls a user's device wallet signs in the app.

---

`admin.calls`

Builds the calls a user's device wallet signs as one user operation. Use it when a mobile SDK method batches several calls and the backend wants to keep that logic on its side.

1. The backend builds the calls and returns them to the app. Nothing is signed or sent on the backend.
2. The app passes them to [`kokio.deviceWallet.sendUserOperation`](../mobile/device-wallet.md#senduseroperation).

Every method takes the target address as an argument, so one `KokioAdmin` builds calls for any user without `setESIMWalletAddress`.

```ts title="Backend builds, app signs"
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

Builds the same calls as [`kokio.eSIMWallet.buyDataBundleWithTransfer`](../mobile/esim-wallet.md#buydatabundlewithtransfer):

1. An ERC-20 `transfer` from the device wallet for whatever the eSIM wallet is short of the quote. Left out when the eSIM wallet already holds enough.
2. `buyDataBundleWithToken`.

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

| Name | Type | Description |
| :--- | :--- | :--- |
| eSIMWalletAddress | `Address` | The eSIM wallet buying the bundle |
| dataBundleDetails, asset, maxAmountIn, paymentReference | | The same as [`buyDataBundleWithToken`](../mobile/esim-wallet.md#buydatabundlewithtoken) |

:::warning
The shortfall is worked out from the eSIM wallet's balance and the quote when the calls are built. If either changes before the user signs, the operation reverts. On a retry, build the calls again with the same `paymentReference` rather than resending the old ones.
:::

The purchase emits `DataBundleBoughtWithToken` on the eSIM wallet, the same event as a plain `buyDataBundleWithToken`, so a webhook filtering on that event and `_paymentReference` needs no change. The user signs this purchase, so it does not spend the wallet's admin allowance.

Returns `Promise<Call[]>`, one or two `{ to, data }` entries.

## acceptAndBindESIMWallet {#acceptandbindesimwallet}

Builds the calls a new device wallet signs to take over an eSIM wallet. These are the same calls as [`kokio.eSIMWallet.acceptAndBindESIMWallet`](../mobile/esim-wallet.md#acceptandbindesimwallet):

1. `acceptOwnershipTransfer` on the eSIM wallet.
2. `addESIMWallet` on the new device wallet, which also updates the registry and clears the standby flag.
3. `toggleAccessToFunds`, only when `grantAccessToFunds` is `true`.

Build them when the old device's `requestTransferOwnership` emits `OwnershipTransferRequested` on the eSIM wallet. Its `_newOwner` is the device wallet that has to sign.

:::warning
The new device wallet must already be registered with `admin.deviceWalletFactory.postCreateAccount`.
:::

```ts
// Backend, when the webhook delivers OwnershipTransferRequested(_currentOwner, _newOwner)
const calls = admin.calls.acceptAndBindESIMWallet(eSIMWalletAddress, newDeviceWalletAddress, {
  grantAccessToFunds: true,
});

// App, on the new device
const userOpHash = await kokio.deviceWallet!.sendUserOperation(calls);
```

| Name | Type | Description |
| :--- | :--- | :--- |
| eSIMWalletAddress | `Address` | The eSIM wallet being taken over |
| newDeviceWalletAddress | `Address` | The device wallet that signs, the event's `_newOwner` |
| options.grantAccessToFunds | `boolean`, optional | Also let the eSIM wallet pull tokens from the new device wallet |

The operation reverts if any other device wallet signs it, or if the old device cancelled the transfer first.

Returns `Call[]`, two or three `{ to, data }` entries. Nothing is read, so this one is synchronous.
