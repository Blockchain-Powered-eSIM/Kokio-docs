---
title: Registry (mobile)
description: kokio.registry reads the Kokio protocol-wide directory of device wallets and eSIM wallets, checks the pause switch and price caps, and binds an eSIM wallet after a transfer.
---

# Registry (mobile) {#registry-mobile}

`kokio.registry`

The Kokio protocol-wide directory of device wallets and eSIM wallets. Present as soon as [`Kokio`](./setup.md) has a `smartAccountClient`. The contract behind this surface is documented at [registry](../../contracts/registry.md).

Only three writes are reachable from a device wallet user operation. Everything else on the registry is admin gated and lives on [`admin.registry`](../backend/registry.md) instead.

```ts
const hash = await kokio.registry!.bindESIMWallet(eSIMWalletAddress);
```

## bindESIMWallet {#bindesimwallet}

Takes on an eSIM wallet as this device wallet's own. Use it after accepting an ownership transfer, to make the registry's record match.

The eSIM wallet's `owner()` has to already be this device wallet, so accept the transfer first, then bind. This also clears any standby flag left over from the transfer.

```ts
const hash = await kokio.registry!.bindESIMWallet(eSIMWalletAddress);
```

Returns `Promise<Hash>`, a user operation hash.

## toggleESIMWalletStandbyStatus {#toggleesimwalletstandbystatus}

Flags an eSIM wallet as mid-transfer, or clears the flag. Use it to mark a transfer as started or cancelled. Only the flag changes, and the registry keeps naming this device wallet as the holder either way.

```ts
const hash = await kokio.registry!.toggleESIMWalletStandbyStatus(eSIMWalletAddress, true);
```

Returns `Promise<Hash>`.

## isDeviceIdentifierAlreadyUsed {#isdeviceidentifieralreadyused}

Checks whether a device identifier already has a wallet deployed onchain.

```ts
const used = await kokio.registry!.isDeviceIdentifierAlreadyUsed(deviceUniqueIdentifier);
```

Returns `Promise<boolean>`.

## paused {#paused}

Checks whether the whole protocol is paused. While paused, the purchase and token pull paths on the device wallets and eSIM wallets revert. Check this before offering a purchase.

```ts
const paused = await kokio.registry!.paused();
```

Returns `Promise<boolean>`.

## requireNotPaused {#requirenotpaused}

The same pause check as `paused`, but throws instead of returning `false`. Use it when you want the failure to carry the protocol's own revert reason rather than branching on a boolean yourself.

```ts
await kokio.registry!.requireNotPaused();
```

Returns `Promise<void>`.

## isESIMWalletValid {#isesimwalletvalid}

Reads the device wallet holding an eSIM wallet. Despite the name this returns an address, not a boolean, and it keeps naming the last holder even after a release. Use [`deviceWallet.isValidESIMWallet`](./device-wallet.md#isvalidesimwallet) to ask who holds it right now.

```ts
const holder = await kokio.registry!.isESIMWalletValid(eSIMWalletAddress);
```

Returns `Promise<Address>`, zero if never registered.

## isESIMWalletOnStandby {#isesimwalletonstandby}

Checks whether a transfer is outstanding on an eSIM wallet. Independent from `isESIMWalletValid`: a `true` here does not mean the wallet has left the protocol.

```ts
const onStandby = await kokio.registry!.isESIMWalletOnStandby(eSIMWalletAddress);
```

Returns `Promise<boolean>`.

## isDeviceWalletValid {#isdevicewalletvalid}

Checks whether a device wallet is registered with the protocol.

```ts
const valid = await kokio.registry!.isDeviceWalletValid(deviceWalletAddress);
```

Returns `Promise<boolean>`.

## uniqueIdentifierToDeviceWallet {#uniqueidentifiertodevicewallet}

Reads the device wallet registered for a device identifier.

```ts
const wallet = await kokio.registry!.uniqueIdentifierToDeviceWallet(deviceUniqueIdentifier);
```

Returns `Promise<Address>`, zero if none.

## isESIMIdentifierClaimed {#isesimidentifierclaimed}

Checks whether an eSIM identifier is already held by a wallet.

```ts
const claimed = await kokio.registry!.isESIMIdentifierClaimed(eSIMUniqueIdentifier);
```

Returns `Promise<boolean>`.

## eSIMWalletForIdentifier {#esimwalletforidentifier}

Reads the one eSIM wallet holding an eSIM identifier. Set once and never cleared, even across an ownership transfer, since the eSIM belongs to the wallet rather than to whichever device holds it.

```ts
const wallet = await kokio.registry!.eSIMWalletForIdentifier(eSIMUniqueIdentifier);
```

Returns `Promise<Address>`, zero if nobody holds it.

## defaultPriceCapUSDCents {#defaultpricecapusdcents}

Reads the fallback price ceiling, in US cents, for a wallet that has not set its own cap.

```ts
const cap = await kokio.registry!.defaultPriceCapUSDCents();
```

Returns `Promise<bigint>`.

## paymentAdapter {#paymentadapter}

Reads the payment adapter this registry currently points at. Read this before going to [`kokio.paymentAdapter`](./payments.md), which targets whatever address you pass it rather than resolving the current one itself.

```ts
const adapter = await kokio.registry!.paymentAdapter();
```

Returns `Promise<Address>`.

## usedPaymentReferences {#usedpaymentreferences}

Checks whether a payment reference has already been spent for an eSIM wallet. Scoped per wallet, so pass `keccak256(abi.encode(eSIMWalletAddress, paymentReference))`, not the bare reference.

```ts
const used = await kokio.registry!.usedPaymentReferences(scopedReference);
```

Returns `Promise<boolean>`.

## requireLazyHistoryCopied {#requirelazyhistorycopied}

Throws if an eSIM wallet still has lazy deployment history waiting to be copied in. `buyDataBundleWithToken` checks this itself before writing a new entry, so calling it first only turns that revert into a typed error ahead of a user operation. See [lazy wallet registry](../../contracts/lazy-wallet-registry.md) for where that history comes from.

```ts
await kokio.registry!.requireLazyHistoryCopied(eSIMWalletAddress);
```

Returns `Promise<void>`.

## requireDeviceIdentifierNotReserved {#requiredeviceidentifiernotreserved}

Throws if a fiat path user's eSIMs are already waiting on this device identifier. Worth checking before deploying: taking a reserved identifier strands that user, because their history copy and wallet deployment both then refuse it.

```ts
await kokio.registry!.requireDeviceIdentifierNotReserved(deviceUniqueIdentifier);
```

Returns `Promise<void>`.
