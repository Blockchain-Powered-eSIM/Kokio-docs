---
title: Payments (backend)
description: admin.paymentAdapter reads and manages the currencies Kokio accepts for a data bundle, including registering a new one through the timelock and quoting a price in US cents.
---

# Payments (backend) {#payments-backend}

Reference for `admin.paymentAdapter`: read and manage the accepted currencies, and build the owner calls the timelock schedules.

---

`admin.paymentAdapter`

Reads and manages the currencies Kokio accepts for data bundle purchases. Available as soon as [`KokioAdmin`](./setup.md) exists.

:::warning
`registerAsset` and `updateAsset` are owner only. On the live deployment the owner is the [ProtocolAdmin](./protocol-admin.md) timelock, so use the `*Call` builders below with `admin.protocolAdmin.proposer.schedule` rather than calling them directly. The direct methods are there for a deployment whose owner is still a plain EOA.
:::

```ts
const asset = "0x5553444300000000000000000000000000000000000000000000000000000000"; // "USDC" as bytes32
const amountIn = await admin.paymentAdapter.quote(asset, 500n); // priceUSDCents
```

## How prices and currencies are written {#encoding}

### A price is whole US cents, as a bigint {#price-encoding}

The contract stores prices as `uint64` and has no decimal point, so `500n` is \$5.00 and `123456n` is \$1234.56. If your database already stores integer cents, pass that straight in.

:::warning
Round before converting to `bigint`, never after. `dollars * 100` can land on something like `1298.9999999999998`, and `BigInt()` truncates rather than rounds, quietly taking a cent off.
:::

### A currency is a bytes32, not a string {#currency-encoding}

A short symbol fits inside 32 bytes by writing its text bytes first and padding with zeros.

```ts title="Symbol to bytes32"
import { stringToHex } from "viem";

const usdcSymbol = stringToHex("USDC", { size: 32 });
// 0x5553444300000000000000000000000000000000000000000000000000000000
```

`USDC` is Circle's USDC on each network, and Base mainnet also accepts `USDT` and `DAI`. The token addresses are on the [Base mainnet](../../deployments/base.md#currencies) and [Base Sepolia](../../deployments/base-sepolia.md#currencies) pages. `USD` has no token and stands for a card or bank payment.

:::tip
Read any asset's token address with [`resolveAsset`](#resolveasset) rather than hardcoding it.
:::

## registerAsset {#registerasset}

Adds a currency the adapter has never seen.

:::note
Reverts if the symbol is already registered, so a typo cannot overwrite a live currency. Use `updateAsset` to change one that exists.
:::

```ts
const hash = await admin.paymentAdapter.registerAsset(symbol, {
  allowed: true,
  isDollarUnit: true,
  decimals: 6,
  token: usdcAddress,
});
```

| Name | Type | Description |
| :--- | :--- | :--- |
| symbol | `Hex` | The currency as a `bytes32` symbol |
| asset.allowed | `boolean` | Whether purchases may use it now |
| asset.isDollarUnit | `boolean` | `true` for USDC, USDT, DAI and USD. `false` for ETH, TON and ZEC, which `quote` cannot price |
| asset.decimals | `number` | The token's decimals, `2` for `USD` |
| asset.token | `Address` | The ERC-20, or the zero address for fiat and non-EVM assets |

Returns `Promise<Hash>`.

## updateAsset {#updateasset}

Changes a currency already in the table: its decimals, token address, or whether it is currently allowed.

```ts
const hash = await admin.paymentAdapter.updateAsset(symbol, updatedAsset);
```

Takes the same `symbol` and `asset` as [`registerAsset`](#registerasset).

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

## recoverTokensCall {#recovertokenscall}

Builds the call payload to send back tokens someone sent to the adapter by mistake. Purchases never leave tokens in the adapter, so anything it holds arrived that way. The contract emits `TokensRecovered(token, to, amount)`.

```ts
const call = await admin.paymentAdapter.recoverTokensCall(token, recipient, amount);
const scheduled = await admin.protocolAdmin.proposer.schedule(call);
```

| Name | Type | Description |
| :--- | :--- | :--- |
| token | `Address` | The ERC-20 to recover. Must not be zero |
| to | `Address` | Who receives it. Must not be zero |
| amount | `bigint` | How much, in the token's smallest unit. Must not be zero |

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

:::warning
There is no undo. Check the new implementation's storage layout matches before scheduling.
:::

```ts
const call = await admin.paymentAdapter.upgradeCall(newImplementation);
const scheduled = await admin.protocolAdmin.proposer.schedule(call);
```

| Name | Type | Description |
| :--- | :--- | :--- |
| newImplementation | `Address` | The new implementation contract |
| data | `Hex`, optional | Calldata to run on the new implementation as part of the upgrade |

Returns `Promise<OwnerCall>`.

## registry {#registry}

Reads the registry this adapter reads `vault()` and eSIM wallet validity from.

```ts
const registry = await admin.paymentAdapter.registry();
```

Returns `Promise<Address>`.

## settlementToken {#settlementtoken}

Reads the token set when the adapter was initialised, the one the vault is meant to end up holding.

:::note
A purchase does not pay in this token. It pays in the token of the asset it names, which `resolveAsset` returns.
:::

```ts
const token = await admin.paymentAdapter.settlementToken();
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

| Name | Type | Description |
| :--- | :--- | :--- |
| symbol | `Hex` | The currency as a `bytes32` symbol |
| priceUSDCents | `bigint` | The price in whole US cents |

Returns `Promise<bigint>`.

## usedReferences {#usedreferences}

Checks whether a payment reference has already been spent here.

:::warning
Replay protection now lives on [`registry.usedPaymentReferences`](./registry.md), scoped per eSIM wallet. This reads the adapter's own record from before that move.
:::

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
