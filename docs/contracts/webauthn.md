---
title: WebAuthn
description: The Kokio library that checks a WebAuthn assertion onchain, trying the RIP-7212 precompile first and falling back to FreshCryptoLib, and what it deliberately does not verify.
---

# WebAuthn library {#webauthn-library}

`WebAuthn` is the library that checks a passkey assertion onchain. It is built on Daimo's work, and it is reached through the [P256 verifier](./p256-verifier.md) rather than linked into each wallet, so every [device wallet](./device-wallet.md) in the [suite](./overview.md) verifies through one address.

Two functions. `tryDecodeSignature` turns calldata into a `WebAuthnSignature` struct, and `verifySignature` decides whether that assertion is valid for a given P-256 key.

## Two ways to verify, one answer {#two-ways-to-verify}

`verifySignature` tries the RIP-7212 precompile first. That is a native P-256 verification opcode, which Base and a growing number of other chains ship, and it is what makes checking a passkey signature cheap enough to do on every transaction.

If the precompile is absent, or if it rejects the call, the library falls back to [FreshCryptoLib](https://github.com/rdubois-crypto/FreshCryptoLib), a Solidity implementation of the same check. The fallback is slower and costs considerably more gas, but the answer is identical, so a chain without the precompile still works.

## Nothing here reverts on a bad signature {#nothing-reverts}

Both functions return rather than revert, and that is a deliberate hardening rather than a style choice.

The decoder Solidity generates for a struct reverts when the bytes are not a well-formed encoding. A revert is not a rejection anywhere this gets called from: inside ERC-4337 validation it fails the whole bundle instead of the one operation, and behind `isValidSignature` it reaches an integrating contract as an error instead of as an invalid signature. So `tryDecodeSignature` does the bounds checking itself and returns a zeroed struct on anything malformed. A zeroed struct then fails verification, because an empty `clientDataJSON` cannot contain the index it is handed.

## What it checks, and what it does not {#what-it-checks}

Worth reading before relying on it, because it verifies the parts of the WebAuthn specification that matter in Kokio's setting and skips the rest.

It does verify:

- The authenticator data is a well-formed assertion with the user present bit set, and, when `requireUV` is set, that the authenticator enforced user verification.
- The client JSON is of type `webauthn.get`, so the authenticator was answering an authentication request rather than a registration.
- The client JSON contains the challenge that was asked for.
- The signature is valid over both the authenticator data and the client JSON, for the given public key.

It does not verify the origin, the top origin, the relying party id hash, the credential backup state, client extension outputs, the signature counter or the attestation object. Origin and relying party id are trusted to the authenticator's own cross-origin policy. The practical consequence is the one Daimo names: sign messages with an expiry, so that removing a linked relying party id later has a bounded window of exposure. Kokio's [`isValidSignature`](./account-4337.md) does exactly that, with a `validUntil` packed into every signature.

<!-- docgen:start source=smart-contract-suite/docs/WebAuthn.md -->
## WebAuthn {#webauthn}

A library for verifying WebAuthn Authentication Assertions, built off the work of Daimo.

_Attempts to use the RIP-7212 precompile for signature verification. If precompile verification fails, it falls back to FreshCryptoLib._

### tryDecodeSignature {#webauthn-trydecodesignature}

```solidity
function tryDecodeSignature(bytes encodedSignature) internal pure returns (struct WebAuthnSignature decoded)
```

Decodes an encoded `WebAuthnSignature` without reverting on a malformed encoding.

_The decoder solc generates reverts when the bytes are not a well formed encoding, and a revert is not a rejection anywhere this is reached from. Inside ERC-4337 validation it fails the whole bundle rather than the one operation, and behind `isValidSignature` it reaches an integrating contract as an error rather than as an invalid signature. Everything below this point in this library was already written to return false instead of reverting; the decode one level above it was not, so anything too malformed to decode never reached the hardening.

An encoding failing any bound leaves `decoded` as solc allocated it, with both dynamic members pointing at the zero slot. `verifySignature` then returns false, because an empty `clientDataJSON` cannot contain the index it is handed.

Assembly, and a copy of solady's `WebAuthn.tryDecodeAuth` rather than a fresh implementation: `WebAuthnAuth` and `WebAuthnSignature` have identical layouts, and rewriting an audited ABI bounds check by hand only adds somewhere for a mistake to live. Memory-safe: every read is inside `encodedSignature`, and the only writes are to the six words solc already reserved for the return value._

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

_We do not verify all the steps as described in the specification, only ones relevant to our context. Please carefully read through this list before usage.

Specifically, we do verify the following:
- Verify that authenticatorData (which comes from the authenticator, such as iCloud Keychain) indicates a well-formed assertion with the user present bit set. If `requireUV` is set, checks that the authenticator enforced user verification. User verification should be required if, and only if, options.userVerification is set to required in the request.
- Verifies that the client JSON is of type "webauthn.get", i.e. the client was responding to a request to assert authentication.
- Verifies that the client JSON contains the requested challenge.
- Verifies that (r, s) constitute a valid signature over both the authenicatorData and client JSON, for public key (x, y).

We make some assumptions about the particular use case of this verifier, so we do NOT verify the following:
- `clientDataJSON.origin`: trusted to the authenticator's own cross-origin policy.
- `clientDataJSON.topOrigin`: assumed absent, i.e. no cross-origin/iframe usage.
- `authenticatorData.rpIdHash`: trusted to the authenticator. Sign messages with an expiry to limit exposure if a linked RP ID is later removed.
- Credential backup state: assumed unused in Relying Party policy.
- Client extension outputs: assumed unused.
- The signature counter: assumed unused for risk scoring.
- The attestation object: assumed absent from the response._

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
