---
title: Lazy wallet registry (backend)
description: admin.lazyWalletRegistry records purchases for Kokio users who bought an eSIM before they had a wallet, then deploys their wallets and copies that history across.
---

# Lazy wallet registry (backend) {#lazy-wallet-registry-backend}

`admin.lazyWalletRegistry`

Handles Kokio users who bought an eSIM before they had a device wallet, for example through a fiat checkout instead of the app. Their purchase history is recorded here first. Their device wallet and eSIM wallets are deployed later, and the history is copied onto the real wallets once those exist. Available as soon as [`KokioAdmin`](./setup.md) exists. The contract is documented at [LazyWalletRegistry](../../contracts/lazy-wallet-registry.md).

The order matters: record history first, deploy second, copy third. The deploy step refuses a device that already has a wallet and expects its history to be on record already.

Deploying a device and copying its history both take more than one onchain transaction once a device has enough eSIMs or purchases. The run-to-completion methods below handle that pagination for you and can be retried safely if a call is interrupted partway through. Use those for normal work, and reach for the single-transaction versions only if you want to drive the batching yourself.

```ts
await admin.lazyWalletRegistry.batchPopulateHistory(deviceIds, eSIMIdsPerDevice, purchasesPerDevice);
const deployment = await admin.lazyWalletRegistry.deployLazyWalletAndSetESIMIdentifier(
  ownerKey, deviceUniqueIdentifier, salt, depositAmount,
);
```

Some errors here are not exported by name, `BatchSizeOutOfRangeError` among them. Catch them with `instanceof KokioError` and read `.code`.

## batchPopulateHistory {#batchpopulatehistory}

Records purchase history for a batch of devices that have no wallet yet. Call it first, before deploying anything.

Nothing here saw any of these purchases move money, so every entry's `settlement` has to be `1` for an external wallet or `2` for fiat. The contract reverts with `SettlementNotAsserted` on `0`.

```ts
const hash = await admin.lazyWalletRegistry.batchPopulateHistory(
  deviceUniqueIdentifiers,        // string[]
  eSIMUniqueIdentifiersPerDevice, // string[][], one array of eSIM ids per device
  purchasesPerDevice,             // DataBundleDetails[][], one array of purchases per device
);
```

Returns `Promise<Hash>`.

## deployLazyWalletAndSetESIMIdentifier {#deploylazywalletandsetesimidentifier}

Deploys a device wallet and every one of its eSIM wallets, sending as many transactions as it takes and waiting for the whole device to finish. This is the normal way to deploy a lazily provisioned device.

Safe to call again with the same arguments, and a `depositAmount` of `0n`, if a previous call stopped partway through, for example because a transaction was dropped. It picks up where it left off instead of starting over.

```ts
const deployment = await admin.lazyWalletRegistry.deployLazyWalletAndSetESIMIdentifier(
  ownerKey,
  deviceUniqueIdentifier,
  salt,
  depositAmount,
  10n, // optional, how many eSIM wallets to deploy per transaction
);
```

Returns `Promise<LazyDeployment>`, shaped `{ deviceWallet, eSIMWallets, eSIMIdentifiers, batches, alreadyComplete }`.

## setHistoryForLazyWallet {#sethistoryforlazywallet}

Copies one eSIM's whole recorded purchase history onto its deployed wallet, sending as many transactions as it takes. Call it once the eSIM's wallet has been deployed by `deployLazyWalletAndSetESIMIdentifier`.

Retryable the same way as the deploy call, and safe to run while the device's other eSIM wallets are still deploying, because the history cursor is tracked per eSIM rather than per device.

```ts
const copy = await admin.lazyWalletRegistry.setHistoryForLazyWallet(
  eSIMIdentifier,
  25n, // optional, how many entries to copy per transaction
);
```

Returns `Promise<LazyHistoryCopy>`, shaped `{ eSIMWallet, copied, batches, alreadyComplete }`.

## switchESIMIdentifierToNewDeviceIdentifier {#switchesimidentifiertonewdeviceidentifier}

Moves an eSIM identifier's history record from one device identifier to another. Use it if a user's eSIM needs to be reassigned to a different device before deployment.

```ts
const hash = await admin.lazyWalletRegistry.switchESIMIdentifierToNewDeviceIdentifier(
  eSIMIdentifier, oldDeviceIdentifier, newDeviceIdentifier,
);
```

Returns `Promise<Hash>`.

## deployLazyWalletFirstBatch {#deploylazywalletfirstbatch}

Sends exactly one deploy transaction, mirroring the contract call directly instead of running the device to completion. Use `deployLazyWalletAndSetESIMIdentifier` for normal work and reach for this only when driving the batching yourself.

```ts
const hash = await admin.lazyWalletRegistry.deployLazyWalletFirstBatch(
  ownerKey, deviceUniqueIdentifier, salt, depositAmount, 10n,
);
```

Returns `Promise<Hash>`.

## deployMoreESIMWalletsForLazyDevice {#deploymoreesimwalletsforlazydevice}

Sends one more deploy transaction for a device the first batch already started. Same single-transaction use as `deployLazyWalletFirstBatch`.

```ts
const hash = await admin.lazyWalletRegistry.deployMoreESIMWalletsForLazyDevice(deviceUniqueIdentifier, 10n);
```

Returns `Promise<Hash>`.

## setHistoryForLazyWalletBatch {#sethistoryforlazywalletbatch}

Sends exactly one history copy transaction. Same single-transaction use as the deploy calls above.

```ts
const hash = await admin.lazyWalletRegistry.setHistoryForLazyWalletBatch(eSIMIdentifier, 25n);
```

Returns `Promise<Hash>`.

## upgradeManager {#upgrademanager}

Reads the upgrade manager, which is the owner, recorded here.

```ts
const manager = await admin.lazyWalletRegistry.upgradeManager();
```

Returns `Promise<Address>`.

## eSIMIdentifierToDeviceIdentifier {#esimidentifiertodeviceidentifier}

Reads which device identifier an eSIM identifier is currently associated with.

```ts
const deviceId = await admin.lazyWalletRegistry.eSIMIdentifierToDeviceIdentifier(eSIMIdentifier);
```

Returns `Promise<string>`.

## MAX_ESIM_WALLETS_PER_CALL {#max-esim-wallets-per-call}

Reads the contract's cap on how many eSIM wallets one deploy transaction may create.

```ts
const max = await admin.lazyWalletRegistry.MAX_ESIM_WALLETS_PER_CALL();
```

Returns `Promise<bigint>`.

## MAX_HISTORY_ENTRIES_PER_CALL {#max-history-entries-per-call}

Reads the contract's cap on how many history entries one transaction may copy.

```ts
const max = await admin.lazyWalletRegistry.MAX_HISTORY_ENTRIES_PER_CALL();
```

Returns `Promise<bigint>`.

## eSIMWalletsDeployed {#esimwalletsdeployed}

Reads how many of a device's eSIM wallets are already deployed. Non-zero exactly when the device's first deploy batch has run, so it also tells you whether deployment has started at all.

```ts
const deployed = await admin.lazyWalletRegistry.eSIMWalletsDeployed(deviceIdentifier);
```

Returns `Promise<bigint>`.

## lazyDeploymentSalt {#lazydeploymentsalt}

Reads the salt the device's first deploy batch used. Every later batch for the same device derives its addresses from this salt.

```ts
const salt = await admin.lazyWalletRegistry.lazyDeploymentSalt(deviceIdentifier);
```

Returns `Promise<bigint>`.

## lazyDeployedESIMWallet {#lazydeployedesimwallet}

Reads the eSIM wallet this registry deployed for an identifier. Zero for any identifier this registry did not deploy, which is what the contract checks before allowing a history copy.

```ts
const wallet = await admin.lazyWalletRegistry.lazyDeployedESIMWallet(eSIMIdentifier);
```

Returns `Promise<Address>`.

## historyEntriesCopied {#historyentriescopied}

Reads how many of an eSIM's stored purchase entries have already reached its deployed wallet.

```ts
const copied = await admin.lazyWalletRegistry.historyEntriesCopied(eSIMIdentifier);
```

Returns `Promise<bigint>`.

## outstandingHistoryEntries {#outstandinghistoryentries}

Reads how many of an eSIM's stored purchase entries are still waiting to be copied in. `buyDataBundleWithToken` and `recordSettledPurchase` both refuse a new entry while this is non-zero, because it would land ahead of history that has not arrived yet.

```ts
const outstanding = await admin.lazyWalletRegistry.outstandingHistoryEntries(eSIMIdentifier);
```

Returns `Promise<bigint>`.

## isDeviceIdentifierReserved {#isdeviceidentifierreserved}

Checks whether a device identifier has purchase history recorded against it here. This reads `true` as soon as `batchPopulateHistory` runs for it, well before any wallet is deployed, unlike [`registry.isDeviceIdentifierAlreadyUsed`](./registry.md#isdeviceidentifieralreadyused) which only tracks real deployments.

```ts
const reserved = await admin.lazyWalletRegistry.isDeviceIdentifierReserved(deviceIdentifier);
```

Returns `Promise<boolean>`.

## isESIMIdentifierReserved {#isesimidentifierreserved}

Checks whether an eSIM identifier is bound to a device here.

```ts
const reserved = await admin.lazyWalletRegistry.isESIMIdentifierReserved(eSIMIdentifier);
```

Returns `Promise<boolean>`.

## deviceIdentifierToESIMDetails {#deviceidentifiertoesimdetails}

Reads one recorded purchase for a device and eSIM pair, by its position in the list. There is no length getter, so read upward from `0n` until a call reverts.

```ts
const purchase = await admin.lazyWalletRegistry.deviceIdentifierToESIMDetails(deviceIdentifier, eSIMIdentifier, 0n);
```

Returns `Promise<DataBundleDetails>`, shaped `{ id, priceUSDCents, settlement }`.

## eSIMIdentifiersAssociatedWithDeviceIdentifier {#esimidentifiersassociatedwithdeviceidentifier}

Reads one eSIM identifier associated with a device, by its position in the list. Same missing length getter as `deviceIdentifierToESIMDetails`.

```ts
const eSIMId = await admin.lazyWalletRegistry.eSIMIdentifiersAssociatedWithDeviceIdentifier(deviceIdentifier, 0n);
```

Returns `Promise<string>`.

## owner {#owner}

Reads who holds `onlyOwner` here. On the live deployment this is the [ProtocolAdmin](./protocol-admin.md) timelock.

```ts
const owner = await admin.lazyWalletRegistry.owner();
```

Returns `Promise<Address>`.

## pendingOwner {#pendingowner}

Reads the address a `transferOwnership` call is waiting on.

```ts
const pending = await admin.lazyWalletRegistry.pendingOwner();
```

Returns `Promise<Address>`.

## proxiableUUID {#proxiableuuid}

Reads the UUPS implementation slot.

```ts
const slot = await admin.lazyWalletRegistry.proxiableUUID();
```

Returns `Promise<Hex>`.

## upgradeInterfaceVersion {#upgradeinterfaceversion}

Reads the UUPS interface version string the current implementation reports.

```ts
const version = await admin.lazyWalletRegistry.upgradeInterfaceVersion();
```

Returns `Promise<string>`.

## acceptOwnership {#acceptownership}

Accepts a pending ownership transfer. Call this from the account named as `pendingOwner`.

```ts
const hash = await admin.lazyWalletRegistry.acceptOwnership();
```

Returns `Promise<Hash>`.

## transferOwnershipCall {#transferownershipcall}

Builds the call payload to hand ownership of this contract to a new address. On the live deployment the owner is the ProtocolAdmin timelock, so hand the result to `protocolAdmin.proposer.schedule` rather than sending it directly.

```ts
const call = await admin.lazyWalletRegistry.transferOwnershipCall(newOwner);
const scheduled = await admin.protocolAdmin.proposer.schedule(call);
```

Returns `Promise<OwnerCall>`.

## upgradeCall {#upgradecall}

Builds the call payload to point this contract's proxy at a new implementation. Hand the result to `protocolAdmin.proposer.schedule`.

This contract holds every fiat user's unclaimed purchase history and it has no other copy. Check the new implementation's storage layout carefully before scheduling. There is no undo.

```ts
const call = await admin.lazyWalletRegistry.upgradeCall(newImplementation);
const scheduled = await admin.protocolAdmin.proposer.schedule(call);
```

Returns `Promise<OwnerCall>`.
