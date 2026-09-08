---
title: Payments (mobile)
description: kokio.paymentAdapter reads which currencies Kokio accepts for a data bundle and what a price in US cents costs in each, including how prices and asset symbols are encoded.
---

# Payments (mobile) {#payments-mobile}

`kokio.paymentAdapter`

Reads the currencies Kokio accepts for data bundle purchases, and what a given price costs in each. Present as soon as [`Kokio`](./setup.md) has a `smartAccountClient`.

This surface is read-only. The adapter's own writes are gated to the eSIM wallet mid-purchase or to the registry, so nothing here sends a user operation. Registering or changing a currency is an owner action, on [`admin.protocolAdmin`](../backend/protocol-admin.md).

```ts
const asset = "0x5553444300000000000000000000000000000000000000000000000000000000"; // "USDC" as bytes32
const amountIn = await kokio.paymentAdapter!.quote(asset, 500n); // priceUSDCents
```

## How prices and currencies are written {#encoding}

Two encodings show up in every call here and in [buying a bundle](./esim-wallet.md).

**A price is a whole number of US cents, as a `bigint`.** The contract stores prices as `uint64` and has no decimal point, so `500n` is \$5.00 and `123456n` is \$1234.56. Converting from dollars, round before the `bigint` conversion, never after: `dollars * 100` can land on something like `1298.9999999999998`, and `BigInt()` truncates rather than rounds, quietly taking a cent off the price. If your own database already stores cents as an integer, pass it straight in.

```ts
function toPriceUSDCents(dollars: number): bigint {
  return BigInt(Math.round(dollars * 100));
}
```

**A currency is named by a `bytes32`, not a string.** A short symbol fits inside 32 bytes by writing its text bytes first and padding the rest with zeros. viem builds it for you.

```ts
import { stringToHex } from "viem";

const usdcSymbol = stringToHex("USDC", { size: 32 });
// 0x5553444300000000000000000000000000000000000000000000000000000000
```

The USDC registered on the current deployment is a test token, not Circle's. Its address is on the [deployed addresses](../../contracts/deployments.md) page.

## registry {#registry}

Reads the registry this adapter reads `vault()` and eSIM wallet validity from.

```ts
const registry = await kokio.paymentAdapter!.registry();
```

Returns `Promise<Address>`.

## settlementToken {#settlementtoken}

Reads the ERC-20 registered under the `USDC` symbol at configure time.

```ts
const usdc = await kokio.paymentAdapter!.settlementToken();
```

Returns `Promise<Address>`.

## assets {#assets}

Reads the raw currency table entry for a symbol. `decimals` reads `0` for a symbol that was never registered, which is how `resolveAsset` tells "not registered" apart from "registered but withdrawn", where `allowed` is `false`.

```ts
const asset = await kokio.paymentAdapter!.assets(symbol);
```

Returns `Promise<Asset>`, shaped `{ allowed, isDollarUnit, decimals, token }`.

## resolveAsset {#resolveasset}

Reads a currency's full entry, reverting if the symbol was never registered. Worth checking before a purchase: a `token` at the zero address means the currency is fiat only, and `buyDataBundleWithToken` reverts with `AssetNotTransferable` for it.

```ts
const asset = await kokio.paymentAdapter!.resolveAsset(symbol);
```

Returns `Promise<Asset>`.

## quote {#quote}

Reads the amount of `symbol`, in its smallest unit, that a `priceUSDCents` charge currently costs. Read this before calling `eSIMWallet.buyDataBundleWithToken` and pass the result as `maxAmountIn`.

Nothing today moves the price between the quote and the purchase, so the two always agree. A swap path may change that later, which is why the contract takes a maximum rather than trusting the caller's figure outright.

```ts
const amountIn = await kokio.paymentAdapter!.quote(symbol, priceUSDCents);
```

Returns `Promise<bigint>`.

## usedReferences {#usedreferences}

Checks whether a payment reference has already been spent here. Replay protection now lives on `registry.usedPaymentReferences`, scoped per eSIM wallet. This reads the adapter's own record from before that move.

```ts
const used = await kokio.paymentAdapter!.usedReferences(paymentReference);
```

Returns `Promise<boolean>`.

## upgradeManager {#upgrademanager}

Reads the address holding upgrade authority over this adapter, which is its owner. On the live deployment this is the ProtocolAdmin timelock.

```ts
const manager = await kokio.paymentAdapter!.upgradeManager();
```

Returns `Promise<Address>`.
