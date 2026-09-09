---
title: Payments (backend)
description: admin.paymentAdapter reads and manages the currencies Kokio accepts for a data bundle, including registering a new one through the timelock and quoting a price in US cents.
---

# Payments (backend) {#payments-backend}

`admin.paymentAdapter`

Reads and manages the currencies Kokio accepts for data bundle purchases. Available as soon as [`KokioAdmin`](./setup.md) exists.

`registerAsset` and `updateAsset` are owner only. On the live deployment the owner is the [ProtocolAdmin](./protocol-admin.md) timelock, so use the `*Call` builders below with `admin.protocolAdmin.proposer.schedule` rather than calling them directly. The direct methods are there for a deployment whose owner is still a plain EOA.

```ts
const asset = "0x5553444300000000000000000000000000000000000000000000000000000000"; // "USDC" as bytes32
const amountIn = await admin.paymentAdapter.quote(asset, 500n); // priceUSDCents
```

## How prices and currencies are written {#encoding}

**A price is a whole number of US cents, as a `bigint`.** The contract stores prices as `uint64` and has no decimal point, so `500n` is \$5.00 and `123456n` is \$1234.56. Round before converting to `bigint`, never after: `dollars * 100` can land on something like `1298.9999999999998`, and `BigInt()` truncates rather than rounds, quietly taking a cent off. If your database already stores integer cents, pass that straight in.

**A currency is named by a `bytes32`, not a string.** A short symbol fits inside 32 bytes by writing its text bytes first and padding with zeros.

```ts
import { stringToHex } from "viem";

const usdcSymbol = stringToHex("USDC", { size: 32 });
// 0x5553444300000000000000000000000000000000000000000000000000000000
```

The USDC registered on the current deployment is a test token, not Circle's. Its address is on the [deployed addresses](../../contracts/deployments.md) page, alongside the second registered asset, `USD`, which has no token and stands for a card or bank payment.

## registerAsset {#registerasset}

Adds a currency the adapter has never seen. Reverts if the symbol is already registered, so use `updateAsset` to change one that exists.

```ts
const hash = await admin.paymentAdapter.registerAsset(symbol, {
  allowed: true,
  isDollarUnit: true, // USDC, USDT, DAI and USD are true; ETH, TON and ZEC are not
  decimals: 6,
  token: usdcAddress, // zero address for a fiat-only currency
});
```

Returns `Promise<Hash>`.

## updateAsset {#updateasset}

Changes a currency already in the table: its decimals, token address, or whether it is currently allowed.

```ts
const hash = await admin.paymentAdapter.updateAsset(symbol, updatedAsset);
```

Returns `Promise<Hash>`.

## acceptOwnership {#acceptownership}

Accepts a pending ownership transfer. Call this from the account named as `pendingOwner`.

```ts
const hash = await admin.paymentAdapter.acceptOwnership();
```

Returns `Promise<Hash>`.

## registerAssetCall {#registerassetcall}

Builds the call payload to add a currency, for scheduling through the timelock.

```ts
const call = await admin.paymentAdapter.registerAssetCall(symbol, asset);
const scheduled = await admin.protocolAdmin.proposer.schedule(call);
```

Returns `Promise<OwnerCall>`.

## updateAssetCall {#updateassetcall}

Builds the call payload to change a currency already in the table.

```ts
const call = await admin.paymentAdapter.updateAssetCall(symbol, asset);
const scheduled = await admin.protocolAdmin.proposer.schedule(call);
```

Returns `Promise<OwnerCall>`.

## transferOwnershipCall {#transferownershipcall}

Builds the call payload to hand ownership of this contract to a new address. On the live deployment the owner is the ProtocolAdmin timelock, so hand the result to `protocolAdmin.proposer.schedule` rather than sending it directly.

```ts
const call = await admin.paymentAdapter.transferOwnershipCall(newOwner);
const scheduled = await admin.protocolAdmin.proposer.schedule(call);
```

Returns `Promise<OwnerCall>`.

## upgradeCall {#upgradecall}

Builds the call payload to point this contract's proxy at a new implementation. Hand the result to `protocolAdmin.proposer.schedule`.

There is no undo. Check the new implementation's storage layout matches before scheduling.

```ts
const call = await admin.paymentAdapter.upgradeCall(newImplementation);
const scheduled = await admin.protocolAdmin.proposer.schedule(call);
```

Returns `Promise<OwnerCall>`.

## registry {#registry}

Reads the registry this adapter reads `vault()` and eSIM wallet validity from.

```ts
const registry = await admin.paymentAdapter.registry();
```

Returns `Promise<Address>`.

## settlementToken {#settlementtoken}

Reads the ERC-20 registered under the `USDC` symbol at configure time.

```ts
const usdc = await admin.paymentAdapter.settlementToken();
```

Returns `Promise<Address>`.

## assets {#assets}

Reads the raw currency table entry for a symbol. `decimals` reads `0` for a symbol that was never registered, which is how `resolveAsset` tells "not registered" apart from "registered but withdrawn", where `allowed` is `false`.

```ts
const asset = await admin.paymentAdapter.assets(symbol);
```

Returns `Promise<Asset>`, shaped `{ allowed, isDollarUnit, decimals, token }`.

## resolveAsset {#resolveasset}

Reads a currency's full entry, reverting if the symbol was never registered.

```ts
const asset = await admin.paymentAdapter.resolveAsset(symbol);
```

Returns `Promise<Asset>`.

## quote {#quote}

Reads the amount of `symbol`, in its smallest unit, that a `priceUSDCents` charge currently costs. Worth reading before [`registry.recordSettledPurchase`](./registry.md), to size `tokenAmount` for the backend's own settlement record.

```ts
const amountIn = await admin.paymentAdapter.quote(symbol, priceUSDCents);
```

Returns `Promise<bigint>`.

## usedReferences {#usedreferences}

Checks whether a payment reference has already been spent here. Replay protection now lives on `registry.usedPaymentReferences`, scoped per eSIM wallet. This reads the adapter's own record from before that move.

```ts
const used = await admin.paymentAdapter.usedReferences(paymentReference);
```

Returns `Promise<boolean>`.

## upgradeManager {#upgrademanager}

Reads the address holding upgrade authority over this adapter, which is its owner. On the live deployment this is the ProtocolAdmin timelock.

```ts
const manager = await admin.paymentAdapter.upgradeManager();
```

Returns `Promise<Address>`.
