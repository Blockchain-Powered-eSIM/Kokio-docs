---
title: ProtocolAdmin
description: The timelock that owns Kokio's upgradeable contracts, the two day delay on every change, and the four things a guardian can do without waiting.
---

# Protocol admin {#protocol-admin}

The timelock that owns every upgradeable Kokio contract, and the four things a guardian can do without waiting.

---

`ProtocolAdmin` is the timelock that owns the five upgradeable contracts in the [Kokio suite](./overview.md):

- the [Registry](./registry.md)
- the [lazy wallet registry](./lazy-wallet-registry.md)
- the [device wallet factory](./device-wallet-factory.md)
- the [eSIM wallet factory](./esim-wallet-factory.md)
- the [payment adapter](./payment-adapter.md)

Both wallet beacons sit under the two factories, so owning the factories reaches every [device wallet](./device-wallet.md) and every [eSIM wallet](./esim-wallet.md) in the protocol.

It replaces the single account that would otherwise own all of that. Nobody holds a key that can upgrade a Kokio contract on the spot.

![Who can change what in Kokio, and how fast. A proposer Safe schedules and cancels, a canceller only cancels, and anyone can execute once the two day delay has passed. Scheduled operations become owner actions on the five contracts ProtocolAdmin owns, which in turn reach every device and eSIM wallet through the factory-owned beacons. A guardian Safe can pause, unpause, suspend the admin key and revoke cancellers with no delay. The backend admin key can register wallets, deploy eSIM wallets, assign eSIM ids, record purchases and pause, and can only spend a wallet's tokens on data bundles within the admin allowance the user sets, which is zero by default. The user's passkey owns the device and eSIM wallets and sets their price cap and admin allowance.](../../resources/governance.png)

## Every change waits {#every-change-waits}

A privileged change goes one way:

1. A proposer schedules it.
2. The delay elapses.
3. Anyone at all executes it.

On both Base networks the delay is two days, and the floor below which it cannot be set is one day. Both are listed on the [Base mainnet](../deployments/base.md) and [Base Sepolia](../deployments/base-sepolia.md) pages.

Execution being open is deliberate. The announcement is what the delay buys, and once the wait is served there is no reason for the protocol to depend on one particular key still being around to press the button.

`getMinDelay` reads the current delay. Lowering it is itself a scheduled change, so it waits out the old delay first.

## What a guardian can do {#what-a-guardian-can-do}

A guardian has no general fast path. It can say exactly four things, and each is written as its own function rather than as a payload, so no fifth sentence is expressible however the role is held:

1. **Raise a pause**, with `pauseInstantly`. The admin key can already do this, but not while it is suspended or being replaced, and that is when a pause is most likely to be needed.
2. **Release a pause**, with `unpauseInstantly`. An upgrade that waits is reviewable. An outage that waits is just an outage.
3. **Take `CANCELLER_ROLE` away from an account**, with `revokeCancellersInstantly`.
4. **Suspend the protocol's admin key**, with `disableAdminInstantly`.

None of the four grants anything, which is what keeps the role away from user funds. A pause stops purchases and fund pulls but never a wallet owner's own `execute`, so users can still spend their ETH. Stripping a canceller cannot move money. A suspended admin is an admin that has stopped being able to spend, not one the guardian chose.

Restoring a canceller or an admin is an owner action and waits out the delay, so the side taking power away always wins the race against the side handing it back.

Replacing the admin is not a guardian power. `disableAndNominate` suspends the current admin and nominates a new one in one scheduled operation, so it waits like any other change.

:::warning
`disableAndNominate` refuses to nominate the current admin (`NomineeIsTheIncumbent`). The registry would read that as withdrawing the nomination and lift the suspension.
:::

## Why a guardian can evict a canceller {#why-a-guardian-can-evict-a-canceller}

The third power looks out of place beside the others. Without it, a compromised canceller is permanent. Evicting any role holder means scheduling `revokeRole`; a scheduled operation can be cancelled by any canceller; so a compromised canceller cancels its own eviction forever. Nothing else breaks that loop, because every other route waits on the delay.

Two limits carry the recovery argument, and both are enforced in code rather than written down as policy:

- A guardian may not hold `CANCELLER_ROLE` itself. Otherwise it could revoke every other canceller, become the only one, and cancel its own eviction.
- A guardian may not touch `PROPOSER_ROLE`. Reaching zero proposers is unrecoverable: re-granting any role needs a scheduled operation, and scheduling needs a proposer, so nothing could be upgraded or reconfigured again. A guardian could still raise and release a pause, and nothing more.

Reaching zero cancellers is survivable by comparison. It costs the veto, and a proposer can schedule the role back.

One limit is not enforced in code. A rogue guardian and a rogue proposer together can strip every canceller and then schedule changes nobody can veto. The strip power stays because it is the only way out of a compromised canceller.

:::warning
Keep the guardian's and the proposers' Safes on different signers, and alert on every `CancellerRevoked` event.
:::

## Not upgradeable {#not-upgradeable}

Deliberately. An upgradeable owner of upgradeable contracts moves the trust to whoever can upgrade the owner, and there is no delay left to protect that step.

<!-- docgen:start source=smart-contract-suite/docs/admin/ProtocolAdmin.md -->
## ProtocolAdmin {#protocoladmin}

Owner of the five upgradeable protocol contracts, with a delay on every change

Owns `Registry`, `LazyWalletRegistry`, `DeviceWalletFactory`, `ESIMWalletFactory` and `PaymentAdapter` once `TransferOwnership.s.sol` has run, and through the factories both wallet beacons.

Proposers schedule, the delay runs, then anyone may execute, so no single key has to stay available. The delay is the safeguard.

A guardian has exactly four powers, each its own function so nothing else is expressible: 1. Raise a pause, which still works while the admin key is suspended. 2. Release a pause, since an outage should not wait out the delay. 3. Strip `CANCELLER_ROLE`. Without it a canceller can cancel its own eviction forever. 4. Suspend the admin key. None grants anything, and restoring a canceller or admin waits, so taking power away wins.

A guardian may not hold `CANCELLER_ROLE`, or it could become the only canceller. It may not touch `PROPOSER_ROLE`: with no proposers, nothing can ever be scheduled again.

Known limit: a rogue guardian plus a rogue proposer can strip every canceller. Keep their Safes on disjoint signers and alert on `CancellerRevoked`.

Not upgradeable: an upgradeable owner would move the trust to whoever can upgrade it.

### GUARDIAN_ROLE {#protocoladmin-guardian_role}

```solidity
bytes32 GUARDIAN_ROLE
```

Raises and releases a pause, strips a canceller and suspends the admin, all without waiting for the delay

Always paired with `EXECUTOR_ROLE`, so it still works if open execution is closed. Never paired with `CANCELLER_ROLE`, which would make a guardian impossible to evict.

### minDelayFloor {#protocoladmin-mindelayfloor}

```solidity
uint256 minDelayFloor
```

Shortest delay this contract will ever accept, whatever `updateDelay` was given

`updateDelay` accepts zero, so without a floor one scheduled call would remove the delay for good. Applied through `getMinDelay`, which `schedule` checks against.

### PauseRaised {#protocoladmin-pauseraised}

```solidity
event PauseRaised(address target, address guardian)
```

A guardian raised a pause

### PauseReleased {#protocoladmin-pausereleased}

```solidity
event PauseReleased(address target, address guardian)
```

A guardian released a pause

### CancellerRevoked {#protocoladmin-cancellerrevoked}

```solidity
event CancellerRevoked(address account, address guardian)
```

A guardian took the cancel power away from an account

### AdminDisabled {#protocoladmin-admindisabled}

```solidity
event AdminDisabled(address target, address guardian)
```

A guardian suspended a protocol contract's admin key

### AdminDisabledAndNominated {#protocoladmin-admindisabledandnominated}

```solidity
event AdminDisabledAndNominated(address target, address newAdmin)
```

A scheduled operation suspended an admin key and nominated its replacement

### OwnershipAccepted {#protocoladmin-ownershipaccepted}

```solidity
event OwnershipAccepted(address target)
```

Ownership of a protocol contract was accepted

### DelayBelowFloor {#protocoladmin-delaybelowfloor}

```solidity
error DelayBelowFloor(uint256 delay, uint256 floor)
```

The initial delay was below the floor

### NoGuardians {#protocoladmin-noguardians}

```solidity
error NoGuardians()
```

No guardian was named at construction

### NoProposers {#protocoladmin-noproposers}

```solidity
error NoProposers()
```

No proposer was named at construction

### ZeroAddress {#protocoladmin-zeroaddress}

```solidity
error ZeroAddress(string parameter)
```

A zero address appeared in one of the constructor role lists

### RolesMustNotOverlap {#protocoladmin-rolesmustnotoverlap}

```solidity
error RolesMustNotOverlap(address account)
```

An account was named in two role lists that have to stay separate

### NotACanceller {#protocoladmin-notacanceller}

```solidity
error NotACanceller(address account)
```

The account named does not hold the cancel power

### OwnershipNotOffered {#protocoladmin-ownershipnotoffered}

```solidity
error OwnershipNotOffered(address target)
```

The contract was not offered ownership of this target

### NomineeIsTheIncumbent {#protocoladmin-nomineeistheincumbent}

```solidity
error NomineeIsTheIncumbent(address target, address admin)
```

A replacement nomination named the admin already on the books

### constructor {#protocoladmin-constructor}

```solidity
constructor(uint256 _initialDelay, uint256 _minDelayFloor, address[] _proposers, address[] _cancellers, address[] _guardians) public
```

Sets up the timelock's roles and delay bounds

No admin account: this contract holds its own `DEFAULT_ADMIN_ROLE`, so every role change is scheduled and waited out. Rotating signers never touches the protocol contracts.

Proposers also get `CANCELLER_ROLE` from the base. `_cancellers` is for veto-only keys, typically the signers behind a proposer multisig, so one key can veto but not schedule.

`EXECUTOR_ROLE` on the zero address opens execution to everyone.

Empty `_cancellers` is fine, as proposers already cancel. Empty `_guardians` is not: adding one would wait out the delay, and nothing could evict a compromised canceller.

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| _initialDelay | uint256 | Delay new operations wait before they can be executed |
| _minDelayFloor | uint256 | Shortest delay `updateDelay` can ever bring the contract down to |
| _proposers | address[] | Accounts that may schedule operations, and that may also cancel them |
| _cancellers | address[] | Further accounts that may cancel, holding no other role |
| _guardians | address[] | Accounts holding the four guardian powers |

### getMinDelay {#protocoladmin-getmindelay}

```solidity
function getMinDelay() public view virtual returns (uint256)
```

Never below the floor, whatever `updateDelay` stored. `schedule` reads this, so the floor binds without intercepting the setter. Offchain readers should call this rather than follow `MinDelayChange`, which reports the stored value.

### grantRole {#protocoladmin-grantrole}

```solidity
function grantRole(bytes32 role, address account) public virtual
```

Enforces the constructor's guardian overlap rules on later grants, so one proposer cannot schedule the pairing that makes a guardian impossible to evict.

Authority is checked first, as in the base, so an unauthorized caller still gets `AccessControlUnauthorizedAccount` rather than an overlap error.

The canceller and proposer split is not enforced here. It only shapes the deployment, and pairing those roles later is a fair call for a scheduled operation.

A new guardian gets `EXECUTOR_ROLE` too, as in the constructor. `revokeRole` cannot tell that grant apart, so evicting a guardian means revoking both in one batch.

### pauseInstantly {#protocoladmin-pauseinstantly}

```solidity
function pauseInstantly(address target) external
```

Raises a pause on a protocol contract immediately

A rogue guardian can only stop the protocol, which the admin key could already do, and it can be released at once.

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| target | address | Contract to pause |

### unpauseInstantly {#protocoladmin-unpauseinstantly}

```solidity
function unpauseInstantly(address target) external
```

Releases a pause on a protocol contract immediately

The selector is fixed, so this cannot call anything else on the target. The worst a rogue guardian can do is unpause something, which can be paused again.

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| target | address | Contract to unpause |

### revokeCancellersInstantly {#protocoladmin-revokecancellersinstantly}

```solidity
function revokeCancellersInstantly(address[] accounts) external
```

Takes the cancel power away from accounts immediately

Only `CANCELLER_ROLE`, and restoring it is scheduled. A batch because one signer set often holds the role on several keys, and one transaction beats the operation it races.

All or nothing. An account without the role reverts, so a guardian never wrongly believes a veto is gone.

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| accounts | address[] | Accounts to strip |

### disableAdminInstantly {#protocoladmin-disableadmininstantly}

```solidity
function disableAdminInstantly(address target) external
```

Suspends a protocol contract's admin key immediately

Against a compromised admin key, which holds `Registry.pause` and could re-pause after every release for the whole delay. Suspending it makes `unpauseInstantly` stick.

Grants nothing. Only the owner, after the delay, can reinstate or replace the key, so the worst a rogue guardian can cause is a stopped backend that the owner ends.

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| target | address | Contract whose admin is being suspended |

### disableAndNominate {#protocoladmin-disableandnominate}

```solidity
function disableAndNominate(address target, address newAdmin) external
```

Suspends the current admin and nominates its replacement in one operation

Scheduled like anything else, not a fast path. A pending nomination already suspends the incumbent, and naming that effect lets a reviewer read the intent off the operation.

The nominee must still accept, so the role cannot go to an address that cannot act.

The incumbent is refused: the registry would read it as a withdrawal and lift the suspension.

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| target | address | Contract whose admin is being replaced |
| newAdmin | address | Address nominated to take the role |

### acceptOwnershipBatch {#protocoladmin-acceptownershipbatch}

```solidity
function acceptOwnershipBatch(address[] targets) external
```

Completes the handover of every contract that has offered this one its ownership

Permissionless because the current owner's offer is the decision. Scheduling it would make even the deployment wait out the delay.

Events go before each call so they keep order with the target's own, and a failed handover reverts the batch, so no event outlives its call.

Any contract can fake `pendingOwner()` and `acceptOwnership()`, so `OwnershipAccepted` is only a claim. Filter it against the expected targets. A fake costs nothing more: this contract holds no funds, and a target cannot gain a role by being called.

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| targets | address[] | Contracts whose `pendingOwner` is this address |
<!-- docgen:end -->
