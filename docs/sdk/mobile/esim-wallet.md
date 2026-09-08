---
title: eSIM wallet (mobile)
description: kokio.eSIMWallet buys data bundles for one Kokio eSIM, sets its price cap and moves it between devices, and kokio.eSIMWalletFactory deploys a new one.
---

# eSIM wallet (mobile) {#esim-wallet-mobile}

`kokio.eSIMWallet`

Wraps one eSIM wallet, the Kokio contract holding a single eSIM's purchase history and price cap. There is one per eSIM. The contract behind this surface is documented at [eSIM wallet](../../contracts/esim-wallet.md).

Only present once [`Kokio`](./setup.md) has both a `smartAccountClient` and an `eSIMWalletAddress`, set on the constructor or bound afterwards with `kokio.setESIMWalletAddress(address)`. That setter is how a user with several eSIM wallets switches which one the app is acting on.

Writes here need the device wallet that owns this eSIM wallet to be the signer, which is exactly what a passkey user operation already is.

```ts
const asset = "0x5553444300000000000000000000000000000000000000000000000000000000"; // "USDC" as bytes32
const dataBundleDetails = { id: bundleId, priceUSDCents: 500n, settlement: Settlement.DeviceWallet };
const maxAmountIn = await kokio.paymentAdapter!.quote(asset, dataBundleDetails.priceUSDCents);
const hash = await kokio.eSIMWallet!.buyDataBundleWithToken(dataBundleDetails, asset, maxAmountIn, paymentReference);
```

Prices are whole US cents as a `bigint`, and a currency is named by a `bytes32` rather than a string. Both are explained on the [payments](./payments.md) page.

## buyDataBundleWithToken {#buydatabundlewithtoken}

Buys a data bundle for this eSIM, paid for in an ERC-20 the payment adapter accepts, which is USDC on Base Sepolia today. This is the everyday purchase flow.

Check `priceCapUSDCents()` first, because a price above the cap reverts. Read [`kokio.paymentAdapter.quote(asset, priceUSDCents)`](./payments.md#quote) to size `maxAmountIn`, the most of `asset` this purchase may spend, in its smallest unit. Nothing moves the price between the quote and the purchase today, so passing that value straight through is enough. A swap path may show up later, which is why the contract takes a maximum rather than an exact amount.

`paymentReference` ties the purchase to its offchain order and is spendable once per eSIM wallet. The backend hands this to the app. The SDK never invents one.

```ts
const hash = await kokio.eSIMWallet!.buyDataBundleWithToken(
  {
    id: bundleId, // bytes32
    priceUSDCents: 500n, // \$5.00, must not exceed priceCapUSDCents()
    settlement: Settlement.DeviceWallet, // this wallet's own balance pays
  },
  asset, // bytes32 symbol, e.g. "USDC"
  maxAmountIn, // from paymentAdapter.quote(asset, priceUSDCents)
  paymentReference, // bytes32, from the backend
);
```

Returns `Promise<Hash>`, a user operation hash.

## sendTokenToDeviceWallet {#sendtokentodevicewallet}

Sends an ERC-20 held by this eSIM wallet back to its owning device wallet. Nothing else moves a stray token balance off this wallet, so use this when one is stuck here after a handover or a refund.

```ts
const hash = await kokio.eSIMWallet!.sendTokenToDeviceWallet(tokenAddress, amount);
```

Returns `Promise<Hash>`.

## setPriceCapUSDCents {#setpricecapusdcents}

Sets the most this eSIM wallet may be charged for one bundle, in US cents. Use it to give the user control over their own spending limit, separate from whatever the admin sets as the default.

Pass `0n` to hand control back to the registry's default cap.

```ts
const hash = await kokio.eSIMWallet!.setPriceCapUSDCents(50_000n); // \$500.00
```

Returns `Promise<Hash>`.

## requestTransferOwnership {#requesttransferownership}

Starts moving this eSIM wallet to a new device wallet. Use it when a user is switching their eSIM to a different device. The move only completes once the new device wallet calls `acceptOwnershipTransfer`.

```ts
const hash = await kokio.eSIMWallet!.requestTransferOwnership(newDeviceWalletAddress);
```

Returns `Promise<Hash>`.

## acceptOwnershipTransfer {#acceptownershiptransfer}

Finishes a transfer that another device wallet started. Call this from the device wallet that was named in `requestTransferOwnership`.

```ts
const hash = await kokio.eSIMWallet!.acceptOwnershipTransfer();
```

Returns `Promise<Hash>`.

## sendETHToDeviceWallet {#sendethtodevicewallet}

Sends ETH held by this eSIM wallet back to its owning device wallet. Data bundles no longer cost ETH, but the wallet still accepts plain ETH transfers, which is how a device wallet tops it up, so this stays around for moving that balance back.

```ts
const hash = await kokio.eSIMWallet!.sendETHToDeviceWallet(amount);
```

Returns `Promise<Hash>`.

## priceCapUSDCents {#pricecapusdcents}

Reads the price ceiling that actually applies to this wallet's next purchase, in US cents. Check this before naming a price on `buyDataBundleWithToken`.

If the wallet has no cap of its own it falls back to the registry's default, and if neither is set it returns the maximum `uint64` rather than zero, so a missing cap never reads as "no purchases allowed".

```ts
const cap = await kokio.eSIMWallet!.priceCapUSDCents();
```

Returns `Promise<bigint>`.

## owner {#owner}

Reads the device wallet that currently owns this eSIM wallet.

```ts
const owner = await kokio.eSIMWallet!.owner();
```

Returns `Promise<Address>`.

## deviceWallet {#devicewallet}

Reads the device wallet this eSIM wallet belongs to. Tracks the same value as `owner`, but through its own contract slot.

```ts
const deviceWallet = await kokio.eSIMWallet!.deviceWallet();
```

Returns `Promise<Address>`.

## transactionHistory {#transactionhistory}

Reads one past purchase by its position in the list. There is no length getter, so read upward from `0n` until a call reverts, or track the count from the wallet's purchase events.

```ts
const purchase = await kokio.eSIMWallet!.transactionHistory(0n);
```

Returns `Promise<DataBundleDetails>`, shaped `{ id, priceUSDCents, settlement }`. `settlement` names which contract, if any, saw the money move: `0` for this wallet's own balance, `1` for an external wallet, `2` for fiat. Only `0` is provable onchain. The admin's word is the only check on the other two.

## Deploying a new eSIM wallet {#esim-wallet-factory}

`kokio.eSIMWalletFactory`

Deploys a new eSIM wallet for a device wallet. Present as soon as `Kokio` has a `smartAccountClient`, chain-wide like the [device wallet factory](./device-wallet-factory.md). The contract is documented at [eSIM wallet factory](../../contracts/esim-wallet-factory.md).

### deployESIMWalletWithUserOp {#deployesimwalletwithuserop}

Deploys a new eSIM wallet, owned by the given device wallet. Use it when a user is adding a new eSIM to a device wallet they already have. The device wallet sending the user operation has to be one the registry recognizes.

```ts
const hash = await kokio.eSIMWalletFactory!.deployESIMWalletWithUserOp(
  deviceWalletAddress,
  salt, // bigint, makes the eSIM wallet's address unique
);
```

Returns `Promise<Hash>`, a user operation hash.

### getCurrentESIMWalletImplementation {#getcurrentesimwalletimplementation}

Reads the eSIM wallet implementation contract every new eSIM wallet points at.

```ts
const impl = await kokio.eSIMWalletFactory!.getCurrentESIMWalletImplementation();
```

Returns `Promise<Address>`.
