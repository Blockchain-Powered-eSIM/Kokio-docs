---
title: Device wallet (mobile)
description: kokio.deviceWallet wraps one user's Kokio device wallet, the ERC-4337 smart account owned by a passkey, with methods to deploy and attach eSIM wallets, grant fund access, transfer ownership and manage the gas deposit.
---

# Device wallet (mobile) {#device-wallet-mobile}

Reference for `kokio.deviceWallet`: one user's passkey-owned smart account, from the app.

---

`kokio.deviceWallet`

Wraps one user's device wallet, the ERC-4337 smart account a passkey owns. There is one per phone. The contract behind this surface is documented at [device wallet](../../contracts/device-wallet.md).

:::note
Only present once [`Kokio`](./setup.md) has both a `smartAccountClient` and a `deviceWalletAddress`, set on the constructor or bound afterwards with `kokio.setDeviceWalletAddress(address)`.
:::

Every write here sends a user operation signed by the passkey.

```ts title="Send and confirm"
const hash = await kokio.deviceWallet!.toggleAccessToFunds(eSIMWalletAddress, true);
const receipt = await smartAccountClient.waitForUserOperationReceipt({ hash });
if (!receipt.success) throw new Error("operation reverted");
```

A call the contract would refuse throws `ContractRevertError` before it is sent, with the error name in `err.decoded?.errorName`.

:::warning
If the chain changes between that check and inclusion, the operation can still revert onchain. It is then mined and returns a receipt, so check `success` rather than treating a resolved await as confirmation.
:::

## sendUserOperation {#senduseroperation}

Sends one or more raw calls from this device wallet as a single user operation. The escape hatch for anything not named by a method below: sending ETH to any address, calling another contract, or interacting with a DeFi protocol. A single call encodes to the account's `execute`, several batch atomically through `executeBatch`.

```ts
const hash = await kokio.deviceWallet!.sendUserOperation([
  { to: recipient, value: parseEther("0.01") },
]);
```

Returns `Promise<Hash>`, the user operation hash.

## deployAndBindESIMWallet {#deployandbindesimwallet}

Deploys a new eSIM wallet for this device wallet and adds it to the device wallet's list, in one user operation and one passkey prompt. Use it when a user adds a new eSIM.

:::warning
The device wallet has to be registered first, by the backend's [`postCreateAccount`](../backend/device-wallet-factory.md#postcreateaccount) or by a backend deploy, or the operation reverts.
:::

```ts
const { userOpHash, eSIMWalletAddress } = await kokio.deviceWallet!.deployAndBindESIMWallet(1n, {
  grantAccessToFunds: true,
});
kokio.setESIMWalletAddress(eSIMWalletAddress);
```

| Name | Type | Description |
| :--- | :--- | :--- |
| salt | `bigint` | Each salt gives one address, so use a new salt for each eSIM wallet on the same device |
| options.grantAccessToFunds | `boolean`, optional | Also let the new eSIM wallet pull tokens from this device wallet, which [`buyDataBundleWithToken`](./esim-wallet.md#buydatabundlewithtoken) needs when the eSIM wallet holds less than the price |

Returns `Promise<{ userOpHash: Hash; eSIMWalletAddress: Address }>`. The address is worked out before the operation lands, so wait for the receipt before reading from it.

## addESIMWallet {#addesimwallet}

Adds an eSIM wallet this device already owns onto the device wallet's list. Use it after an eSIM wallet transfer lands, once the eSIM wallet's `owner()` already points at this device wallet.

:::note
This never grants fund access on its own. Call `toggleAccessToFunds` afterwards if the eSIM wallet should be able to pull tokens.
:::

```ts
const hash = await kokio.deviceWallet!.addESIMWallet(eSIMWalletAddress);
```

Returns `Promise<Hash>`, a user operation hash.

## removeESIMWallet {#removeesimwallet}

Releases an eSIM wallet from this device wallet and marks it on standby for a transfer to another device.

```ts
const hash = await kokio.deviceWallet!.removeESIMWallet(eSIMWalletAddress, true);
```

| Name | Type | Description |
| :--- | :--- | :--- |
| eSIMWalletAddress | `Address` | The eSIM wallet to release |
| callBackETH | `boolean` | Sweep any ETH the eSIM wallet still holds back to this device wallet, after the release runs |

:::warning
A failed sweep does not fail the whole call, so `callBackETH: true` does not guarantee anything arrived.
:::

Returns `Promise<Hash>`.

## toggleAccessToFunds {#toggleaccesstofunds}

Turns on or off whether an eSIM wallet may pull tokens held in this device wallet. Use it when the user wants to fund a specific eSIM's purchases, or to take that permission back.

```ts
const hash = await kokio.deviceWallet!.toggleAccessToFunds(eSIMWalletAddress, true);
```

| Name | Type | Description |
| :--- | :--- | :--- |
| eSIMWalletAddress | `Address` | The eSIM wallet to grant or revoke |
| hasAccessToFunds | `boolean` | `true` to let it pull tokens, `false` to take that back |

Returns `Promise<Hash>`.

## transferOwnership {#transferownership}

Moves ownership of this device wallet to a new passkey. Use it when a user gets a new device or resets their passkey.

It takes two signatures:

1. The new passkey signs the wallet's `rotationChallenge` for its own key.
2. The current passkey signs the user operation that sends it.

```ts
const challenge = await kokio.deviceWallet!.rotationChallenge(newOwnerKey);
// The new passkey signs `challenge` here, and the app encodes its assertion as `newOwnerSignature`.
const hash = await kokio.deviceWallet!.transferOwnership(newOwnerKey, newOwnerSignature);
```

| Name | Type | Description |
| :--- | :--- | :--- |
| newOwner | `P256Key` | The new passkey's public key, as `[x, y]` hex |
| newOwnerSignature | `Hex` | The new passkey's WebAuthn assertion over the challenge bytes, ABI-encoded as a `WebAuthnSignature` tuple (`authenticatorData`, `clientDataJSON`, `challengeIndex`, `typeIndex`, `r`, `s`). No version or `validUntil` header, unlike a user operation signature |

:::warning
The wallet reverts with `NewOwnerKeyCannotSign` if the new key's signature is missing, comes from another key, was made for another wallet or chain, or lacks user verification. `s` must be in the low half of the curve order. A wallet can only move to a key that can sign.
:::

Returns `Promise<Hash>`.

## rotationChallenge {#rotationchallenge}

Reads the bytes a new passkey must sign before `transferOwnership` accepts it. They are bound to this wallet, this chain and `newOwnerKey`, so a challenge cannot be reused elsewhere.

:::warning
Do not cache a rotation challenge across chains.
:::

The value is `keccak256("\x19Ethereum Signed Message:\n116" ‖ chainId ‖ wallet ‖ x ‖ y)`, packed, so it can also be built offchain.

```ts
const challenge = await kokio.deviceWallet!.rotationChallenge(newOwnerKey);
```

Returns `Promise<Hex>`, 32 bytes.

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

| Name | Type | Description |
| :--- | :--- | :--- |
| withdrawAddress | `Address` | Where the ETH goes |
| amount | `bigint` | How much to withdraw, in wei |

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

| Name | Type | Description |
| :--- | :--- | :--- |
| messageHash | `Hex` | The hash of the message that was signed |
| signature | `Hex` | One version byte, six bytes of `validUntil`, then the ABI-encoded WebAuthn assertion. See [the ERC-1271 side](../../contracts/account-4337.md#the-erc-1271-side) |

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
