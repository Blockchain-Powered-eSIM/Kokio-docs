---
title: WebAuthn
description: The Kokio library that checks a WebAuthn assertion onchain, trying the RIP-7212 precompile first and falling back to FreshCryptoLib, and what it deliberately does not verify.
---

# WebAuthn library {#webauthn-library}

How a passkey assertion is checked onchain, and which parts of WebAuthn it does not check.

---

`WebAuthn` is the library that checks a passkey assertion onchain, and it is what makes a Kokio device wallet controllable by a fingerprint instead of a seed phrase. It is built on Daimo's work, and it is reached through the [P256 verifier](./p256-verifier.md) rather than linked into each wallet, so every [device wallet](./device-wallet.md) in the [suite](./overview.md) verifies through one address.

It has two functions:

- `tryDecodeSignature` turns calldata into a `WebAuthnSignature` struct.
- `verifySignature` decides whether that assertion is valid for a given P-256 key.

## Two ways to verify, one answer {#two-ways-to-verify}

`verifySignature` tries the RIP-7212 precompile first. That is a native P-256 verification opcode, which Base and a growing number of other chains ship, and it is what makes checking a passkey signature cheap enough to do on every transaction.

If the precompile is absent, or if it rejects the call, the library falls back to [FreshCryptoLib](https://github.com/rdubois-crypto/FreshCryptoLib), a Solidity implementation of the same check. The fallback is slower and costs considerably more gas, but the answer is identical, so a chain without the precompile still works.

## Nothing here reverts on a bad signature {#nothing-reverts}

Both functions return rather than revert, and that is a deliberate hardening rather than a style choice.

The decoder Solidity generates for a struct reverts when the bytes are not a well-formed encoding. A revert is not a rejection anywhere this gets called from:

- Inside ERC-4337 validation, it fails the whole bundle instead of the one operation.
- Behind `isValidSignature`, it reaches an integrating contract as an error instead of as an invalid signature.

So `tryDecodeSignature` does the bounds checking itself and returns a zeroed struct on anything malformed. A zeroed struct then fails verification, because an empty `clientDataJSON` cannot contain the index it is handed.

:::note
One exception, inherited from solady's decoding: the length checks use wrapping arithmetic, so a crafted length near 2^256 can pass them and run the caller out of gas. That is a revert, never an accepted signature.
:::

## What it checks, and what it does not {#what-it-checks}

It verifies the parts of the WebAuthn specification that matter in Kokio's setting and skips the rest. Read this before relying on it.

It does verify:

- The authenticator data is a well-formed assertion with the user present bit set, and, when `requireUV` is set, that the authenticator enforced user verification.
- The client JSON is of type `webauthn.get`, so the authenticator was answering an authentication request rather than a registration.
- The client JSON contains the challenge that was asked for.
- The signature is valid over both the authenticator data and the client JSON, for the given public key.

It does not verify the origin, the top origin, the relying party id hash, the credential backup state, client extension outputs, the signature counter or the attestation object. Origin and relying party id are trusted to the authenticator's own cross-origin policy.

:::warning
Sign messages with an expiry, as Daimo advises, so that removing a linked relying party id later has a bounded window of exposure. Kokio's [`isValidSignature`](./account-4337.md) does this, with a `validUntil` packed into every signature.
:::

<!-- docgen:start source=smart-contract-suite/docs/WebAuthn.md -->
## WebAuthn {#webauthn}

A library for verifying WebAuthn Authentication Assertions, built off the work of Daimo.

Attempts to use the RIP-7212 precompile for signature verification. If precompile verification fails, it falls back to FreshCryptoLib.

### tryDecodeSignature {#webauthn-trydecodesignature}

```solidity
function tryDecodeSignature(bytes encodedSignature) internal pure returns (struct WebAuthnSignature decoded)
```

Decodes an encoded `WebAuthnSignature` without reverting on a malformed encoding.

`abi.decode` reverts on bad input. Inside ERC-4337 validation that fails the whole bundle, and behind `isValidSignature` it reaches the caller as an error, not a rejection.

On a failed bound `decoded` stays as solc allocated it, both dynamic members empty, and `verifySignature` returns false since an empty `clientDataJSON` holds no valid index.

Inherited from solady: the length checks wrap, so a crafted length can run out of gas. That reverts, it never accepts a signature.

Copied from solady's `WebAuthn.tryDecodeAuth` (identical struct layout) rather than rewriting an ABI bounds check by hand. Memory-safe: every read is inside `encodedSignature`, and the only writes are to the six words solc reserved for `decoded`.

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| encodedSignature | bytes | `abi.encode` of a `WebAuthnSignature`, as supplied by the caller. |

**Return Values**

| Name | Type | Description |
| ---- | ---- | ----------- |
| decoded | struct WebAuthnSignature | The signature, or a zeroed struct when the encoding is malformed. |

### verifySignature {#webauthn-verifysignature}

```solidity
function verifySignature(bytes challenge, bool requireUV, struct WebAuthnSignature webAuthnSignature, uint256 x, uint256 y) internal view returns (bool)
```

Verifies a Webauthn Authentication Assertion as described in https://www.w3.org/TR/webauthn-2/#sctn-verifying-assertion.

Only the spec steps relevant here are checked. Read this list before using it.

Verified:
- authenticatorData has the user present bit set, and the user verified bit too when `requireUV` is set (require it only if options.userVerification was "required").
- The client JSON has type "webauthn.get".
- The client JSON carries the requested challenge.
- (r, s) is a valid signature by (x, y) over authenticatorData and the client JSON.

NOT verified:
- `clientDataJSON.origin`: trusted to the authenticator's own cross-origin policy.
- `clientDataJSON.topOrigin`: assumed absent, i.e. no cross-origin/iframe usage.
- `authenticatorData.rpIdHash`: trusted to the authenticator. Sign messages with an expiry to limit exposure if a linked RP ID is later removed.
- Credential backup state: assumed unused in Relying Party policy.
- Client extension outputs: assumed unused.
- The signature counter: assumed unused for risk scoring.
- The attestation object: assumed absent from the response.

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| challenge | bytes | The challenge that was provided by the relying party. |
| requireUV | bool | A boolean indicating whether user verification is required. |
| webAuthnSignature | struct WebAuthnSignature | The `WebAuthnSignature` struct. |
| x | uint256 | The x coordinate of the public key. |
| y | uint256 | The y coordinate of the public key. |

**Return Values**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | `true` if the authentication assertion passed validation, else `false`. |
<!-- docgen:end -->
