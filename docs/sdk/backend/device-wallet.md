---
title: Device wallet (backend)
description: admin.deviceWallet is the EOA-signed view of one Kokio device wallet, used by a backend to deploy an eSIM wallet under it, top up its gas deposit and read its state.
---

# Device wallet (backend) {#device-wallet-backend}

`admin.deviceWallet`

The EOA-signed view of one Kokio device wallet, the ERC-4337 smart account a user's passkey owns. The contract behind this surface is documented at [device wallet](../../contracts/device-wallet.md).

Only present once bound with `admin.setDeviceWalletAddress(address)`. Writes here send an ordinary transaction from the admin EOA, no bundler or passkey involved. See [backend setup](./setup.md).

```ts
admin.setDeviceWalletAddress(deviceWalletAddress);
const hash = await admin.deviceWallet!.deployESIMWallet(salt);
```

The user-facing half of the same contract is on [`kokio.deviceWallet`](../mobile/device-wallet.md), which carries the methods a passkey can sign for.

## deployESIMWallet {#deployesimwallet}

Deploys a new eSIM wallet under this device wallet. This is the backend's normal onboarding flow: deploy the device wallet, then deploy its first eSIM wallet.

It is the only path to `DeviceWallet.deployESIMWallet`. It needs the admin EOA and cannot be reached from a device wallet user operation.

```ts
const hash = await admin.deviceWallet!.deployESIMWallet(salt);
```

Returns `Promise<Hash>`.

## addDeposit {#adddeposit}

Tops up this device wallet's gas deposit at the EntryPoint, paid from the admin EOA's own balance. Open to anyone, since paying into another account's deposit only costs the payer.

```ts
const hash = await admin.deviceWallet!.addDeposit(amount);
```

Returns `Promise<Hash>`.

## deviceUniqueIdentifier {#deviceuniqueidentifier}

Reads the device identifier this wallet was deployed for.

```ts
const id = await admin.deviceWallet!.deviceUniqueIdentifier();
```

Returns `Promise<string>`.

## isValidESIMWallet {#isvalidesimwallet}

Checks whether this device wallet currently holds a given eSIM wallet.

```ts
const holds = await admin.deviceWallet!.isValidESIMWallet(eSIMWalletAddress);
```

Returns `Promise<boolean>`.

## canPullFunds {#canpullfunds}

Checks whether an eSIM wallet is currently allowed to pull tokens from this device wallet.

```ts
const allowed = await admin.deviceWallet!.canPullFunds(eSIMWalletAddress);
```

Returns `Promise<boolean>`.

## getVaultAddress {#getvaultaddress}

Reads the protocol vault address this wallet's fees flow to.

```ts
const vault = await admin.deviceWallet!.getVaultAddress();
```

Returns `Promise<Address>`.

## getOwner {#getowner}

Reads the P256 public key that currently owns this wallet.

```ts
const ownerKey = await admin.deviceWallet!.getOwner();
```

Returns `Promise<P256Key>`, an `[x, y]` hex pair.

## getDeposit {#getdeposit}

Reads the gas balance this wallet currently holds at the EntryPoint.

```ts
const deposit = await admin.deviceWallet!.getDeposit();
```

Returns `Promise<bigint>`.

## isValidSignature {#isvalidsignature}

Checks a signature over an arbitrary message, following ERC-1271.

```ts
const result = await admin.deviceWallet!.isValidSignature(messageHash, signature);
```

Returns `Promise<Hex>`, `0x1626ba7e` when the signature is valid and has not expired, `0xffffffff` otherwise.

## registry {#registry}

Reads the address of the registry this wallet reports ownership changes to.

```ts
const registry = await admin.deviceWallet!.registry();
```

Returns `Promise<Address>`.

## eSIMWalletFactory {#esimwalletfactory}

Reads the address of the factory that deploys this wallet's eSIM wallets.

```ts
const factory = await admin.deviceWallet!.eSIMWalletFactory();
```

Returns `Promise<Address>`.

## entryPoint {#entrypoint}

Reads the ERC-4337 EntryPoint address this wallet answers to.

```ts
const entryPoint = await admin.deviceWallet!.entryPoint();
```

Returns `Promise<Address>`.

## verifier {#verifier}

Reads the P256 verifier contract this wallet falls back to when the chain has no RIP-7212 precompile for signature checks.

```ts
const verifier = await admin.deviceWallet!.verifier();
```

Returns `Promise<Address>`.
