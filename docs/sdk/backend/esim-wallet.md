---
title: eSIM wallet (backend)
description: admin.eSIMWallet buys a data bundle for one Kokio eSIM as the admin and reads its history, and admin.eSIMWalletFactory holds the owner-only settings on the factory behind it.
---

# eSIM wallet (backend) {#esim-wallet-backend}

Reference for `admin.eSIMWallet` and `admin.eSIMWalletFactory`: buy for a user from the admin key, and manage the eSIM wallet factory.

---

`admin.eSIMWallet`

The EOA-signed view of one Kokio eSIM wallet, the contract holding a single eSIM's purchase history and price cap. The contract is documented at [eSIM wallet](../../contracts/esim-wallet.md).

:::note
Only present once bound with `admin.setESIMWalletAddress(address)`. See [backend setup](./setup.md).
:::

```ts title="Quote, then buy"
admin.setESIMWalletAddress(eSIMWalletAddress);
const asset = "0x5553444300000000000000000000000000000000000000000000000000000000"; // "USDC" as bytes32
const maxAmountIn = await admin.paymentAdapter.quote(asset, 500n);
const hash = await admin.eSIMWallet!.buyDataBundleWithToken(
  { id: bundleId, priceUSDCents: 500n, settlement: 0 },
  asset,
  maxAmountIn,
  paymentReference,
);
```

Prices are whole US cents as a `bigint` and a currency is named by a `bytes32`. Both are explained on the [payments](./payments.md) page. The user-facing half of this contract is on [`kokio.eSIMWallet`](../mobile/esim-wallet.md).

## buyDataBundleWithToken {#buydatabundlewithtoken}

Buys a data bundle for this eSIM as the admin, rather than as the eSIM's own device wallet. Use it when the backend is triggering a purchase on the user's behalf and the device wallet's own token balance pays for it.

:::note
For a purchase that was paid for outside the protocol, on a card or through another wallet, use [`registry.recordSettledPurchase`](./registry.md) instead. This call moves tokens and only makes sense when tokens are what paid.
:::

```ts
const hash = await admin.eSIMWallet!.buyDataBundleWithToken(
  { id: bundleId, priceUSDCents: 500n, settlement: 0 },
  asset,
  maxAmountIn,
  paymentReference,
);
```

| Name | Type | Description |
| :--- | :--- | :--- |
| dataBundleDetails | `DataBundleDetails` | `id` (`bytes32`), `priceUSDCents` (`bigint`, whole US cents) and `settlement` (`0` when the device wallet pays). See [types](../../contracts/types.md#databundledetails-explained) |
| asset | `Hex` | The currency as a `bytes32` symbol, such as `USDC` |
| maxAmountIn | `bigint` | The most of `asset` this purchase may spend, in its smallest unit. Take it from [`admin.paymentAdapter.quote(asset, priceUSDCents)`](./payments.md#quote) |
| paymentReference | `Hex` | A backend-issued `bytes32` id, spendable once per eSIM wallet |

:::warning
Each admin purchase spends the wallet's admin allowance, which only the user can raise. When the price is above what is left, this throws `AdminAllowanceExceededError` (with `priceUSDCents` and `remainingUSDCents`) and sends nothing. Ask the user to raise the allowance in the app, then retry.
:::

Returns `Promise<Hash>`.

## adminAllowanceUSDCents {#adminallowanceusdcents}

Reads what the admin key may still charge this eSIM wallet, in US cents. `buyDataBundleWithToken` checks it before sending.

```ts
const remaining = await admin.eSIMWallet!.adminAllowanceUSDCents();
```

Returns `Promise<bigint>`.

## eSIMWalletFactory {#esimwalletfactory}

Reads the address of the factory that deployed this eSIM wallet.

```ts
const factory = await admin.eSIMWallet!.eSIMWalletFactory();
```

Returns `Promise<Address>`.

## eSIMUniqueIdentifier {#esimuniqueidentifier}

Reads the eSIM identifier this wallet was created for.

```ts
const id = await admin.eSIMWallet!.eSIMUniqueIdentifier();
```

Returns `Promise<string>`.

## newRequestedOwner {#newrequestedowner}

Reads the device wallet named in a pending ownership transfer, if any.

```ts
const pending = await admin.eSIMWallet!.newRequestedOwner();
```

Returns `Promise<Address>`.

## owner {#owner}

Reads the device wallet that currently owns this eSIM wallet.

```ts
const owner = await admin.eSIMWallet!.owner();
```

Returns `Promise<Address>`.

## priceCapUSDCents {#pricecapusdcents}

Reads the price ceiling stored on this wallet directly, in US cents.

:::warning
Unlike the [mobile surface's version](../mobile/esim-wallet.md#pricecapusdcents), this does not fall back to the registry's default when the wallet has none of its own. It returns whatever this wallet's own storage holds.
:::

```ts
const cap = await admin.eSIMWallet!.priceCapUSDCents();
```

Returns `Promise<bigint>`.

## deviceWallet {#devicewallet}

Reads the device wallet this eSIM wallet belongs to.

```ts
const deviceWallet = await admin.eSIMWallet!.deviceWallet();
```

Returns `Promise<Address>`.

## transactionHistory {#transactionhistory}

Reads one past purchase by its position in the list.

```ts
const purchase = await admin.eSIMWallet!.transactionHistory(0n);
```

Returns `Promise<DataBundleDetails>`, shaped `{ id, priceUSDCents, settlement }`. `settlement` names which contract, if any, saw the money move:

| Value | Paid from | Provable onchain |
|---|---|---|
| `0` | The device wallet's own balance | Yes |
| `1` | An external wallet | No |
| `2` | Fiat | No |

## Factory settings {#esim-wallet-factory}

`admin.eSIMWalletFactory`

Admin-only settings on the factory that deploys eSIM wallets. The contract is documented at [eSIM wallet factory](../../contracts/esim-wallet-factory.md).

:::note
Deploying an eSIM wallet is not exposed here. That call is restricted to the registry, the device wallet factory, or the owning device wallet, so it always reverts from a bare admin EOA. Use [`kokio.eSIMWalletFactory`](../mobile/esim-wallet.md#esim-wallet-factory) for actual deploys.
:::

### addRegistryAddress {#addregistryaddress}

One-time setup call that wires the registry address into the eSIM wallet factory. Run once, as part of initial deployment.

```ts
const hash = await admin.eSIMWalletFactory.addRegistryAddress(registryAddress);
```

Returns `Promise<Hash>`.

### updateESIMWalletImplementation {#updateesimwalletimplementation}

Points the eSIM wallet beacon at a new implementation contract.

:::warning
This moves every deployed eSIM wallet to the new code at once.
:::

```ts
const hash = await admin.eSIMWalletFactory.updateESIMWalletImplementation(newImplementation);
```

Returns `Promise<Hash>`.

### isESIMWalletDeployed {#isesimwalletdeployed}

Checks whether an address is an eSIM wallet this factory deployed.

```ts
const deployed = await admin.eSIMWalletFactory.isESIMWalletDeployed(eSIMWalletAddress);
```

Returns `Promise<boolean>`.

### getCurrentESIMWalletImplementation {#getcurrentesimwalletimplementation}

Reads the eSIM wallet implementation contract every new eSIM wallet points at.

```ts
const impl = await admin.eSIMWalletFactory.getCurrentESIMWalletImplementation();
```

Returns `Promise<Address>`.

### owner {#factory-owner}

Reads the current owner of the factory contract. On the live deployment this is the [ProtocolAdmin](./protocol-admin.md) timelock.

```ts
const owner = await admin.eSIMWalletFactory.owner();
```

Returns `Promise<Address>`.

### pendingOwner {#pendingowner}

Reads the address named in a pending `transferOwnership`, if any.

```ts
const pending = await admin.eSIMWalletFactory.pendingOwner();
```

Returns `Promise<Address>`.

### proxiableUUID {#proxiableuuid}

Reads the UUPS implementation slot.

```ts
const slot = await admin.eSIMWalletFactory.proxiableUUID();
```

Returns `Promise<Hex>`.

### upgradeInterfaceVersion {#upgradeinterfaceversion}

Reads the UUPS interface version string the current implementation reports.

```ts
const version = await admin.eSIMWalletFactory.upgradeInterfaceVersion();
```

Returns `Promise<string>`.

### acceptOwnership {#acceptownership}

Accepts a pending ownership transfer. Call this from the account named as `pendingOwner`.

```ts
const hash = await admin.eSIMWalletFactory.acceptOwnership();
```

Returns `Promise<Hash>`.

### transferOwnershipCall {#transferownershipcall}

Builds the call payload to hand ownership of the factory to a new address. On the live deployment the owner is the ProtocolAdmin timelock, so hand the result to `protocolAdmin.proposer.schedule` rather than sending it directly.

:::warning
Handing over ownership also hands over the eSIM wallet beacon, because the factory owns it.
:::

```ts
const call = await admin.eSIMWalletFactory.transferOwnershipCall(newOwner);
const scheduled = await admin.protocolAdmin.proposer.schedule(call);
```

Returns `Promise<OwnerCall>`.

### upgradeCall {#upgradecall}

Builds the call payload to point the factory's own proxy at a new implementation. Hand the result to `protocolAdmin.proposer.schedule`.

:::note
This does not touch already deployed eSIM wallets. Those move through `updateESIMWalletImplementation` and the beacon instead.
:::

```ts
const call = await admin.eSIMWalletFactory.upgradeCall(newImplementation);
const scheduled = await admin.protocolAdmin.proposer.schedule(call);
```

| Name | Type | Description |
| :--- | :--- | :--- |
| newImplementation | `Address` | The new implementation contract |
| data | `Hex`, optional | Calldata to run on the new implementation as part of the upgrade |

Returns `Promise<OwnerCall>`.
