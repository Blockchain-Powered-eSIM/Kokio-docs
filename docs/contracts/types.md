---
title: Types and structs
description: The shared structs and the Settlement enum the Kokio contracts pass between each other, and what the packing decisions mean for anyone adding a field.
---

# Types and structs {#types-and-structs}

Six types are shared across the Kokio [wallet suite](./overview.md), declared in `CustomStructs` so no two contracts can drift on a layout they both read. Three of them, `Settlement`, `DataBundleDetails` and `WebAuthnSignature`, cross a boundary an integrator has to encode for.

## Settlement {#settlement-explained}

Which contract, if any, saw the money for a data bundle move. Three values, and the order is the encoding:

| Value | Name | Means |
|---|---|---|
| `0` | `DeviceWallet` | Paid from the user's own wallet, onchain, and provable by anyone |
| `1` | `ExternalWallet` | Paid from a wallet outside the protocol |
| `2` | `Fiat` | Paid by card or bank, outside the contracts entirely |

Only the first can be proven onchain. The other two are the admin's word that a payment happened, which is why the [price cap](./esim-wallet.md) is the only check on them and why the field is stored rather than inferred.

## DataBundleDetails {#databundledetails-explained}

One purchase. Two storage slots: `id`, then `priceUSDCents` and `settlement` packed together.

`id` is a `bytes32` rather than a `string` because a provider's bundle ids fit in 32 bytes and a string would cost an extra slot on every entry a user ever makes. Encode a shorter id by right-padding it, which is what viem's `stringToHex(id, { size: 32 })` does.

`priceUSDCents` is a `uint64` of whole US cents, the same unit every price in the protocol uses. There is no timestamp field, because the event log already carries one.

## WebAuthnSignature {#webauthnsignature-explained}

One WebAuthn assertion, as the authenticator produced it: the authenticator data, the client JSON, the two indexes into that JSON, and the signature's `r` and `s`.

It is decoded from calldata by [`WebAuthn.tryDecodeSignature`](./webauthn.md), which zeroes the whole struct on a malformed body rather than reverting. A zeroed struct then fails verification, so a bad encoding reads as an invalid signature rather than as an error.

## The other three {#the-other-three}

`Wallets` is what a deployment returns, a device wallet address and an eSIM wallet address together. `Call` is one call an [account](./account-4337.md) makes on its owner's behalf: destination, value, calldata. `Asset` is one accepted currency, and it is documented with the [payment adapter](./payment-adapter.md) that owns it.

## If you are adding a field {#if-you-are-adding-a-field}

`Asset` is 23 bytes and fits one slot with nine to spare. Anything new has to stay inside those nine bytes, because a second slot moves every entry in a live mapping and a live table cannot be moved.

`DataBundleDetails` has the same constraint for the same reason, and `priceCapUSDCents` on the eSIM wallet is declared where it is so it shares a slot with `newRequestedOwner`. Solidity packs in declaration order, so moving that line costs the slot.

<!-- docgen:start source=smart-contract-suite/docs/CustomStructs.md -->
## Settlement {#settlement}

Which contract, if any, saw the money for a data bundle move

_Only `DeviceWallet` can be proven onchain. The other two are the admin's word, so the price cap is the only check on them._

```solidity
enum Settlement {
  DeviceWallet,
  ExternalWallet,
  Fiat
}
```

## DataBundleDetails {#databundledetails}

Data Bundle related details stored in the eSIM wallet

_Two slots: `id`, then `priceUSDCents` and `settlement` packed together. `id` is `bytes32` because the provider's ids fit in 32 bytes and a `string` would cost an extra slot on every entry. No timestamp field: the event log already has one._

```solidity
struct DataBundleDetails {
  bytes32 id;
  uint64 priceUSDCents;
  enum Settlement settlement;
}
```

## Wallets {#wallets}

Object returned when a new device and eSIM wallet is deployed

```solidity
struct Wallets {
  address deviceWallet;
  address eSIMWallet;
}
```

## WebAuthnSignature {#webauthnsignature}

One WebAuthn assertion, as the authenticator produced it

_Decoded from calldata by `WebAuthn.tryDecodeSignature`, which zeroes the whole struct on a malformed body rather than reverting. A zeroed struct fails verification._

```solidity
struct WebAuthnSignature {
  bytes authenticatorData;
  string clientDataJSON;
  uint256 challengeIndex;
  uint256 typeIndex;
  uint256 r;
  uint256 s;
}
```

## Call {#call}

One call an account makes on its owner's behalf

```solidity
struct Call {
  address dest;
  uint256 value;
  bytes data;
}
```
<!-- docgen:end -->
