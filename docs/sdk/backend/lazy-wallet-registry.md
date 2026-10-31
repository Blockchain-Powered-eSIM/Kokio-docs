---
title: Lazy wallet registry (backend)
description: admin.lazyWalletRegistry records purchases for Kokio users who bought an eSIM before they had a wallet, then deploys their wallets and copies that history across.
---

# Lazy wallet registry (backend) {#lazy-wallet-registry-backend}

Reference for `admin.lazyWalletRegistry`: record a card buyer's purchases, deploy their wallets later, then copy the history across.

---

`admin.lazyWalletRegistry`

Handles Kokio users who bought an eSIM before they had a device wallet, for example through a fiat checkout instead of the app. Available as soon as [`KokioAdmin`](./setup.md) exists. The contract is documented at [LazyWalletRegistry](../../contracts/lazy-wallet-registry.md).

The order matters:

1. Record the purchase history with [`batchPopulateHistory`](#batchpopulatehistory).
2. Deploy the device wallet and its eSIM wallets with [`deployLazyWalletAndSetESIMIdentifier`](#deploylazywalletandsetesimidentifier).
3. Copy each eSIM's history onto its wallet with [`setHistoryForLazyWallet`](#sethistoryforlazywallet).

:::warning
The deploy step refuses a device that already has a wallet, and expects its history to be on record already.
:::

Deploying a device and copying its history both take more than one onchain transaction once a device has enough eSIMs or purchases. The run-to-completion methods handle that pagination for you and can be retried safely if a call is interrupted partway through. Use those for normal work. The single-transaction versions are only for driving the batching yourself.

```ts title="Record, then deploy"
await admin.lazyWalletRegistry.batchPopulateHistory(deviceIds, eSIMIdsPerDevice, purchasesPerDevice);
const deployment = await admin.lazyWalletRegistry.deployLazyWalletAndSetESIMIdentifier(
  ownerKey, deviceUniqueIdentifier, salt, depositAmount,
);
```

The errors these calls throw are exported by name from both entry points: `BatchSizeOutOfRangeError`, `DepositOnResumeError`, `ESIMWalletNotLazyDeployedError`, `MissingBatchEventError` and `StalledBatchError`. All extend `KokioError`.

## batchPopulateHistory {#batchpopulatehistory}

Records purchase history for a batch of devices that have no wallet yet. Call it first, before deploying anything.

```ts
const hash = await admin.lazyWalletRegistry.batchPopulateHistory(
  deviceUniqueIdentifiers,
  eSIMUniqueIdentifiersPerDevice,
  purchasesPerDevice,
);
```

| Name | Type | Description |
| :--- | :--- | :--- |
| deviceUniqueIdentifiers | `string[]` | One id per device |
| eSIMUniqueIdentifiers | `string[][]` | One array of eSIM ids per device |
| dataBundleDetails | `DataBundleDetails[][]` | One array of purchases per device |

:::warning
Nothing here saw any of these purchases move money, so every entry's `settlement` has to be `1` for an external wallet or `2` for fiat. The contract reverts with `SettlementNotAsserted` on `0`.
:::

Returns `Promise<Hash>`.

## deployLazyWalletAndSetESIMIdentifier {#deploylazywalletandsetesimidentifier}

Deploys a device wallet and every one of its eSIM wallets, sending as many transactions as it takes and waiting for the whole device to finish. This is the normal way to deploy a lazily provisioned device.

```ts
const deployment = await admin.lazyWalletRegistry.deployLazyWalletAndSetESIMIdentifier(
  ownerKey,
  deviceUniqueIdentifier,
  salt,
  depositAmount,
  10n,
);
```

| Name | Type | Description |
| :--- | :--- | :--- |
| deviceOwnerPublicKey | `P256Key` | The passkey's P-256 public key, as `[x, y]` hex |
| deviceUniqueIdentifier | `string` | The device id the history was recorded under |
| salt | `bigint` | Makes the address unique per user |
| depositAmount | `bigint` | ETH forwarded to the new device wallet's balance, in wei. `0n` when resuming |
| maxWallets | `bigint`, optional | How many eSIM wallets to deploy per transaction |

:::tip
Safe to call again with the same arguments, and a `depositAmount` of `0n`, if a previous call stopped partway through, for example because a transaction was dropped. It picks up where it left off instead of starting over.
:::

`eSIMWallets` and `eSIMIdentifiers` always list every eSIM wallet the device has, in deploy order, even when this call resumed a deploy or found it already complete. Walk them to copy each eSIM's history with [`setHistoryForLazyWallet`](#sethistoryforlazywallet). `batches` lists only the transactions this call sent.

Returns `Promise<LazyDeployment>`, shaped `{ deviceWallet, eSIMWallets, eSIMIdentifiers, batches, alreadyComplete }`.

## setHistoryForLazyWallet {#sethistoryforlazywallet}

Copies one eSIM's whole recorded purchase history onto its deployed wallet, sending as many transactions as it takes. Call it once the eSIM's wallet has been deployed by `deployLazyWalletAndSetESIMIdentifier`.

```ts
const copy = await admin.lazyWalletRegistry.setHistoryForLazyWallet(eSIMIdentifier, 25n);
```

| Name | Type | Description |
| :--- | :--- | :--- |
| eSIMIdentifier | `string` | The eSIM whose history to copy |
| maxEntries | `bigint`, optional | How many entries to copy per transaction |

:::tip
Retryable the same way as the deploy call, and safe to run while the device's other eSIM wallets are still deploying, because the history cursor is tracked per eSIM rather than per device.
:::

Returns `Promise<LazyHistoryCopy>`, shaped `{ eSIMWallet, copied, batches, alreadyComplete }`.

## switchESIMIdentifierToNewDeviceIdentifier {#switchesimidentifiertonewdeviceidentifier}

Moves an eSIM identifier's history record from one device identifier to another. Use it if a user's eSIM needs to be reassigned to a different device before deployment.

```ts
const hash = await admin.lazyWalletRegistry.switchESIMIdentifierToNewDeviceIdentifier(
  eSIMIdentifier, oldDeviceIdentifier, newDeviceIdentifier,
);
```

| Name | Type | Description |
| :--- | :--- | :--- |
| eSIMIdentifier | `string` | The eSIM to move |
| oldDeviceIdentifier | `string` | The device it is recorded under now |
| newDeviceIdentifier | `string` | The device to move it to |

Returns `Promise<Hash>`.

## deployLazyWalletFirstBatch {#deploylazywalletfirstbatch}

Sends exactly one deploy transaction, mirroring the contract call directly instead of running the device to completion.

:::note
Use `deployLazyWalletAndSetESIMIdentifier` for normal work. This and the two methods after it are only for driving the batching yourself.
:::

```ts
const hash = await admin.lazyWalletRegistry.deployLazyWalletFirstBatch(
  ownerKey, deviceUniqueIdentifier, salt, depositAmount, 10n,
);
```

Takes the same arguments as [`deployLazyWalletAndSetESIMIdentifier`](#deploylazywalletandsetesimidentifier), except that `maxWallets` is required.

Returns `Promise<Hash>`.

## deployMoreESIMWalletsForLazyDevice {#deploymoreesimwalletsforlazydevice}

Sends one more deploy transaction for a device the first batch already started.

```ts
const hash = await admin.lazyWalletRegistry.deployMoreESIMWalletsForLazyDevice(deviceUniqueIdentifier, 10n);
```

| Name | Type | Description |
| :--- | :--- | :--- |
| deviceUniqueIdentifier | `string` | The device being deployed |
| maxWallets | `bigint` | How many eSIM wallets to deploy in this transaction |

Returns `Promise<Hash>`.

## setHistoryForLazyWalletBatch {#sethistoryforlazywalletbatch}

Sends exactly one history copy transaction.

```ts
const hash = await admin.lazyWalletRegistry.setHistoryForLazyWalletBatch(eSIMIdentifier, 25n);
```

| Name | Type | Description |
| :--- | :--- | :--- |
| eSIMIdentifier | `string` | The eSIM whose history to copy |
| maxEntries | `bigint` | How many entries to copy in this transaction |

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

Reads how many of an eSIM's stored purchase entries are still waiting to be copied in.

:::warning
`buyDataBundleWithToken` and `recordSettledPurchase` both refuse a new entry while this is non-zero, because it would land ahead of history that has not arrived yet.
:::

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

| Name | Type | Description |
| :--- | :--- | :--- |
| deviceIdentifier | `string` | The device |
| eSIMIdentifier | `string` | The eSIM |
| index | `bigint` | The position in the list, from `0n` |

Returns `Promise<DataBundleDetails>`, shaped `{ id, priceUSDCents, settlement }`.

## eSIMIdentifiersAssociatedWithDeviceIdentifier {#esimidentifiersassociatedwithdeviceidentifier}

Reads one eSIM identifier associated with a device, by its position in the list. Same missing length getter as `deviceIdentifierToESIMDetails`.

```ts
const eSIMId = await admin.lazyWalletRegistry.eSIMIdentifiersAssociatedWithDeviceIdentifier(deviceIdentifier, 0n);
```

| Name | Type | Description |
| :--- | :--- | :--- |
| deviceIdentifier | `string` | The device |
| index | `bigint` | The position in the list, from `0n` |

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

:::warning
This contract holds every fiat user's unclaimed purchase history and it has no other copy. Check the new implementation's storage layout carefully before scheduling. There is no undo.
:::

```ts
const call = await admin.lazyWalletRegistry.upgradeCall(newImplementation);
const scheduled = await admin.protocolAdmin.proposer.schedule(call);
```

| Name | Type | Description |
| :--- | :--- | :--- |
| newImplementation | `Address` | The new implementation contract |
| data | `Hex`, optional | Calldata to run on the new implementation as part of the upgrade |

Returns `Promise<OwnerCall>`.
