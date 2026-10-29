---
title: eSIM wallet (mobile)
description: kokio.eSIMWallet buys data bundles for one Kokio eSIM, with or without access to the device wallet's funds, sets its price cap and moves it between devices, and kokio.eSIMWalletFactory predicts a new one's address.
---

# eSIM wallet (mobile) {#esim-wallet-mobile}

Reference for `kokio.eSIMWallet`: buy data bundles for one eSIM, set its limits and move it between devices.

---

`kokio.eSIMWallet`

Wraps one eSIM wallet, the Kokio contract holding a single eSIM's purchase history and price cap. There is one per eSIM. The contract behind this surface is documented at [eSIM wallet](../../contracts/esim-wallet.md).

:::note
Only present once [`Kokio`](./setup.md) has both a `smartAccountClient` and an `eSIMWalletAddress`, set on the constructor or bound afterwards with `kokio.setESIMWalletAddress(address)`. That setter is how a user with several eSIM wallets switches which one the app is acting on.
:::

Writes here need the device wallet that owns this eSIM wallet to be the signer, which is exactly what a passkey user operation already is.

```ts title="Quote, then buy"
const asset = "0x5553444300000000000000000000000000000000000000000000000000000000"; // "USDC" as bytes32
const dataBundleDetails = { id: bundleId, priceUSDCents: 500n, settlement: Settlement.DeviceWallet };
const maxAmountIn = await kokio.paymentAdapter!.quote(asset, dataBundleDetails.priceUSDCents);
const hash = await kokio.eSIMWallet!.buyDataBundleWithToken(dataBundleDetails, asset, maxAmountIn, paymentReference);
```

Prices are whole US cents as a `bigint`, and a currency is named by a `bytes32` rather than a string. Both are explained on the [payments](./payments.md) page.

## buyDataBundleWithToken {#buydatabundlewithtoken}

Buys a data bundle for this eSIM, paid for in an ERC-20 the payment adapter accepts, which is USDC, USDT or DAI on Base mainnet and USDC on Base Sepolia. This is the everyday purchase flow.

If this eSIM wallet holds less than the price, the contract pulls the rest from the device wallet. The contract takes a maximum rather than an exact amount so a swap path can be added later. Today nothing moves the price between the quote and the purchase, so the quoted amount can be passed straight through.

:::warning
The purchase reverts if the price is above [`priceCapUSDCents()`](#pricecapusdcents), so check that first. It reverts with `FundsAccessRevoked` if the eSIM wallet has no access to the device wallet's funds, granted by [`deviceWallet.toggleAccessToFunds`](./device-wallet.md#toggleaccesstofunds) or by `deployAndBindESIMWallet` with `grantAccessToFunds: true`. Use [`buyDataBundleWithTransfer`](#buydatabundlewithtransfer) in that case.
:::

```ts
const hash = await kokio.eSIMWallet!.buyDataBundleWithToken(
  { id: bundleId, priceUSDCents: 500n, settlement: Settlement.DeviceWallet },
  asset,
  maxAmountIn,
  paymentReference,
);
```

| Name | Type | Description |
| :--- | :--- | :--- |
| dataBundleDetails | `DataBundleDetails` | `id` (`bytes32`), `priceUSDCents` (`bigint`, whole US cents, at most the price cap) and `settlement` (`Settlement.DeviceWallet` when this wallet's own balance pays). See [types](../../contracts/types.md#databundledetails-explained) |
| asset | `Hex` | The currency as a `bytes32` symbol, such as `USDC` |
| maxAmountIn | `bigint` | The most of `asset` this purchase may spend, in its smallest unit. Take it from [`kokio.paymentAdapter.quote(asset, priceUSDCents)`](./payments.md#quote) |
| paymentReference | `Hex` | The backend's `bytes32` id for this order, spendable once per eSIM wallet. The backend hands it to the app, and the SDK never invents one |

Returns `Promise<Hash>`, a user operation hash.

## buyDataBundleWithTransfer {#buydatabundlewithtransfer}

The same purchase as `buyDataBundleWithToken`, for an eSIM wallet with no access to the device wallet's funds. In one user operation the device wallet sends the eSIM wallet whatever it is short of the quote, then the purchase runs. The arguments are the [same](#buydatabundlewithtoken).

:::note
The device wallet has to hold enough of the asset's token. Only the shortfall is sent, so tokens already on the eSIM wallet are spent first.
:::

```ts
const hash = await kokio.eSIMWallet!.buyDataBundleWithTransfer(dataBundleDetails, asset, maxAmountIn, paymentReference);
```

:::tip
When the backend builds these calls with [`admin.calls.buyDataBundleWithTransfer`](../backend/calls.md), sign what it returns with `kokio.deviceWallet!.sendUserOperation(calls)` instead.
:::

Returns `Promise<Hash>`, a user operation hash.

## sendTokenToDeviceWallet {#sendtokentodevicewallet}

Sends an ERC-20 held by this eSIM wallet back to its owning device wallet. Nothing else moves a stray token balance off this wallet, so use this when one is stuck here after a handover or a refund.

```ts
const hash = await kokio.eSIMWallet!.sendTokenToDeviceWallet(tokenAddress, amount);
```

| Name | Type | Description |
| :--- | :--- | :--- |
| token | `Address` | The ERC-20 to send back |
| amount | `bigint` | How much, in the token's smallest unit |

Returns `Promise<Hash>`.

## setPriceCapUSDCents {#setpricecapusdcents}

Sets the most this eSIM wallet may be charged for one bundle, in US cents. Use it to give the user control over their own spending limit, separate from whatever the admin sets as the default.

:::note
Pass `0n` to hand control back to the registry's default cap.
:::

```ts
const hash = await kokio.eSIMWallet!.setPriceCapUSDCents(50_000n); // \$500.00
```

Returns `Promise<Hash>`.

## setAdminAllowanceUSDCents {#setadminallowanceusdcents}

Sets the total the Kokio backend (the admin key) may charge this eSIM wallet, in US cents. Each admin purchase lowers it and nothing refills it, so this is how the user lets the backend keep buying for them. Purchases the user signs themselves never touch it.

:::warning
The new figure replaces what is left rather than adding to it. `0n` stops admin purchases entirely.
:::

A new eSIM wallet starts at the registry default, and so does a wallet that moves to another device wallet.

```ts
const hash = await kokio.eSIMWallet!.setAdminAllowanceUSDCents(5_000n); // \$50.00
```

Returns `Promise<Hash>`.

## requestTransferOwnership {#requesttransferownership}

Starts moving this eSIM wallet to a new device wallet. Use it when a user is switching their eSIM to a different device. The move only completes once the new device wallet calls `acceptOwnershipTransfer`.

```ts
const hash = await kokio.eSIMWallet!.requestTransferOwnership(newDeviceWalletAddress);
```

Returns `Promise<Hash>`.

## acceptOwnershipTransfer {#acceptownershiptransfer}

Finishes a transfer that another device wallet started. Call this from the device wallet that was named in `requestTransferOwnership`.

```ts
const hash = await kokio.eSIMWallet!.acceptOwnershipTransfer();
```

Returns `Promise<Hash>`.

## acceptAndBindESIMWallet {#acceptandbindesimwallet}

Accepts the transfer and adds the eSIM wallet to this device wallet's list, in one user operation and one passkey prompt. Use it instead of `acceptOwnershipTransfer` followed by `deviceWallet.addESIMWallet`. Pass `grantAccessToFunds: true` to also let the eSIM wallet pull tokens from this device wallet.

```ts
kokio.setESIMWalletAddress(eSIMWalletAddress);
const hash = await kokio.eSIMWallet!.acceptAndBindESIMWallet({ grantAccessToFunds: true });
```

:::tip
When the backend builds these calls with [`admin.calls.acceptAndBindESIMWallet`](../backend/calls.md), sign what it returns with `kokio.deviceWallet!.sendUserOperation(calls)` instead.
:::

Returns `Promise<Hash>`, a user operation hash.

## sendETHToDeviceWallet {#sendethtodevicewallet}

Sends ETH held by this eSIM wallet back to its owning device wallet. Data bundles no longer cost ETH, but the wallet still accepts plain ETH transfers, which is how a device wallet tops it up, so this stays around for moving that balance back.

```ts
const hash = await kokio.eSIMWallet!.sendETHToDeviceWallet(amount);
```

Returns `Promise<Hash>`.

## priceCapUSDCents {#pricecapusdcents}

Reads the price ceiling that actually applies to this wallet's next purchase, in US cents. Check this before naming a price on `buyDataBundleWithToken`.

:::note
A wallet with no cap of its own falls back to the registry's default. If neither is set it returns `maxUint256` rather than zero, so a missing cap never reads as "no purchases allowed". That case cannot happen on a live deployment, because the registry refuses a zero default.
:::

```ts
const cap = await kokio.eSIMWallet!.priceCapUSDCents();
```

Returns `Promise<bigint>`.

## adminAllowanceUSDCents {#adminallowanceusdcents}

Reads what the Kokio backend (the admin key) may still charge this eSIM wallet, in US cents. When an admin purchase is refused with `AdminAllowanceExceeded`, show this figure and ask the user to raise it with `setAdminAllowanceUSDCents`.

```ts
const remaining = await kokio.eSIMWallet!.adminAllowanceUSDCents();
```

Returns `Promise<bigint>`.

## owner {#owner}

Reads the device wallet that currently owns this eSIM wallet.

```ts
const owner = await kokio.eSIMWallet!.owner();
```

Returns `Promise<Address>`.

## deviceWallet {#devicewallet}

Reads the device wallet this eSIM wallet belongs to. Tracks the same value as `owner`, but through its own contract slot.

```ts
const deviceWallet = await kokio.eSIMWallet!.deviceWallet();
```

Returns `Promise<Address>`.

## transactionHistory {#transactionhistory}

Reads one past purchase by its position in the list. There is no length getter, so read upward from `0n` until a call reverts, or track the count from the wallet's purchase events.

```ts
const purchase = await kokio.eSIMWallet!.transactionHistory(0n);
```

Returns `Promise<DataBundleDetails>`, shaped `{ id, priceUSDCents, settlement }`. `settlement` names which contract, if any, saw the money move:

| Value | Paid from | Provable onchain |
|---|---|---|
| `0` | This wallet's own balance | Yes |
| `1` | An external wallet | No, the admin's word is the only check |
| `2` | Fiat | No, the admin's word is the only check |

## Deploying a new eSIM wallet {#esim-wallet-factory}

`kokio.eSIMWalletFactory`

Predicts and deploys eSIM wallets for a device wallet. Present as soon as `Kokio` has a `smartAccountClient`, chain-wide like the [device wallet factory](./device-wallet-factory.md). The contract is documented at [eSIM wallet factory](../../contracts/esim-wallet-factory.md).

To deploy a new eSIM wallet, use [`deviceWallet.deployAndBindESIMWallet`](./device-wallet.md#deployandbindesimwallet). It deploys and binds in one user operation and returns the new address.

### getCounterFactualAddress {#getcounterfactualaddress}

Works out the address an eSIM wallet will have for a device wallet and salt, before it is deployed. A plain read, no user operation.

```ts
const eSIMWalletAddress = await kokio.eSIMWalletFactory!.getCounterFactualAddress(deviceWalletAddress, 1n);
```

| Name | Type | Description |
| :--- | :--- | :--- |
| deviceWalletAddress | `Address` | The device wallet that will own the eSIM wallet |
| salt | `bigint` | Makes the eSIM wallet's address unique |

Returns `Promise<Address>`.

### deployESIMWalletWithUserOp {#deployesimwalletwithuserop}

:::warning
Deprecated. Use `deviceWallet.deployAndBindESIMWallet` instead. This deploys the eSIM wallet without adding it to the device wallet's list, so the device wallet does not treat it as its own until `addESIMWallet` runs.
:::

Deploys a new eSIM wallet, owned by the given device wallet. The device wallet sending the user operation has to be one the registry recognises.

```ts
const hash = await kokio.eSIMWalletFactory!.deployESIMWalletWithUserOp(deviceWalletAddress, salt);
```

Takes the same `deviceWalletAddress` and `salt` as [`getCounterFactualAddress`](#getcounterfactualaddress).

Returns `Promise<Hash>`, a user operation hash.

### getCurrentESIMWalletImplementation {#getcurrentesimwalletimplementation}

Reads the eSIM wallet implementation contract every new eSIM wallet points at.

```ts
const impl = await kokio.eSIMWalletFactory!.getCurrentESIMWalletImplementation();
```

Returns `Promise<Address>`.
