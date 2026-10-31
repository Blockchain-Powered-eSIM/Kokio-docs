---
title: Device wallet factory (backend)
description: admin.deviceWalletFactory deploys Kokio device wallets one at a time or in a batch, registers wallets the app deployed, and builds the owner calls that go through the timelock.
---

# Device wallet factory (backend) {#device-wallet-factory-backend}

Reference for `admin.deviceWalletFactory`: deploy and register device wallets, and manage the factory, from the admin key.

---

`admin.deviceWalletFactory`

The EOA-signed side of Kokio device wallet deployment: creating wallets, batching them for users who never held a key themselves, and the admin-only settings on the factory. Available as soon as [`KokioAdmin`](./setup.md) exists. The contract is documented at [device wallet factory](../../contracts/device-wallet-factory.md).

```ts
const hash = await admin.deviceWalletFactory.createAccount(deviceUniqueIdentifier, ownerKey, salt, depositAmount);
```

:::warning
Call [`preCreateAccountValidation`](#precreateaccountvalidation) before any deploy. A taken identifier does not fail cleanly, it deploys a second orphaned wallet.
:::

## createAccount {#createaccount}

Deploys a single device wallet, paid and signed by the admin EOA. This is the normal one-user onboarding flow.

```ts
const hash = await admin.deviceWalletFactory.createAccount(deviceUniqueIdentifier, ownerKey, salt, depositAmount);
```

| Name | Type | Description |
| :--- | :--- | :--- |
| deviceUniqueIdentifier | `string` | The id for this device |
| ownerKey | `P256Key` | The passkey's P-256 public key, as `[x, y]` hex |
| salt | `bigint` | Makes the address unique per user |
| depositAmount | `bigint` | ETH forwarded to the new device wallet's balance, in wei |

Returns `Promise<Hash>`.

## deployDeviceWalletForUsers {#deploydevicewalletforusers}

Deploys many device wallets in one transaction. Use it for batch onboarding, for example the fiat path users who bought an eSIM before they had a device wallet. See [lazy wallet registry](./lazy-wallet-registry.md) for the rest of that flow.

```ts
const hash = await admin.deviceWalletFactory.deployDeviceWalletForUsers(
  deviceUniqueIdentifiers,
  ownerKeys,
  salts,
  depositAmounts,
  totalValue,
);
```

| Name | Type | Description |
| :--- | :--- | :--- |
| deviceUniqueIdentifiers | `string[]` | One id per wallet |
| ownerKeys | `P256Key[]` | One owner key per wallet |
| salts | `bigint[]` | One salt per wallet |
| depositAmounts | `bigint[]` | ETH forwarded to each new device wallet's balance, in wei |
| value | `bigint` | The total ETH sent for the whole batch, the sum of `depositAmounts` or more. Any leftover is refunded onchain |

Returns `Promise<Hash>`.

## postCreateAccount {#postcreateaccount}

Registers a device wallet with the factory after it deploys. Use it after the app deploys the wallet itself, either with its first sponsored user operation or with [`createAccountWithEOA`](../mobile/device-wallet-factory.md#createaccountwitheoa). A wallet the app deployed is not registered until this runs, and until then it cannot deploy eSIM wallets.

```ts
const hash = await admin.deviceWalletFactory.postCreateAccount(deviceWalletAddress, deviceUniqueIdentifier, ownerKey, salt);
```

| Name | Type | Description |
| :--- | :--- | :--- |
| deviceWallet | `Address` | The wallet the app deployed |
| deviceUniqueIdentifier | `string` | The id the deploy used |
| ownerKey | `P256Key` | The owner key the deploy used |
| salt | `bigint` | The salt the deploy used. The factory recomputes the wallet's address from it to check the wallet is real |

:::warning
On a hosted RPC, wait a few confirmations before telling the app to go ahead. A bundler that simulates the app's next operation against a node one block behind still sees the wallet as unregistered and rejects it.
:::

Returns `Promise<Hash>`.

## addRegistryAddress {#addregistryaddress}

Owner only. One-time setup call that wires the registry address into the factory. Run once, as part of initial deployment.

```ts
const hash = await admin.deviceWalletFactory.addRegistryAddress(registryAddress);
```

Returns `Promise<Hash>`.

## updateDeviceWalletImplementation {#updatedevicewalletimplementation}

Owner only. Points the device wallet beacon at a new implementation contract. On the live deployment the owner is the [ProtocolAdmin](./protocol-admin.md) timelock, so a direct call from the admin key reverts.

:::warning
This moves every deployed device wallet to the new code at once, because they all read their implementation from the same beacon.
:::

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

| Name | Type | Description |
| :--- | :--- | :--- |
| ownerKey | `P256Key` | The owner key |
| deviceUniqueIdentifier | `string` | The device id |
| salt | `bigint` | The salt |

:::warning
The owner key comes first here, unlike `createAccount` and the mobile [`getAddress`](../mobile/device-wallet-factory.md#getaddress).
:::

Returns `Promise<Address>`.

## preCreateAccountValidation {#precreateaccountvalidation}

Checks whether a device identifier or owner key is already taken, before deploying.

```ts
const holder = await admin.deviceWalletFactory.preCreateAccountValidation(deviceUniqueIdentifier, ownerKey);
```

| Name | Type | Description |
| :--- | :--- | :--- |
| deviceUniqueIdentifier | `string` | The device id to check |
| ownerKey | `P256Key` | The owner key to check |

Returns `Promise<Address>`, the zero address when both are free.

## beacon {#beacon}

Reads the beacon every device wallet reads its implementation from. The beacon address is on the [Base mainnet](../../deployments/base.md#contracts) and [Base Sepolia](../../deployments/base-sepolia.md#contracts) pages.

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

:::tip
If the incoming owner is the ProtocolAdmin timelock, use [`protocolAdmin.acceptOwnershipBatch`](./protocol-admin.md) instead, which accepts for every contract at once rather than one at a time.
:::

```ts
const hash = await admin.deviceWalletFactory.acceptOwnership();
```

Returns `Promise<Hash>`.

## transferOwnershipCall {#transferownershipcall}

Builds the call payload to hand ownership of the factory to a new address. This does not send anything itself. On the live deployment the factory's owner is the ProtocolAdmin timelock, so hand the result to `protocolAdmin.proposer.schedule` instead of sending it directly.

:::warning
Handing over ownership also hands over the device wallet beacon, because the factory owns it, so the new owner can move every deployed device wallet at once.
:::

```ts
const call = await admin.deviceWalletFactory.transferOwnershipCall(newOwner);
const scheduled = await admin.protocolAdmin.proposer.schedule(call);
```

Returns `Promise<OwnerCall>`.

## upgradeCall {#upgradecall}

Builds the call payload to point the factory's own proxy at a new implementation. Same pattern as `transferOwnershipCall`: hand the result to `protocolAdmin.proposer.schedule` rather than sending it directly.

:::note
This does not touch already deployed device wallets. Those move through `updateDeviceWalletImplementation` and the beacon instead.
:::

```ts
const call = await admin.deviceWalletFactory.upgradeCall(newImplementation);
const scheduled = await admin.protocolAdmin.proposer.schedule(call);
```

| Name | Type | Description |
| :--- | :--- | :--- |
| newImplementation | `Address` | The new implementation contract |
| data | `Hex`, optional | Calldata to run on the new implementation as part of the upgrade |

Returns `Promise<OwnerCall>`.
