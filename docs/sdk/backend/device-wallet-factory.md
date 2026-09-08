---
title: Device wallet factory (backend)
description: admin.deviceWalletFactory deploys Kokio device wallets one at a time or in a batch, registers wallets the app deployed, and builds the owner calls that go through the timelock.
---

# Device wallet factory (backend) {#device-wallet-factory-backend}

`admin.deviceWalletFactory`

The EOA-signed side of Kokio device wallet deployment: creating wallets, batching them for users who never held a key themselves, and the admin-only settings on the factory. Available as soon as [`KokioAdmin`](./setup.md) exists. The contract is documented at [device wallet factory](../../contracts/device-wallet-factory.md).

```ts
const hash = await admin.deviceWalletFactory.createAccount(
  deviceUniqueIdentifier, ownerKey, salt, depositAmount,
);
```

Call `preCreateAccountValidation` before any deploy. A taken identifier does not fail cleanly, it deploys a second orphaned wallet.

## createAccount {#createaccount}

Deploys a single device wallet, paid and signed by the admin EOA. This is the normal one-user onboarding flow.

```ts
const hash = await admin.deviceWalletFactory.createAccount(
  deviceUniqueIdentifier,
  ownerKey,
  salt,
  depositAmount, // ETH sent as the wallet's starting gas deposit
);
```

Returns `Promise<Hash>`.

## deployDeviceWalletForUsers {#deploydevicewalletforusers}

Deploys many device wallets in one transaction. Use it for batch onboarding, for example the fiat path users who bought an eSIM before they had a device wallet. See [lazy wallet registry](./lazy-wallet-registry.md) for the rest of that flow.

`value` is the total ETH sent for the whole batch, split across `depositAmounts`. Any leftover is refunded onchain.

```ts
const hash = await admin.deviceWalletFactory.deployDeviceWalletForUsers(
  deviceUniqueIdentifiers, // string[]
  ownerKeys,               // P256Key[]
  salts,                   // bigint[]
  depositAmounts,          // bigint[]
  totalValue,              // bigint, sum of depositAmounts or more
);
```

Returns `Promise<Hash>`.

## postCreateAccount {#postcreateaccount}

Registers a device wallet with the factory after it deploys. Use it right after [`createAccountWithEOA`](../mobile/device-wallet-factory.md#createaccountwitheoa) on the mobile surface, because a wallet the app deployed is not registered until this runs.

The salt has to match the one the deploy used. The factory recomputes the wallet's address from it to check the wallet is real.

```ts
const hash = await admin.deviceWalletFactory.postCreateAccount(
  deviceWalletAddress, deviceUniqueIdentifier, ownerKey, salt,
);
```

Returns `Promise<Hash>`.

## addRegistryAddress {#addregistryaddress}

One-time setup call that wires the registry address into the factory. Run once, as part of initial deployment.

```ts
const hash = await admin.deviceWalletFactory.addRegistryAddress(registryAddress);
```

Returns `Promise<Hash>`.

## updateDeviceWalletImplementation {#updatedevicewalletimplementation}

Points the device wallet beacon at a new implementation contract. This moves every deployed device wallet to the new code at once, because they all read their implementation from the same beacon.

```ts
const hash = await admin.deviceWalletFactory.updateDeviceWalletImplementation(newImplementation);
```

Returns `Promise<Hash>`.

## eSIMWalletAdmin {#esimwalletadmin}

Reads the address allowed to deploy eSIM wallets and manage them as admin.

```ts
const eSIMAdmin = await admin.deviceWalletFactory.eSIMWalletAdmin();
```

Returns `Promise<Address>`.

## deviceWalletInfoAdded {#devicewalletinfoadded}

Checks whether the factory has finished registering a device wallet.

```ts
const registered = await admin.deviceWalletFactory.deviceWalletInfoAdded(deviceWalletAddress);
```

Returns `Promise<boolean>`.

## getCurrentDeviceWalletImplementation {#getcurrentdevicewalletimplementation}

Reads the device wallet implementation contract every new wallet points at.

```ts
const impl = await admin.deviceWalletFactory.getCurrentDeviceWalletImplementation();
```

Returns `Promise<Address>`.

## getCounterFactualAddress {#getcounterfactualaddress}

Works out the address a device wallet will deploy to, without sending anything.

```ts
const address = await admin.deviceWalletFactory.getCounterFactualAddress(ownerKey, deviceUniqueIdentifier, salt);
```

Returns `Promise<Address>`.

## preCreateAccountValidation {#precreateaccountvalidation}

Checks whether a device identifier or owner key is already taken, before deploying.

```ts
const holder = await admin.deviceWalletFactory.preCreateAccountValidation(deviceUniqueIdentifier, ownerKey);
```

Returns `Promise<Address>`, the zero address when both are free.

## beacon {#beacon}

Reads the beacon every device wallet reads its implementation from. The live beacon address is on the [deployed addresses](../../contracts/deployments.md) page.

```ts
const beacon = await admin.deviceWalletFactory.beacon();
```

Returns `Promise<Address>`.

## registry {#registry}

Reads the registry address the factory writes newly deployed wallets into.

```ts
const registry = await admin.deviceWalletFactory.registry();
```

Returns `Promise<Address>`.

## entryPoint {#entrypoint}

Reads the ERC-4337 EntryPoint address baked into every wallet this factory deploys.

```ts
const entryPoint = await admin.deviceWalletFactory.entryPoint();
```

Returns `Promise<Address>`.

## verifier {#verifier}

Reads the P256 verifier contract new device wallets use to check WebAuthn signatures.

```ts
const verifier = await admin.deviceWalletFactory.verifier();
```

Returns `Promise<Address>`.

## owner {#owner}

Reads the current owner of the factory contract. On the live deployment this is the [ProtocolAdmin](./protocol-admin.md) timelock, not a plain EOA.

```ts
const owner = await admin.deviceWalletFactory.owner();
```

Returns `Promise<Address>`.

## pendingOwner {#pendingowner}

Reads the address named in a pending `transferOwnership`, if any.

```ts
const pending = await admin.deviceWalletFactory.pendingOwner();
```

Returns `Promise<Address>`.

## proxiableUUID {#proxiableuuid}

Reads the UUPS implementation slot. Rarely needed directly, mostly useful for verifying an upgrade by hand.

```ts
const slot = await admin.deviceWalletFactory.proxiableUUID();
```

Returns `Promise<Hex>`.

## upgradeInterfaceVersion {#upgradeinterfaceversion}

Reads the UUPS interface version string the current implementation reports.

```ts
const version = await admin.deviceWalletFactory.upgradeInterfaceVersion();
```

Returns `Promise<string>`.

## acceptOwnership {#acceptownership}

Accepts a pending ownership transfer. Call this from the account named as `pendingOwner`.

If the incoming owner is the ProtocolAdmin timelock, use [`protocolAdmin.acceptOwnershipBatch`](./protocol-admin.md) instead, which accepts for every contract at once rather than one at a time.

```ts
const hash = await admin.deviceWalletFactory.acceptOwnership();
```

Returns `Promise<Hash>`.

## transferOwnershipCall {#transferownershipcall}

Builds the call payload to hand ownership of the factory to a new address. This does not send anything itself. On the live deployment the factory's owner is the ProtocolAdmin timelock, so hand the result to `protocolAdmin.proposer.schedule` instead of sending it directly.

Handing over ownership also hands over the device wallet beacon, because the factory owns it, so the new owner can move every deployed device wallet at once.

```ts
const call = await admin.deviceWalletFactory.transferOwnershipCall(newOwner);
const scheduled = await admin.protocolAdmin.proposer.schedule(call);
```

Returns `Promise<OwnerCall>`.

## upgradeCall {#upgradecall}

Builds the call payload to point the factory's own proxy at a new implementation. Same pattern as `transferOwnershipCall`: hand the result to `protocolAdmin.proposer.schedule` rather than sending it directly.

This does not touch already deployed device wallets. Those move through `updateDeviceWalletImplementation` and the beacon instead.

```ts
const call = await admin.deviceWalletFactory.upgradeCall(newImplementation);
const scheduled = await admin.protocolAdmin.proposer.schedule(call);
```

Returns `Promise<OwnerCall>`.
