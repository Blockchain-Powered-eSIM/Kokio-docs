---
title: Registry (backend)
description: admin.registry is the admin-only side of the Kokio registry, covering the pause switch, price caps, admin handover, recording purchases paid outside the protocol, and every read.
---

# Registry (backend) {#registry-backend}

`admin.registry`

The admin-only side of the Kokio protocol-wide directory: pausing, price caps, admin handover, recording purchases paid for outside the protocol, and wiring the other contracts together. Available as soon as [`KokioAdmin`](./setup.md) exists. The contract is documented at [registry](../../contracts/registry.md).

```ts
const hash = await admin.registry.pause();
```

Two roles sit on this contract and they are not the same. The **admin** is the backend key, and it can pause, record purchases and assign identifiers. The **owner** is the [ProtocolAdmin](./protocol-admin.md) timelock, and it can unpause, upgrade and hand over ownership. Anything named `*Call` below builds a payload for the owner and sends nothing itself.

The read-only half of this contract, reachable from a phone, is on [`kokio.registry`](../mobile/registry.md).

## addOrUpdateLazyWalletRegistryAddress {#addorupdatelazywalletregistryaddress}

Wires the lazy wallet registry address into the registry. Run once during setup, or again if the [lazy wallet registry](./lazy-wallet-registry.md) is redeployed.

```ts
const hash = await admin.registry.addOrUpdateLazyWalletRegistryAddress(lazyWalletRegistryAddress);
```

Returns `Promise<Hash>`.

## updateVaultAddress {#updatevaultaddress}

Changes the vault address that receives eSIM payments.

```ts
const hash = await admin.registry.updateVaultAddress(newVaultAddress);
```

Returns `Promise<Hash>`.

## requestAdminUpdate {#requestadminupdate}

Starts the two-step handover of the admin role to a new address. Use it to rotate the backend's signing key.

This takes the role off the current admin right away: every admin-gated call reverts until the new address accepts with `acceptAdminUpdate`. Send the two steps close together, or user-facing calls that need the admin will fail in between. Naming the current admin instead cancels a pending nomination.

```ts
const hash = await admin.registry.requestAdminUpdate(newAdminAddress);
```

Returns `Promise<Hash>`.

## acceptAdminUpdate {#acceptadminupdate}

Finishes the admin handover. Call this from the newly nominated admin address, not the outgoing one.

```ts
const hash = await admin.registry.acceptAdminUpdate();
```

Returns `Promise<Hash>`.

## disableAdmin {#disableadmin}

Suspends the admin's powers across the whole protocol. Use it if the backend's admin key is compromised, as a way to freeze admin actions without losing the address itself.

The address stays on record, so turning the admin back on does not need it supplied again. Reverts if the admin is already suspended.

```ts
const hash = await admin.registry.disableAdmin();
```

Returns `Promise<Hash>`.

## enableAdmin {#enableadmin}

Lifts a suspension started by `disableAdmin`.

```ts
const hash = await admin.registry.enableAdmin();
```

Returns `Promise<Hash>`.

## assignESIMIdentifier {#assignesimidentifier}

Binds an eSIM's unique identifier to its wallet. Use it once an eSIM wallet is deployed and its real-world identifier is known.

The identifier can only be claimed once across the whole protocol, so assigning an identifier already bound to another wallet reverts.

```ts
const hash = await admin.registry.assignESIMIdentifier(eSIMWalletAddress, eSIMUniqueIdentifier);
```

Returns `Promise<Hash>`.

## recordSettledPurchase {#recordsettledpurchase}

Records a data bundle paid for outside the protocol, by card or an external wallet. Use it once the backend has confirmed a payment through whatever rail took it.

No money moves through this call, so `settlement` on the bundle details has to be `1` for an external wallet or `2` for fiat, never `0`. The contract reverts with `SettlementNotAsserted` on `0`, because nothing here proves the device wallet actually paid. `tokenAmount` is recorded for offchain matching and never checked against `priceUSDCents`. `paymentReference` is spendable once per eSIM wallet.

This is the call that writes into a user's history on the backend's word alone. Confirm the payment first.

```ts
const hash = await admin.registry.recordSettledPurchase(
  eSIMWalletAddress,
  { id: bundleId, priceUSDCents: 500n, settlement: 2 }, // 2 = Fiat
  asset,
  tokenAmount,
  paymentReference,
);
```

Returns `Promise<Hash>`.

## pause {#pause}

Stops the purchase and token pull paths on every device wallet and eSIM wallet, protocol-wide. This is the one emergency lever the admin key can pull on its own: it can pause, but only the owner can unpause. Use it if something looks wrong and needs an immediate stop.

```ts
const hash = await admin.registry.pause();
```

Returns `Promise<Hash>`.

## unpause {#unpause}

Releases a pause. On the live deployment this needs the owner, so calling it from the admin EOA directly reverts. Schedule `admin.protocolAdmin.unpauseCall()` through `admin.protocolAdmin.proposer.schedule` instead, or have a guardian call [`admin.protocolAdmin.guardian.unpauseInstantly`](./protocol-admin.md) if a two day wait is not acceptable.

```ts
const hash = await admin.registry.unpause();
```

Returns `Promise<Hash>`.

## setDefaultPriceCapUSDCents {#setdefaultpricecapusdcents}

Sets the fallback price ceiling, in US cents, every eSIM wallet uses when it has no cap of its own.

Zero reverts. A zero cap would read as "no limit" for every wallet without one of its own, so the contract refuses it outright.

```ts
const hash = await admin.registry.setDefaultPriceCapUSDCents(cap);
```

Returns `Promise<Hash>`.

## acceptOwnership {#acceptownership}

Accepts a pending ownership transfer. Call this from the account named as `pendingOwner`.

```ts
const hash = await admin.registry.acceptOwnership();
```

Returns `Promise<Hash>`.

## transferOwnershipCall {#transferownershipcall}

Builds the call payload to hand ownership of the registry to a new address. On the live deployment the owner is the ProtocolAdmin timelock, so hand the result to `protocolAdmin.proposer.schedule` rather than sending it directly.

```ts
const call = await admin.registry.transferOwnershipCall(newOwner);
const scheduled = await admin.protocolAdmin.proposer.schedule(call);
```

Returns `Promise<OwnerCall>`.

## upgradeCall {#upgradecall}

Builds the call payload to point the registry's proxy at a new implementation. Hand the result to `protocolAdmin.proposer.schedule`.

There is no undo. Check the new implementation's storage layout matches before scheduling: the contract checks only that the new address answers as a compatible UUPS implementation, not that its storage lines up.

```ts
const call = await admin.registry.upgradeCall(newImplementation);
const scheduled = await admin.protocolAdmin.proposer.schedule(call);
```

Returns `Promise<OwnerCall>`.

## owner {#owner}

Reads who holds `onlyOwner` on the registry. On the live deployment this is the ProtocolAdmin timelock.

```ts
const owner = await admin.registry.owner();
```

Returns `Promise<Address>`.

## eSIMWalletAdmin {#esimwalletadmin}

Reads the admin address that may currently act. Reads zero while a nomination is pending or the admin is suspended, so a zero here means the role is dormant rather than unset.

```ts
const current = await admin.registry.eSIMWalletAdmin();
```

Returns `Promise<Address>`.

## adminOfRecord {#adminofrecord}

Reads the admin address on file, whether or not it is currently active. Keeps naming a suspended admin, so lifting the suspension does not need the address supplied again. Use `eSIMWalletAdmin` to ask who may actually act right now.

```ts
const onFile = await admin.registry.adminOfRecord();
```

Returns `Promise<Address>`.

## adminDisabled {#admindisabled}

Checks whether the admin's powers are currently suspended.

```ts
const disabled = await admin.registry.adminDisabled();
```

Returns `Promise<boolean>`.

## newRequestedAdmin {#newrequestedadmin}

Reads the address nominated by `requestAdminUpdate`, if any.

```ts
const pending = await admin.registry.newRequestedAdmin();
```

Returns `Promise<Address>`, zero if none.

## vault {#vault}

Reads the vault address that receives eSIM payments.

```ts
const vault = await admin.registry.vault();
```

Returns `Promise<Address>`.

## upgradeManager {#upgrademanager}

Reads the upgrade manager, which is the owner, recorded in the registry.

```ts
const manager = await admin.registry.upgradeManager();
```

Returns `Promise<Address>`.

## lazyWalletRegistry {#lazywalletregistry}

Reads the lazy wallet registry address wired into the registry.

```ts
const lazyRegistry = await admin.registry.lazyWalletRegistry();
```

Returns `Promise<Address>`.

## uniqueIdentifierToDeviceWallet {#uniqueidentifiertodevicewallet}

Reads the device wallet registered for a device identifier.

```ts
const wallet = await admin.registry.uniqueIdentifierToDeviceWallet(deviceUniqueIdentifier);
```

Returns `Promise<Address>`, zero if none.

## deviceWalletToOwner {#devicewallettoowner}

Reads one of a device wallet's two P256 owner key coordinates, by index: `0` for x, `1` for y.

```ts
const x = await admin.registry.deviceWalletToOwner(deviceWalletAddress, 0n);
const y = await admin.registry.deviceWalletToOwner(deviceWalletAddress, 1n);
```

Returns `Promise<Hex>`.

## registeredP256Keys {#registeredp256keys}

Reads the device wallet registered against a hash of an owner's P256 keys. Use it to check whether a passkey is already tied to a wallet.

```ts
const wallet = await admin.registry.registeredP256Keys(hashOfOwnerKeys);
```

Returns `Promise<Address>`, zero if none.

## isDeviceWalletValid {#isdevicewalletvalid}

Checks whether a device wallet is registered with the protocol.

```ts
const valid = await admin.registry.isDeviceWalletValid(deviceWalletAddress);
```

Returns `Promise<boolean>`.

## isESIMWalletValid {#isesimwalletvalid}

Reads the device wallet an eSIM wallet is registered against. Despite the name this returns an address, not a boolean. It is a registration record rather than a current holder, and it never goes back to zero once set, even after a transfer. Ask [`deviceWallet.isValidESIMWallet`](./device-wallet.md#isvalidesimwallet) who holds it right now.

```ts
const holder = await admin.registry.isESIMWalletValid(eSIMWalletAddress);
```

Returns `Promise<Address>`, zero if the protocol never registered it.

## isESIMWalletOnStandby {#isesimwalletonstandby}

Checks whether a transfer is outstanding on an eSIM wallet.

```ts
const onStandby = await admin.registry.isESIMWalletOnStandby(eSIMWalletAddress);
```

Returns `Promise<boolean>`.

## paused {#paused}

Checks whether the whole protocol is paused.

```ts
const paused = await admin.registry.paused();
```

Returns `Promise<boolean>`.

## defaultPriceCapUSDCents {#defaultpricecapusdcents}

Reads the fallback price ceiling, in US cents, for a wallet with no cap of its own.

```ts
const cap = await admin.registry.defaultPriceCapUSDCents();
```

Returns `Promise<bigint>`.

## paymentAdapter {#paymentadapter}

Reads the payment adapter this registry currently points at.

```ts
const adapter = await admin.registry.paymentAdapter();
```

Returns `Promise<Address>`.

## usedPaymentReferences {#usedpaymentreferences}

Checks whether a payment reference has already been spent for an eSIM wallet. Scoped per wallet, so pass `keccak256(abi.encode(eSIMWalletAddress, paymentReference))`, not the bare reference.

```ts
const used = await admin.registry.usedPaymentReferences(scopedReference);
```

Returns `Promise<boolean>`.

## isDeviceIdentifierAlreadyUsed {#isdeviceidentifieralreadyused}

Checks whether a device identifier already has a wallet deployed onchain.

```ts
const used = await admin.registry.isDeviceIdentifierAlreadyUsed(deviceUniqueIdentifier);
```

Returns `Promise<boolean>`.

## isESIMIdentifierClaimed {#isesimidentifierclaimed}

Checks whether an eSIM identifier is already held by a wallet.

```ts
const claimed = await admin.registry.isESIMIdentifierClaimed(eSIMUniqueIdentifier);
```

Returns `Promise<boolean>`.

## eSIMWalletForIdentifier {#esimwalletforidentifier}

Reads the eSIM wallet holding an eSIM identifier, by the identifier string.

```ts
const wallet = await admin.registry.eSIMWalletForIdentifier(eSIMUniqueIdentifier);
```

Returns `Promise<Address>`, zero if nobody holds it.

## claimedESIMIdentifiers {#claimedesimidentifiers}

The same answer as `eSIMWalletForIdentifier`, keyed by the identifier's keccak256 hash instead of the raw string. Use it when the hash is already what you have.

```ts
const wallet = await admin.registry.claimedESIMIdentifiers(hashOfESIMIdentifier);
```

Returns `Promise<Address>`, zero if nobody holds it.

## requireDeviceIdentifierNotReserved {#requiredeviceidentifiernotreserved}

Throws if a fiat path user's eSIMs are already waiting on this device identifier. Worth checking before deploying.

```ts
await admin.registry.requireDeviceIdentifierNotReserved(deviceUniqueIdentifier);
```

Returns `Promise<void>`.

## requireNotPaused {#requirenotpaused}

The same pause check as `paused`, but throws instead of returning `false`.

```ts
await admin.registry.requireNotPaused();
```

Returns `Promise<void>`.

## pendingOwner {#pendingowner}

Reads the address a `transferOwnership` call is waiting on. Worth reading before `protocolAdmin.acceptOwnershipBatch`, which reverts on any target that has not actually been offered to the timelock.

```ts
const pending = await admin.registry.pendingOwner();
```

Returns `Promise<Address>`.

## deviceWalletFactory {#devicewalletfactory}

Reads the device wallet factory address wired into the registry.

```ts
const factory = await admin.registry.deviceWalletFactory();
```

Returns `Promise<Address>`.

## eSIMWalletFactory {#esimwalletfactory}

Reads the eSIM wallet factory address wired into the registry.

```ts
const factory = await admin.registry.eSIMWalletFactory();
```

Returns `Promise<Address>`.

## entryPoint {#entrypoint}

Reads the ERC-4337 EntryPoint address the registry recognizes.

```ts
const entryPoint = await admin.registry.entryPoint();
```

Returns `Promise<Address>`.

## proxiableUUID {#proxiableuuid}

Reads the UUPS implementation slot.

```ts
const slot = await admin.registry.proxiableUUID();
```

Returns `Promise<Hex>`.

## upgradeInterfaceVersion {#upgradeinterfaceversion}

Reads the UUPS interface version string the current implementation reports.

```ts
const version = await admin.registry.upgradeInterfaceVersion();
```

Returns `Promise<string>`.
