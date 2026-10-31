---
title: Device wallet factory (mobile)
description: kokio.deviceWalletFactory predicts the address a Kokio device wallet will deploy to, checks whether an identifier or passkey is already taken, and reads the beacon every wallet follows.
---

# Device wallet factory (mobile) {#device-wallet-factory-mobile}

Reference for `kokio.deviceWalletFactory`: predict a device wallet's address and check inputs before deploying.

---

`kokio.deviceWalletFactory`

Read-only lookups against the factory that deploys Kokio device wallets, plus one EOA-signed deploy method. The contract behind this surface is documented at [device wallet factory](../../contracts/device-wallet-factory.md).

Present as soon as [`Kokio`](./setup.md) has a `smartAccountClient`. No device wallet address is needed, because this surface is chain-wide rather than tied to one wallet.

```ts
const address = await kokio.deviceWalletFactory!.getAddress(deviceUniqueIdentifier, ownerKey, salt);
```

## createAccountWithEOA {#createaccountwitheoa}

Deploys a device wallet directly from an EOA, instead of through the smart account flow. Most apps deploy through the backend's [`admin.deviceWalletFactory.createAccount`](../backend/device-wallet-factory.md) instead. Use this method only if the app itself holds a funded EOA.

:::warning
This needs the `walletClient` passed to `Kokio` to carry a signing account, which the [mobile setup](./setup.md) quick start does not do.
:::

```ts
const hash = await kokio.deviceWalletFactory!.createAccountWithEOA(deviceUniqueIdentifier, ownerKey, salt, depositAmount);
```

| Name | Type | Description |
| :--- | :--- | :--- |
| deviceUniqueIdentifier | `string` | The id for this device |
| ownerKey | `P256Key` | The passkey's P-256 public key, as `[x, y]` hex |
| salt | `bigint` | Makes the address unique per user |
| depositAmount | `bigint` | ETH sent with the deploy, in wei |

Returns `Promise<Hash>`, a transaction hash. This is a direct EOA transaction, not a user operation.

## getAddress {#getaddress}

Works out the address a device wallet will deploy to for a given identifier, owner key and salt, without sending anything. The same computation `kokio.smartAccount.getSmartWallet` uses internally.

```ts
const address = await kokio.deviceWalletFactory!.getAddress(deviceUniqueIdentifier, ownerKey, salt);
```

Takes the same `deviceUniqueIdentifier`, `ownerKey` and `salt` as [`createAccountWithEOA`](#createaccountwitheoa).

Returns `Promise<Address>`.

## preCreateAccountValidation {#precreateaccountvalidation}

Checks whether a device identifier or owner key is already taken, before deploying.

:::warning
Call this before any deploy. Once a user operation reaches the chain, the factory cannot see the registry from inside EntryPoint validation, so a taken identifier deploys a second, orphaned wallet instead of failing cleanly.
:::

```ts
const holder = await kokio.deviceWalletFactory!.preCreateAccountValidation(deviceUniqueIdentifier, ownerKey);
```

| Name | Type | Description |
| :--- | :--- | :--- |
| deviceUniqueIdentifier | `string` | The device id to check |
| ownerKey | `P256Key` | The owner key to check |

Returns `Promise<Address>`, the zero address when both are free, or the wallet already holding one of them.

## deviceWalletInfoAdded {#devicewalletinfoadded}

Checks whether the factory has finished registering a device wallet.

:::note
This flips to `true` only after the backend calls `postCreateAccount`, so a wallet the app just deployed reads `false` until the backend catches up.
:::

```ts
const registered = await kokio.deviceWalletFactory!.deviceWalletInfoAdded(deviceWalletAddress);
```

Returns `Promise<boolean>`.

## getCurrentDeviceWalletImplementation {#getcurrentdevicewalletimplementation}

Reads the device wallet implementation contract every new wallet points at.

```ts
const impl = await kokio.deviceWalletFactory!.getCurrentDeviceWalletImplementation();
```

Returns `Promise<Address>`.

## beacon {#beacon}

Reads the beacon every device wallet reads its implementation from. One beacon update moves every existing device wallet at once. The beacon address is on the [Base mainnet](../../deployments/base.md#contracts) and [Base Sepolia](../../deployments/base-sepolia.md#contracts) pages.

```ts
const beacon = await kokio.deviceWalletFactory!.beacon();
```

Returns `Promise<Address>`.

## registry {#registry}

Reads the registry address the factory writes newly deployed wallets into.

```ts
const registry = await kokio.deviceWalletFactory!.registry();
```

Returns `Promise<Address>`.

## entryPoint {#entrypoint}

Reads the ERC-4337 EntryPoint address baked into every wallet this factory deploys.

```ts
const entryPoint = await kokio.deviceWalletFactory!.entryPoint();
```

Returns `Promise<Address>`.

## verifier {#verifier}

Reads the P256 verifier contract new device wallets use to check WebAuthn signatures.

```ts
const verifier = await kokio.deviceWalletFactory!.verifier();
```

Returns `Promise<Address>`.
