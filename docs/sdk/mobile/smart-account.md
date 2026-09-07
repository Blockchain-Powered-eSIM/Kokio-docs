---
title: Smart account
description: kokio.smartAccount resolves a device passkey to its ERC-4337 smart account and builds the client that sends user operations, and kokio.P256Verifier checks a passkey signature directly.
---

# Smart account {#smart-account}

`kokio.smartAccount` turns a device's passkey into a smart account, and builds the client that sends user operations for it. This is the first thing a mobile app does after constructing [`Kokio`](./setup.md), because every other surface needs the client it produces.

Run the two calls in order. The account from the first feeds the client in the second.

```ts
const account = await kokio.smartAccount.getSmartWallet(deviceUniqueIdentifier, ownerKey, salt);
const smartAccountClient = await kokio.smartAccount.getSmartWalletClient(account);
```

`kokio.P256Verifier`, at the bottom of this page, is the other half of the same subject: it checks a signature the passkey produced.

## getSmartWallet {#getsmartwallet}

Works out the device wallet's address for a given passkey, without touching the chain. Call it once per session, right after constructing `Kokio`, to get the account object every write needs.

The address is counterfactual. It is computed the same way the contract computes it, so it is valid before the wallet is deployed. The first call on a chain also checks that computation against the real factory, so a mismatch fails loudly instead of sending a user operation to the wrong address.

```ts
const account = await kokio.smartAccount.getSmartWallet(
  deviceUniqueIdentifier, // string id for this device
  ownerKey,               // the passkey's P256 public key, as [x, y] hex
  salt,                   // bigint, makes the address unique per user
);
```

Returns `KokioSmartAccount`, a viem smart account object. Pass it to `getSmartWalletClient`.

## getSmartWalletClient {#getsmartwalletclient}

Builds the client that signs with the passkey and sends user operations through Pimlico's bundler and paymaster. Every write on every other mobile surface needs this client, so build it once and reuse it.

```ts
const smartAccountClient = await kokio.smartAccount.getSmartWalletClient(account);
```

Returns `KokioSmartAccountClient`, a bundler client that can also read contracts directly, since it carries viem's public actions too. Pass it as `smartAccountClient` to a new `Kokio(...)` call so `deviceWallet`, `eSIMWallet` and the rest become available.

## P256 verifier {#p256-verifier}

`kokio.P256Verifier`

Checks a WebAuthn signature against a P-256 public key directly, without going through a wallet's `isValidSignature`. Available as soon as `Kokio` has a `smartAccountClient`. One method, useful for verifying a signature offchain before trusting it.

The contract behind it is documented at [P256 verifier](../../contracts/p256-verifier.md), and the verification itself at [WebAuthn library](../../contracts/webauthn.md).

### verifySignature {#verifysignature}

Checks whether a WebAuthn assertion is a valid signature over a message, for the given P-256 public key.

```ts
const valid = await kokio.P256Verifier!.verifySignature(
  message,                    // the signed message, as hex
  true,                       // require the assertion to match the message
  webAuthnSignature,          // { authenticatorData, clientDataJSON, challengeIndex, typeIndex, r, s }
  x,                          // P256 public key x coordinate
  y,                          // P256 public key y coordinate
);
```

Returns `Promise<boolean>`.
