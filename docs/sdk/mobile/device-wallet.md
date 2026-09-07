---
title: Device wallet (mobile)
description: kokio.deviceWallet wraps one user's Kokio device wallet, the ERC-4337 smart account owned by a passkey, with methods to attach eSIM wallets, grant fund access, transfer ownership and manage the gas deposit.
---

# Device wallet (mobile) {#device-wallet-mobile}

`kokio.deviceWallet`

Wraps one user's device wallet, the ERC-4337 smart account a passkey owns. There is one per phone. The contract behind this surface is documented at [device wallet](../../contracts/device-wallet.md).

It is only present once [`Kokio`](./setup.md) has both a `smartAccountClient` and a `deviceWalletAddress`, set on the constructor or bound afterwards with `kokio.setDeviceWalletAddress(address)`. Every write here sends a user operation signed by the passkey.

```ts
const hash = await kokio.deviceWallet!.toggleAccessToFunds(eSIMWalletAddress, true);
const receipt = await smartAccountClient.waitForUserOperationReceipt({ hash });
if (!receipt.success) throw new Error("operation reverted");
```

An operation whose calls revert is still mined and still returns a receipt, so check `success` rather than treating a resolved await as confirmation.

## sendUserOperation {#senduseroperation}

Sends one or more raw calls from this device wallet as a single user operation. The escape hatch for anything not named by a method below: sending ETH to any address, calling another contract, or interacting with a DeFi protocol. A single call encodes to the account's `execute`, several batch atomically through `executeBatch`.

```ts
const hash = await kokio.deviceWallet!.sendUserOperation([
  { to: recipient, value: parseEther("0.01") },
]);
```

Returns `Promise<Hash>`, the user operation hash.

## addESIMWallet {#addesimwallet}

Adds an eSIM wallet this device already owns onto the device wallet's list. Use it after an eSIM wallet transfer lands, once the eSIM wallet's `owner()` already points at this device wallet.

This never grants fund access on its own. Call `toggleAccessToFunds` afterwards if the eSIM wallet should be able to pull tokens.

```ts
const hash = await kokio.deviceWallet!.addESIMWallet(eSIMWalletAddress);
```

Returns `Promise<Hash>`, a user operation hash.

## removeESIMWallet {#removeesimwallet}

Releases an eSIM wallet from this device wallet and marks it on standby for a transfer to another device.

`callBackETH` sweeps any ETH the eSIM wallet is still holding back to this device wallet, after the release runs. A failed sweep does not fail the whole call, so a `true` here does not guarantee anything arrived.

```ts
const hash = await kokio.deviceWallet!.removeESIMWallet(eSIMWalletAddress, true);
```

Returns `Promise<Hash>`.

## toggleAccessToFunds {#toggleaccesstofunds}

Turns on or off whether an eSIM wallet may pull tokens held in this device wallet. Use it when the user wants to fund a specific eSIM's purchases, or to take that permission back.

```ts
const hash = await kokio.deviceWallet!.toggleAccessToFunds(eSIMWalletAddress, true);
```

Returns `Promise<Hash>`.

## transferOwnership {#transferownership}

Moves ownership of this device wallet to a new passkey. Use it when a user gets a new device or resets their passkey.

This is permanent and self-signed: it needs a valid signature from the current passkey, and there is no way to transfer again if the new key turns out to be unusable. Make sure the new key can actually sign before calling.

```ts
const hash = await kokio.deviceWallet!.transferOwnership(newOwnerKey);
```

Returns `Promise<Hash>`.

## addDeposit {#adddeposit}

Tops up the gas deposit this wallet holds at the ERC-4337 EntryPoint, from the wallet's own ETH balance. Use it to keep the wallet able to pay for its own user operations.

```ts
const hash = await kokio.deviceWallet!.addDeposit(amount);
```

Returns `Promise<Hash>`.

## withdrawDepositTo {#withdrawdepositto}

Pulls part of the EntryPoint gas deposit back out, to any address. Use it to recover unused gas funds.

```ts
const hash = await kokio.deviceWallet!.withdrawDepositTo(withdrawAddress, amount);
```

Returns `Promise<Hash>`.

## getVaultAddress {#getvaultaddress}

Reads the protocol vault address this wallet's fees flow to. A plain read, no user operation.

```ts
const vault = await kokio.deviceWallet!.getVaultAddress();
```

Returns `Promise<Address>`.

## getDeposit {#getdeposit}

Reads the gas balance this wallet currently holds at the EntryPoint.

```ts
const deposit = await kokio.deviceWallet!.getDeposit();
```

Returns `Promise<bigint>`.

## deviceUniqueIdentifier {#deviceuniqueidentifier}

Reads the device identifier this wallet was deployed for. Set once, at deploy, and never changes.

```ts
const id = await kokio.deviceWallet!.deviceUniqueIdentifier();
```

Returns `Promise<string>`.

## isValidESIMWallet {#isvalidesimwallet}

Checks whether this device wallet currently holds a given eSIM wallet.

```ts
const holds = await kokio.deviceWallet!.isValidESIMWallet(eSIMWalletAddress);
```

Returns `Promise<boolean>`.

## canPullFunds {#canpullfunds}

Checks whether an eSIM wallet is currently allowed to pull tokens from this device wallet. Starts `false` for every eSIM wallet until `toggleAccessToFunds` turns it on.

```ts
const allowed = await kokio.deviceWallet!.canPullFunds(eSIMWalletAddress);
```

Returns `Promise<boolean>`.

## isValidSignature {#isvalidsignature}

Checks a signature over an arbitrary message, following ERC-1271. Use it to verify a passkey signature offchain, the same way another contract would check it onchain.

```ts
const result = await kokio.deviceWallet!.isValidSignature(messageHash, signature);
```

Returns `Promise<Hex>`, `0x1626ba7e` when the signature is valid and has not expired, `0xffffffff` otherwise.

## getOwner {#getowner}

Reads the P256 public key that currently owns this wallet.

```ts
const ownerKey = await kokio.deviceWallet!.getOwner();
```

Returns `Promise<P256Key>`, an `[x, y]` hex pair.

## registry {#registry}

Reads the address of the registry this wallet reports ownership changes to.

```ts
const registry = await kokio.deviceWallet!.registry();
```

Returns `Promise<Address>`.

## eSIMWalletFactory {#esimwalletfactory}

Reads the address of the factory that deploys this wallet's eSIM wallets.

```ts
const factory = await kokio.deviceWallet!.eSIMWalletFactory();
```

Returns `Promise<Address>`.

## entryPoint {#entrypoint}

Reads the ERC-4337 EntryPoint address this wallet answers to. Fixed at deploy.

```ts
const entryPoint = await kokio.deviceWallet!.entryPoint();
```

Returns `Promise<Address>`.

## verifier {#verifier}

Reads the P256 verifier contract this wallet falls back to when the chain has no RIP-7212 precompile for signature checks.

```ts
const verifier = await kokio.deviceWallet!.verifier();
```

Returns `Promise<Address>`.
