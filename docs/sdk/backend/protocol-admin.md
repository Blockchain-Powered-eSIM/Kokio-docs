---
title: Protocol admin (backend)
description: admin.protocolAdmin drives the Kokio timelock that owns the registry, both factories and the payment adapter, scheduling, executing and cancelling privileged calls behind a delay.
---

# Protocol admin (backend) {#protocol-admin-backend}

`admin.protocolAdmin`

The Kokio timelock that owns the [registry](./registry.md), the [lazy wallet registry](./lazy-wallet-registry.md), both wallet factories and the [payment adapter](./payments.md). Any change to those contracts that needs `onlyOwner` goes through here: a proposer announces it, a delay passes, and anyone can then run it. This is what stands between one compromised key and an instant change to five contracts.

On the live deployment the delay is two days and the floor below which it cannot go is one hour. The current values, along with who holds which role, are on the [deployed addresses](../../contracts/deployments.md) page. `getMinDelay()` reads the real one.

Four role-scoped surfaces do the work.

| Surface | What it does | Role needed |
|---|---|---|
| `proposer` | schedules a call | `PROPOSER_ROLE` |
| `executor` | runs a call once its delay has passed | none, anyone can execute a ready operation |
| `canceller` | cancels a call before it runs | `CANCELLER_ROLE`, which every proposer also holds |
| `guardian` | bypasses the delay for three emergency actions | `GUARDIAN_ROLE` |

```ts
const op = await admin.protocolAdmin.proposer.schedule({
  address: registryAddress,
  abi: Registry,
  functionName: "updateVaultAddress",
  args: [newVault],
});
// ... wait out admin.protocolAdmin.getMinDelay() ...
await admin.protocolAdmin.executor.execute(op);
```

Keep whatever `schedule` returns. The timelock recomputes an operation's id from those fields and there is no way to look one up afterwards without them.

## proposer.schedule {#proposer-schedule}

Announces a single owner call. Use it for most changes: build the call as an `OwnerCall` object, or use one of the `*Call` builders on `registry`, `deviceWalletFactory` and the others.

```ts
const scheduled = await admin.protocolAdmin.proposer.schedule(
  call,      // an OwnerCall
  {},        // optional OperationOptions: { salt?, predecessor? }
  undefined, // optional delay in seconds, defaults to getMinDelay()
);
```

Returns `Promise<ScheduledOperation>`, shaped `{ hash, id, target, value, payload, predecessor, salt, delay }`.

## proposer.scheduleBatch {#proposer-schedulebatch}

Announces several owner calls as a single operation that runs together or not at all. Use it when the calls only make sense as a set, for example revoking both a guardian's guardian role and its executor role in one step.

```ts
const scheduled = await admin.protocolAdmin.proposer.scheduleBatch(calls); // OwnerCall[]
```

Returns `Promise<ScheduledBatchOperation>`, shaped `{ hash, id, targets, values, payloads, predecessor, salt, delay }`.

## proposer.scheduleRaw {#proposer-scheduleraw}

Schedules a call built from calldata that did not come from this SDK's ABIs. Use it only when you already have the raw target, value and payload bytes. Otherwise use `schedule`.

```ts
const scheduled = await admin.protocolAdmin.proposer.scheduleRaw(target, value, payload, predecessor, salt, delay);
```

Returns `Promise<ScheduledOperation>`.

## executor.execute {#executor-execute}

Runs a scheduled operation once its delay has passed. Anyone with a funded account can call this, no role needed. Pass back exactly what `schedule` returned: the timelock recomputes the operation's id from those fields, and a changed value looks up an operation that was never scheduled.

```ts
const hash = await admin.protocolAdmin.executor.execute(scheduled);
```

Returns `Promise<Hash>`.

## executor.executeBatch {#executor-executebatch}

Runs a scheduled batch. Open to anyone, the same as `execute`.

```ts
const hash = await admin.protocolAdmin.executor.executeBatch(scheduledBatch);
```

Returns `Promise<Hash>`.

## executor.executeRaw {#executor-executeraw}

Executes a call scheduled through `scheduleRaw`.

```ts
const hash = await admin.protocolAdmin.executor.executeRaw(target, value, payload, predecessor, salt);
```

Returns `Promise<Hash>`.

## canceller.cancel {#canceller-cancel}

Drops a scheduled operation before it runs. Needs `CANCELLER_ROLE`, which every proposer also holds, so a proposer can cancel its own mistakes.

```ts
const hash = await admin.protocolAdmin.canceller.cancel(operationId);
```

Returns `Promise<Hash>`.

## guardian.unpauseInstantly {#guardian-unpauseinstantly}

Releases a pause on a protocol contract immediately, with no delay. Needs `GUARDIAN_ROLE`. Use it during an incident, when waiting out the normal delay is not acceptable.

```ts
const hash = await admin.protocolAdmin.guardian.unpauseInstantly(registryAddress);
```

Returns `Promise<Hash>`.

## guardian.revokeCancellersInstantly {#guardian-revokecancellersinstantly}

Strips the cancel role from a list of accounts immediately. Use it to shut down compromised proposer or canceller keys before they can cancel a legitimate pending operation.

All or nothing: if any listed account does not actually hold the role, the whole call reverts rather than skipping that one quietly.

```ts
const hash = await admin.protocolAdmin.guardian.revokeCancellersInstantly([addr1, addr2]);
```

Returns `Promise<Hash>`.

## guardian.disableAdminInstantly {#guardian-disableadmininstantly}

Suspends a contract's admin key immediately, with no delay. Use it during an incident, if the backend's admin key looks compromised. This only takes power away. Giving it back or naming a replacement is an owner action and waits the normal delay.

`target` defaults to the registry, which is where every other contract looks up the admin address, so suspending it there closes every admin-gated call across the whole protocol.

```ts
const hash = await admin.protocolAdmin.guardian.disableAdminInstantly();
```

Returns `Promise<Hash>`.

## acceptOwnershipBatch {#acceptownershipbatch}

Accepts ownership of every contract that has already offered it to the timelock, in one call. Use it once, when setting the timelock up as owner. Reverts if any target in the list has not actually offered ownership yet, so check `pendingOwner` on each contract first.

```ts
const hash = await admin.protocolAdmin.acceptOwnershipBatch([registryAddress, deviceWalletFactoryAddress]);
```

Returns `Promise<Hash>`.

## renounceRole {#renouncerole}

Gives up one of your own roles. This is the one role change that does not need scheduling, because the chain requires the caller to be the account losing the role.

```ts
const hash = await admin.protocolAdmin.renounceRole(role, account);
```

Returns `Promise<Hash>`.

## grantRoleCall {#grantrolecall}

Builds the call payload to grant a role to an account. Hand the result to `proposer.schedule`. Granting a role is a self-call on the timelock and has no other way to run.

```ts
const call = await admin.protocolAdmin.grantRoleCall(role, account);
const scheduled = await admin.protocolAdmin.proposer.schedule(call);
```

Returns `Promise<OwnerCall>`.

## revokeRoleCall {#revokerolecall}

Builds the call payload to revoke a role from an account. Same pattern as `grantRoleCall`.

Evicting a guardian takes two of these scheduled together in one `scheduleBatch` call, its guardian role and its executor role. The revoke call cannot tell that the two were granted as a pair.

```ts
const call = await admin.protocolAdmin.revokeRoleCall(role, account);
const scheduled = await admin.protocolAdmin.proposer.schedule(call);
```

Returns `Promise<OwnerCall>`.

## updateDelayCall {#updatedelaycall}

Builds the call payload to change the timelock's delay. `minDelayFloor` still applies underneath, so the delay can never drop below the floor whatever this sets.

```ts
const call = await admin.protocolAdmin.updateDelayCall(newDelaySeconds);
const scheduled = await admin.protocolAdmin.proposer.schedule(call);
```

Returns `Promise<OwnerCall>`.

## disableAndNominateCall {#disableandnominatecall}

Builds the call payload to suspend a contract's admin and name its replacement in one step. The nominee still has to accept separately, and the role stays dormant until then.

```ts
const call = await admin.protocolAdmin.disableAndNominateCall(target, newAdmin);
const scheduled = await admin.protocolAdmin.proposer.schedule(call);
```

Returns `Promise<OwnerCall>`.

## disableAdminCall {#disableadmincall}

Builds the call payload to suspend a contract's admin key on the normal, delayed route. Prefer `guardian.disableAdminInstantly` during an actual incident. This is for a planned suspension.

`target` defaults to the registry.

```ts
const call = await admin.protocolAdmin.disableAdminCall();
const scheduled = await admin.protocolAdmin.proposer.schedule(call);
```

Returns `Promise<OwnerCall>`.

## enableAdminCall {#enableadmincall}

Builds the call payload to give a suspended admin its powers back. This is the only way to lift a suspension. There is no instant guardian form of it, by design.

`target` defaults to the registry.

```ts
const call = await admin.protocolAdmin.enableAdminCall();
const scheduled = await admin.protocolAdmin.proposer.schedule(call);
```

Returns `Promise<OwnerCall>`.

## unpauseCall {#unpausecall}

Builds the call payload to release a pause on the normal, delayed route. Use `guardian.unpauseInstantly` instead if the wait is not acceptable.

`target` defaults to the registry.

```ts
const call = await admin.protocolAdmin.unpauseCall();
const scheduled = await admin.protocolAdmin.proposer.schedule(call);
```

Returns `Promise<OwnerCall>`.

## setDefaultPriceCapUSDCentsCall {#setdefaultpricecapusdcentscall}

Builds the call payload to set the registry's fallback price cap, in US cents. A zero cap only fails when this eventually executes, not when it is scheduled, so a mistake here costs the whole delay before it is caught.

`target` defaults to the registry.

```ts
const call = await admin.protocolAdmin.setDefaultPriceCapUSDCentsCall(cap);
const scheduled = await admin.protocolAdmin.proposer.schedule(call);
```

Returns `Promise<OwnerCall>`.

## setPaymentAdapterCall {#setpaymentadaptercall}

Builds the call payload to point the registry at a new payment adapter. Owner only, deliberately not the admin: the adapter holds the spent payment references, so an admin that could swap it would get an empty set back and could record every purchase a second time.

`target` defaults to the registry.

```ts
const call = await admin.protocolAdmin.setPaymentAdapterCall(paymentAdapterAddress);
const scheduled = await admin.protocolAdmin.proposer.schedule(call);
```

Returns `Promise<OwnerCall>`.

## operationId {#operationid}

Works out the id an `OwnerCall` will be filed under, without scheduling it. Computed onchain, so the SDK and the contract never disagree about it.

```ts
const id = await admin.protocolAdmin.operationId(call);
```

Returns `Promise<Hex>`.

## operationIdBatch {#operationidbatch}

The same as `operationId`, for a batch. A batch hashes differently from the same calls scheduled one at a time.

```ts
const id = await admin.protocolAdmin.operationIdBatch(calls);
```

Returns `Promise<Hex>`.

## operationIdRaw {#operationidraw}

The same as `operationId`, for a payload built outside this SDK.

```ts
const id = await admin.protocolAdmin.operationIdRaw(target, value, payload, predecessor, salt);
```

Returns `Promise<Hex>`.

## operationIdBatchRaw {#operationidbatchraw}

The same as `operationIdBatch`, for raw payloads.

```ts
const id = await admin.protocolAdmin.operationIdBatchRaw(targets, values, payloads, predecessor, salt);
```

Returns `Promise<Hex>`.

## getMinDelay {#getmindelay}

Reads the shortest delay a new operation will get right now. This is what `schedule` uses when no delay is passed explicitly.

```ts
const delay = await admin.protocolAdmin.getMinDelay();
```

Returns `Promise<bigint>`, in seconds.

## minDelayFloor {#mindelayfloor}

Reads the immutable floor `getMinDelay` is clamped to. `updateDelayCall` can never push the delay below this.

```ts
const floor = await admin.protocolAdmin.minDelayFloor();
```

Returns `Promise<bigint>`, in seconds.

## getOperationState {#getoperationstate}

Reads where an operation is in its lifecycle.

```ts
const state = await admin.protocolAdmin.getOperationState(operationId);
```

Returns `Promise<OperationState>`, one of `Unset`, `Waiting`, `Ready` or `Done`.

## getTimestamp {#gettimestamp}

Reads when an operation becomes executable, as a Unix timestamp. Reads `0` for an operation the timelock has never seen and `1` for one already executed, so check `getOperationState` rather than treating every value here as a real time.

```ts
const readyAt = await admin.protocolAdmin.getTimestamp(operationId);
```

Returns `Promise<bigint>`.

## isOperation {#isoperation}

Checks whether the timelock has ever seen this operation id.

```ts
const known = await admin.protocolAdmin.isOperation(operationId);
```

Returns `Promise<boolean>`.

## isOperationPending {#isoperationpending}

Checks whether an operation is scheduled and not yet executed, whether or not its delay has passed.

```ts
const pending = await admin.protocolAdmin.isOperationPending(operationId);
```

Returns `Promise<boolean>`.

## isOperationReady {#isoperationready}

Checks whether an operation's delay has passed and it can be executed now.

```ts
const ready = await admin.protocolAdmin.isOperationReady(operationId);
```

Returns `Promise<boolean>`.

## isOperationDone {#isoperationdone}

Checks whether an operation has already run.

```ts
const done = await admin.protocolAdmin.isOperationDone(operationId);
```

Returns `Promise<boolean>`.

## hasRole {#hasrole}

Checks whether an account holds a given role. Get the role's id from one of the `*_ROLE` methods below.

```ts
const proposerRole = await admin.protocolAdmin.PROPOSER_ROLE();
const canPropose = await admin.protocolAdmin.hasRole(proposerRole, account);
```

Returns `Promise<boolean>`.

## getRoleAdmin {#getroleadmin}

Reads the role that can grant or revoke a given role. Always `DEFAULT_ADMIN_ROLE`, which only the timelock itself holds, so every role change on this contract is a scheduled operation rather than a direct call.

```ts
const adminRole = await admin.protocolAdmin.getRoleAdmin(role);
```

Returns `Promise<Hex>`.

## DEFAULT_ADMIN_ROLE {#default-admin-role}

Reads this role's id off the contract. Held only by the timelock itself.

```ts
const role = await admin.protocolAdmin.DEFAULT_ADMIN_ROLE();
```

Returns `Promise<Hex>`.

## PROPOSER_ROLE {#proposer-role}

Reads this role's id off the contract. Lets an account call `proposer.schedule` and `canceller.cancel`.

```ts
const role = await admin.protocolAdmin.PROPOSER_ROLE();
```

Returns `Promise<Hex>`.

## CANCELLER_ROLE {#canceller-role}

Reads this role's id off the contract. Lets an account call `canceller.cancel` and nothing else.

```ts
const role = await admin.protocolAdmin.CANCELLER_ROLE();
```

Returns `Promise<Hex>`.

## EXECUTOR_ROLE {#executor-role}

Reads this role's id off the contract. Granted to the zero address onchain, which is what makes `executor.execute` open to anyone.

```ts
const role = await admin.protocolAdmin.EXECUTOR_ROLE();
```

Returns `Promise<Hex>`.

## GUARDIAN_ROLE {#guardian-role}

Reads this role's id off the contract. Cannot be held by the same account as `PROPOSER_ROLE` or `CANCELLER_ROLE` on the live deployment, which keeps the guardian's instant powers separate from the timelock's delayed ones.

```ts
const role = await admin.protocolAdmin.GUARDIAN_ROLE();
```

Returns `Promise<Hex>`.
