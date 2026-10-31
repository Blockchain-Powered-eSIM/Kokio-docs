---
title: Smart account
description: kokio.smartAccount resolves a device passkey to its ERC-4337 smart account and builds the client that sends user operations, and kokio.P256Verifier checks a passkey signature directly.
---

# Smart account {#smart-account}

Turn a device's passkey into a smart account, and build the client that sends its user operations.

---

`kokio.smartAccount` turns a device's passkey into a smart account, and builds the client that sends user operations for it. This is the first thing a mobile app does after constructing [`Kokio`](./setup.md), because every other surface needs the client it produces.

Run the two calls in order. The account from the first feeds the client in the second.

```ts title="Account, then client"
const account = await kokio.smartAccount.getSmartWallet(deviceUniqueIdentifier, ownerKey, salt);
const smartAccountClient = await kokio.smartAccount.getSmartWalletClient(account);
```

`kokio.P256Verifier`, at the bottom of this page, checks a signature the passkey produced.

## getSmartWallet {#getsmartwallet}

Works out the device wallet's address for a given passkey, without touching the chain. Call it once per session, right after constructing `Kokio`, to get the account object every write needs.

The address is counterfactual. It is computed the same way the contract computes it, so it is valid before the wallet is deployed. The first call on a chain also checks that computation against the real factory, so a mismatch fails loudly instead of sending a user operation to the wrong address.

```ts
const account = await kokio.smartAccount.getSmartWallet(deviceUniqueIdentifier, ownerKey, salt);
```

| Name | Type | Description |
| :--- | :--- | :--- |
| deviceUniqueIdentifier | `string` | The id for this device |
| ownerKey | `P256Key` | The passkey's P-256 public key, as `[x, y]` hex |
| salt | `bigint` | Makes the address unique per user |

Returns `KokioSmartAccount`, a viem smart account object. Pass it to `getSmartWalletClient`.

:::note
The wallet client given to `Kokio` does not need an `account`. The passkey signs, so a client with a chain and a transport is enough.
:::

## getSmartWalletClient {#getsmartwalletclient}

Builds the client that signs with the passkey and sends user operations through Pimlico's bundler and paymaster. Every write on every other mobile surface needs this client, so build it once and reuse it.

```ts
const smartAccountClient = await kokio.smartAccount.getSmartWalletClient(account);
```

Returns `KokioSmartAccountClient`, a bundler client that can also read contracts directly, since it carries viem's public actions too. Pass it as `smartAccountClient` to a new `Kokio(...)` call so `deviceWallet`, `eSIMWallet` and the rest become available.

Gas is paid by the paymaster at the same endpoint, so the device wallet never needs ETH. The gas policy id given to `Kokio` is optional: pass `""` to send none, or a Pimlico sponsorship policy id to have its rules applied.

To send user operations somewhere other than Pimlico, such as a local bundler in tests, pass `bundlerUrl`.

:::warning
A custom `bundlerUrl` must also answer the ERC-7677 paymaster methods.
:::

```ts
const smartAccountClient = await kokio.smartAccount.getSmartWalletClient(account, {
  bundlerUrl: "http://127.0.0.1:4337",
});
```

## P256 verifier {#p256-verifier}

`kokio.P256Verifier`

Checks a WebAuthn signature against a P-256 public key directly, without going through a wallet's `isValidSignature`. Available as soon as `Kokio` has a `smartAccountClient`. One method, useful for verifying a signature offchain before trusting it.

The contract behind it is documented at [P256 verifier](../../contracts/p256-verifier.md), and the verification itself at [WebAuthn library](../../contracts/webauthn.md).

### verifySignature {#verifysignature}

Checks whether a WebAuthn assertion is a valid signature over a message, for the given P-256 public key.

```ts
const valid = await kokio.P256Verifier!.verifySignature(message, true, webAuthnSignature, x, y);
```

| Name | Type | Description |
| :--- | :--- | :--- |
| message | `Hex` | The signed message |
| requireMessageVerification | `boolean` | Passed to the contract's `requireUserVerification`. `true` demands the authenticator's user verification flag |
| webAuthnSignature | `WebAuthnSignature` | `{ authenticatorData, clientDataJSON, challengeIndex, typeIndex, r, s }` |
| x | `bigint` | The P-256 public key's x coordinate |
| y | `bigint` | The P-256 public key's y coordinate |

Returns `Promise<boolean>`.
