---
title: Account4337
description: The ERC-4337 and ERC-1271 base that every Kokio device wallet inherits, turning a WebAuthn passkey assertion into an onchain call.
---

# ERC-4337 account {#erc-4337-account}

`Account4337` is the base contract every Kokio [device wallet](./device-wallet.md) inherits. It is what makes a wallet owned by a passkey rather than by an address, and it is where a WebAuthn assertion becomes a call the chain will execute.

The owner is a pair of P-256 co-ordinates stored as `bytes32[2]`, not an account. It never sends a transaction itself. It signs an assertion, and either the ERC-4337 EntryPoint or the account calling into itself turns that into a call.

## The ERC-4337 side {#the-erc-4337-side}

ERC-4337 is account abstraction without a change to the protocol. Instead of broadcasting a transaction, the app builds a **user operation**, the passkey signs it, and a **bundler** submits it to the EntryPoint singleton on the wallet's behalf. A **paymaster** can pay the gas, which is why a Kokio user never has to hold a cryptocurrency just to pay a fee.

`validateUserOp` is the account's half of that. The EntryPoint calls it before executing anything, and it answers whether the signature is good. It has to stay inside the ERC-4337 validation rules, which means no banned opcodes, no calls out to other contracts and no reading the clock. Expiry is not checked here at all; it is packed into the return value and handed to the EntryPoint, which does check it.

A signature failure returns a failure code rather than reverting. That is the standard's rule and it matters: a revert inside validation fails the whole bundle rather than the one operation that was wrong.

`execute` and `executeBatch` are what actually run once validation passes. `getDeposit`, `addDeposit` and `withdrawDepositTo` manage the account's gas balance held at the EntryPoint.

## The ERC-1271 side {#the-erc-1271-side}

ERC-1271 is how a contract answers "is this signature valid for you", so a smart account can sign a message the way a plain account does. Signing in to a service, approving an offchain order, anything that would normally take a personal signature.

`isValidSignature` is that answer, and there is one detail to get right. The challenge inside the assertion's `clientDataJSON` is not the message hash you pass in. It is an EIP-191 digest over five things: a version byte, a `validUntil` timestamp, the chain id, this account's address and the message hash. An offchain signer needs all five to produce something this will accept.

The signature itself is packed as one version byte, then six bytes of `validUntil`, then the ABI-encoded WebAuthn assertion.

The two entry points hash different precursors on purpose. A signature made for a user operation is not accepted as an ERC-1271 signature, and the reverse is also true.

## Where the signature is checked {#where-the-signature-is-checked}

Both paths end at the [P256 verifier](./p256-verifier.md), whose address this contract stores as an immutable. The verifier calls the [WebAuthn library](./webauthn.md), which tries the RIP-7212 precompile and falls back to FreshCryptoLib.

The EntryPoint address is immutable too, which keeps validation cheap. It also means moving to a new EntryPoint version is a new implementation behind the beacon, not a setter call.

## A note for anyone changing this contract {#storage-note}

`DeviceWallet` inherits this contract, and base storage comes first, so a device wallet's own variables begin immediately after `owner`. Adding a state variable here moves all of them on wallets that are already deployed, which then read back as zero. Anything this contract needs later belongs in its own ERC-7201 namespace, not in a slot following `owner`.

<!-- docgen:start source=smart-contract-suite/docs/aa-helper/Account4337.md -->
## Account4337 {#account4337}

ERC-4337 account owned by a P256 key rather than by an address

The owner never sends a transaction itself. It signs a WebAuthn assertion, and either the EntryPoint or this account calling into itself turns that into a call. Two entry points read signatures, `validateUserOp` for user operations and `isValidSignature` for ERC-1271, and each hashes a different precursor, so a signature made for one is not accepted by the other.

### entryPoint {#account4337-entrypoint}

```solidity
contract IEntryPoint entryPoint
```

The ERC-4337 EntryPoint singleton this account answers to

Immutable to keep validation cheap, which means moving to a new EntryPoint version is a new implementation rather than a setter call.

### verifier {#account4337-verifier}

```solidity
contract P256Verifier verifier
```

Contract that verifies every WebAuthn assertion for this account

### owner {#account4337-owner}

```solidity
bytes32[2] owner
```

X and Y co-ordinates of the P256 key that owns this account

DeviceWallet inherits this contract, and base storage comes first, so its own variables begin immediately after this one. A state variable added here moves all of them on wallets that are already deployed, which then read back as zero. Anything this contract needs later belongs in its own ERC-7201 namespace, not in a slot following `owner`.

### Account4337Initialized {#account4337-account4337initialized}

```solidity
event Account4337Initialized(contract IEntryPoint entryPoint, bytes32[2] owner)
```

Emitted once, when the account's owner key is first set

### AccountOwnershipTransferred {#account4337-accountownershiptransferred}

```solidity
event AccountOwnershipTransferred(bytes32[2] newOwner)
```

Emitted when the owner key is replaced

### onlySelf {#account4337-onlyself}

```solidity
modifier onlySelf()
```

Restricts a call to the account itself

The only way to satisfy this from outside is `execute` or `executeBatch` targeting this address, which the owner key has to have signed for.

### onlyEntryPoint {#account4337-onlyentrypoint}

```solidity
modifier onlyEntryPoint()
```

Restricts a call to the EntryPoint singleton

### constructor {#account4337-constructor}

```solidity
constructor(contract IEntryPoint _entryPoint, contract P256Verifier _verifier) public
```

Wires the entry point and WebAuthn verifier used by this account

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| _entryPoint | contract IEntryPoint | EntryPoint singleton this account validates against |
| _verifier | contract P256Verifier | Contract used to verify WebAuthn assertions |

### initialize {#account4337-initialize}

```solidity
function initialize(bytes32[2] anOwner) internal virtual
```

Sets the owner key on a freshly deployed account

Internal on purpose. A public setup function guarded only by `initializer` names no caller, so a proxy created without its init call in the same transaction could be claimed by anyone with an owner key of their choosing and none of the protocol wiring. Internal keeps the subclass path working and leaves no other way in.

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| anOwner | bytes32[2] | X,Y co-ordinates of the P256 key taking ownership |

### _initialize {#account4337-_initialize}

```solidity
function _initialize(bytes32[2] anOwner) internal virtual
```

Writes the owner key without the initializer guard

Split out so a subclass can reuse the write from its own initializer.

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| anOwner | bytes32[2] | X,Y co-ordinates of the P256 key taking ownership |

### execute {#account4337-execute}

```solidity
function execute(struct Call call) external
```

Makes one call from this account

Callable by the EntryPoint or by this account. There is no path here for the P256 key directly: it holds no address, so it reaches this only by signing a user operation.

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| call | struct Call | Target, value and calldata of the call to make |

### executeBatch {#account4337-executebatch}

```solidity
function executeBatch(struct Call[] calls) external
```

Makes a sequence of calls from this account, reverting all of them if one fails

Same callers as `execute`. Each entry carries its own value, so a batch that moves no ETH simply leaves every value at zero.

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| calls | struct Call[] | Targets, values and calldata, executed in order |

### isValidSignature {#account4337-isvalidsignature}

```solidity
function isValidSignature(bytes32 _messageHash, bytes _signature) external view returns (bytes4 magicValue)
```

Validates a signature over an arbitrary message, per ERC-1271

The challenge inside `clientDataJSON` is not `_messageHash`. It is the EIP-191 digest over version, validUntil, chain id, this address and `_messageHash`, so an offchain signer needs all five. Signature layout is version (1 byte) then validUntil (6 bytes) then the ABI-encoded WebAuthn assertion.

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| _messageHash | bytes32 | EIP-191 digest of the original message |
| _signature | bytes | Packed version, validUntil and WebAuthn assertion |

**Return Values**

| Name | Type | Description |
| ---- | ---- | ----------- |
| magicValue | bytes4 | `0x1626ba7e` when the signature is valid and unexpired, `0xffffffff` otherwise |

### validateUserOp {#account4337-validateuserop}

```solidity
function validateUserOp(struct PackedUserOperation userOp, bytes32 userOpHash, uint256 missingAccountFunds) external virtual returns (uint256 validationData)
```

Validate user's signature and nonce the entryPoint will make the call to the recipient only if this validation call returns successfully. signature failure should be reported by returning SIG_VALIDATION_FAILED (1). This allows making a "simulation call" without a valid signature Other failures (e.g. nonce mismatch, or invalid signature format) should still revert to signal failure.

Must stay within the ERC-4337 validation rules: no banned opcodes, no external calls to other contracts, no TIMESTAMP. Expiry is handed to the EntryPoint through the packed return value instead of being checked here.

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| userOp | struct PackedUserOperation | - The operation that is about to be executed. |
| userOpHash | bytes32 | - Hash of the user's request data. can be used as the basis for signature. |
| missingAccountFunds | uint256 | - Missing funds on the account's deposit in the entrypoint.                              This is the minimum amount to transfer to the sender(entryPoint) to be                              able to make the call. The excess is left as a deposit in the entrypoint                              for future calls. Can be withdrawn anytime using "entryPoint.withdrawTo()".                              In case there is a paymaster in the request (or the current deposit is high                              enough), this value will be zero. |

**Return Values**

| Name | Type | Description |
| ---- | ---- | ----------- |
| validationData | uint256 | - Packaged ValidationData structure. use `_packValidationData` and                              `_unpackValidationData` to encode and decode.                              <20-byte> aggregatorOrSigFail - 0 for valid signature, 1 to mark signature failure,                                 otherwise, an address of an "aggregator" contract.                              <6-byte> validUntil - Last timestamp this operation is valid at, or 0 for "indefinitely"                              <6-byte> validAfter - First timestamp this operation is valid                                                    If an account doesn't use time-range, it is enough to                                                    return SIG_VALIDATION_FAILED value (1) for signature failure.                              Note that the validation code cannot use block.timestamp (or block.number) directly. |

### transferOwnership {#account4337-transferownership}

```solidity
function transferOwnership(bytes32[2] newOwner) public virtual returns (bytes32[2])
```

Replaces the P256 key that owns this account

Reachable only through `execute` or `executeBatch` with this account as the target, so the current owner has to sign for it. Nothing outside this contract is told: a subclass holding its own record of the owner has to override this and keep that record in step.

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| newOwner | bytes32[2] | X,Y co-ordinates of the P256 key taking over |

**Return Values**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bytes32[2] | The owner key now in force |

### getDeposit {#account4337-getdeposit}

```solidity
function getDeposit() public view returns (uint256)
```

This account's gas deposit held by the EntryPoint

**Return Values**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | The deposited amount |

### addDeposit {#account4337-adddeposit}

```solidity
function addDeposit() public payable
```

Tops up this account's gas deposit at the EntryPoint

Open to anyone, since paying another account's gas costs the payer and nobody else.

### withdrawDepositTo {#account4337-withdrawdepositto}

```solidity
function withdrawDepositTo(address payable withdrawAddress, uint256 amount) public
```

Withdraws part of this account's gas deposit from the EntryPoint

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| withdrawAddress | address payable | Recipient of the withdrawn ETH |
| amount | uint256 | Amount to withdraw |

### _requireFromEntryPointOrOwner {#account4337-_requirefromentrypointorowner}

```solidity
function _requireFromEntryPointOrOwner() internal view
```

Reverts unless the caller is the EntryPoint or this account itself

"Owner" in the name means `address(this)`, not the P256 key, which has no address to call from.

### _call {#account4337-_call}

```solidity
function _call(address target, uint256 value, bytes data) internal
```

Calls a target and bubbles its revert data unchanged

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| target | address | Address to call |
| value | uint256 | ETH to send with the call |
| data | bytes | Calldata for the call |

### receive {#account4337-receive}

```solidity
receive() external payable
```

Accepts plain ETH transfers
<!-- docgen:end -->
