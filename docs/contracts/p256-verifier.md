---
title: P256 verifier
description: The one contract every Kokio wallet checks passkey signatures through, wrapping the WebAuthn library so accounts hold a single immutable address instead of linking the code themselves.
---

# P256 verifier {#p256-verifier}

`P256Verifier` is the contract every Kokio wallet checks a passkey signature through. Kokio wallets are ERC-4337 smart accounts owned by a WebAuthn passkey rather than by a seed phrase, so before any wallet acts on an instruction it has to be satisfied that the phone's passkey really produced it. This contract is where that question gets answered.

It holds no state and owns nothing. It is a thin wrapper around the [WebAuthn library](./webauthn.md), and it exists as a separate contract so that each account stores one immutable address to verify through, rather than carrying a copy of the verification code in its own bytecode. Its deployed address is on the [deployed addresses](./deployments.md) page.

## Where a signature comes from {#where-a-signature-comes-from}

The chain from a fingerprint to a state change runs through four hops:

1. The phone's secure enclave holds the passkey's private key. It never leaves the device, and it never reaches Kokio.
2. Registering the passkey records the public key's `x` and `y` co-ordinates on the [device wallet](./device-wallet.md), which is what makes that key the account's owner.
3. To act, the app asks the authenticator for a WebAuthn assertion over the message the wallet is about to be handed. That assertion arrives onchain as a `WebAuthnSignature`, described on the [types](./types.md) page.
4. [`Account4337`](./account-4337.md), the base the device wallet inherits, calls `verifySignature` here with the assertion and the stored key. A `false` return means the instruction is refused.

Nothing here reverts on a bad signature. It returns `false`, and the caller decides what that means. That matters inside ERC-4337 validation, where a revert fails the whole bundle rather than the single operation that was wrong.

Underneath, the library tries the RIP-7212 precompile first, a native P-256 verification opcode that Base and several other chains ship, and falls back to FreshCryptoLib's Solidity implementation when the precompile is absent or rejects the call. Both paths give the same answer; the precompile is only cheaper.

<!-- docgen:start source=smart-contract-suite/docs/P256Verifier.md -->
## P256Verifier {#p256verifier}

Thin contract wrapper around the WebAuthn verification library

_Adapted from Daimo's DaimoVerifier: https://github.com/daimo-eth/daimo/blob/master/packages/contract/src/DaimoVerifier.sol It exists as a contract so accounts hold one immutable address to verify through, rather than linking the library into every implementation._

### verifySignature {#p256verifier-verifysignature}

```solidity
function verifySignature(bytes message, bool requireUserVerification, struct WebAuthnSignature webAuthnSignature, uint256 x, uint256 y) public view returns (bool)
```

Verifies a WebAuthn assertion against a P256 public key

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| message | bytes | Raw challenge bytes expected inside the assertion's clientDataJSON |
| requireUserVerification | bool | True to demand the authenticator's user verification flag |
| webAuthnSignature | struct WebAuthnSignature | The assertion to check |
| x | uint256 | X co-ordinate of the P256 public key |
| y | uint256 | Y co-ordinate of the P256 public key |

**Return Values**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | True when the assertion is valid for that key |
<!-- docgen:end -->
