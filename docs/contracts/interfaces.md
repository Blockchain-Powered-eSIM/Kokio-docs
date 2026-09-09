---
title: Interfaces
description: The four narrow interfaces in the Kokio suite, why each one leaves out more than it includes, and what that says about who is allowed to do what.
---

# Interfaces {#interfaces}

Four small interfaces sit between the contracts in the Kokio [suite](./overview.md). Each is a deliberately narrow view of a larger contract, declared so the compiler checks a signature that gets called across a boundary.

They are worth reading for what they leave out. Each of these is a list of the only things one contract is allowed to say to another, and in three of the four cases the omission is the security property.

| Interface | Whose view it is | What it holds |
|---|---|---|
| `IPausable` | What [`ProtocolAdmin`](./protocol-admin.md) may do to the pause | `unpause()` alone |
| `IRegistryAdmin` | What `ProtocolAdmin` may do to the admin role | `disableAdmin()` and `requestAdminUpdate()` |
| `IPaymentRegistry` | What the [payment adapter](./payment-adapter.md) reads from the [Registry](./registry.md) | `vault()` and `isESIMWalletValid()` |
| `IOwnable2Step` | What an incoming owner needs to accept a handover | `acceptOwnership()` and `pendingOwner()` |

## Why the omissions matter {#why-the-omissions-matter}

`IPausable` holds `unpause()` and not `pause()`. Raising a pause is the hot admin key's lever and releasing one is the timelock's, so the two are deliberately not offered through the same interface.

`IRegistryAdmin` holds `disableAdmin` and `requestAdminUpdate`, and leaves out `enableAdmin` for the mirror-image reason. The owner reaches it as an ordinary scheduled payload, which waits out the delay. Putting it in this interface would invite a named function beside the guardian's, which is the one place a fast path could be added by accident. Suspending is instant and restoring waits, and that split is what stops a compromised key from undoing its own suspension.

`IPausable` and `IRegistryAdmin` exist at all because a guardian acts with no delay. A drift between what `ProtocolAdmin` calls and what `Registry` offers would only show up as a revert during an incident, which is the worst possible time to find out. Declaring the two signatures makes the compiler check them instead.

`IPaymentRegistry` is an interface rather than an import of `Registry`, because `Registry` already imports the adapter and the two cannot import each other. It also keeps the adapter's view of the registry down to the two things it actually reads.

`IOwnable2Step` matches the part of OpenZeppelin's `Ownable2Step` an incoming owner needs. An offer is made by the current owner and completed by the nominee, so a contract taking ownership only ever calls these two.

<!-- docgen:start source=smart-contract-suite/docs/interfaces/IPausable.md -->
## IPausable {#ipausable}

Minimal view of the pause a guardian is allowed to release

Only `unpause()` is here. Raising a pause is the hot admin key's lever and releasing one is the timelock's, so the two are deliberately not offered through the same interface.

### unpause {#ipausable-unpause}

```solidity
function unpause() external
```

Clears the pause
<!-- docgen:end -->

<!-- docgen:start source=smart-contract-suite/docs/interfaces/IRegistryAdmin.md -->
## IRegistryAdmin {#iregistryadmin}

Minimal view of the admin role the protocol owner controls

Holds only the two calls `ProtocolAdmin` makes. `enableAdmin` is deliberately absent: the owner reaches it as an ordinary scheduled payload, and putting it here would invite a named function beside the guardian's, which is the one place a fast path could be added by accident. Suspending is instant and restoring waits, and the split is what stops a compromised key from undoing its own suspension.

### disableAdmin {#iregistryadmin-disableadmin}

```solidity
function disableAdmin() external
```

Suspends the admin's powers protocol-wide, leaving its address on the books

### requestAdminUpdate {#iregistryadmin-requestadminupdate}

```solidity
function requestAdminUpdate(address _newAdmin) external
```

Nominates a new admin, which strips the incumbent until the nominee accepts

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| _newAdmin | address | Address of the recipient to receive the admin role |
<!-- docgen:end -->

<!-- docgen:start source=smart-contract-suite/docs/interfaces/IPaymentRegistry.md -->
## IPaymentRegistry {#ipaymentregistry}

The two things the payment adapter asks the registry on a settlement

An interface rather than an import of `Registry`, which already imports the adapter. It also keeps the adapter's view of the registry down to what it reads.

### vault {#ipaymentregistry-vault}

```solidity
function vault() external view returns (address)
```

Address that receives payments for data bundles

**Return Values**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | The vault address |

### isESIMWalletValid {#ipaymentregistry-isesimwalletvalid}

```solidity
function isESIMWalletValid(address eSIMWallet) external view returns (address)
```

The device wallet an eSIM wallet belongs to, or zero if the registry has no record

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| eSIMWallet | address | The eSIM wallet to look up |

**Return Values**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | The owning device wallet, or the zero address if unrecognized |
<!-- docgen:end -->

<!-- docgen:start source=smart-contract-suite/docs/interfaces/IOwnable2Step.md -->
## IOwnable2Step {#iownable2step}

Minimal view of the two-step ownership handover the protocol contracts use

Matches the part of OpenZeppelin's `Ownable2Step` an incoming owner needs. The offer is made by the current owner and completed by the nominee, so a contract taking ownership only ever calls these two.

### acceptOwnership {#iownable2step-acceptownership}

```solidity
function acceptOwnership() external
```

Completes a handover the current owner already offered to the caller

### pendingOwner {#iownable2step-pendingowner}

```solidity
function pendingOwner() external view returns (address)
```

Address the current owner has offered ownership to, or zero

**Return Values**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | The nominated address |
<!-- docgen:end -->
