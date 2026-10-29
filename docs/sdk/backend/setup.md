---
title: Backend setup
description: "Constructing KokioAdmin on a server: an EOA wallet client, no bundler and no passkey, plus the trust boundary that comes with holding a key that can act for users."
---

# Backend setup {#backend-setup}

Learn how to build a `KokioAdmin` client on a server, and what the admin key it holds can do.

---

`KokioAdmin` is the [Kokio SDK](../overview.md) entry point for a backend server. It exposes the contract functions that are restricted onchain to the admin or owner account, the ones marked `onlyAdmin`, `onlyOwner` or `onlyESIMWalletAdmin`. A device wallet cannot call those at all, whatever it signs, which is why they live on a separate class.

Every write here is an ordinary transaction from the admin EOA and resolves to a transaction hash. No bundler, no paymaster, no passkey.

## The trust boundary {#trust-boundary}

Read this before wiring the key in. The admin key:

- Deploys wallets on users' behalf
- Records purchases that were paid for outside the protocol
- Buys data bundles for users, within each eSIM wallet's price cap and admin allowance

`recordSettledPurchase` in particular writes a purchase into a user's history on the backend's word alone, because a card payment leaves no onchain proof. Nothing in the contracts distinguishes a correct record from an invented one.

Ownership of the protocol contracts is separate and sits behind the [ProtocolAdmin timelock](./protocol-admin.md), which the admin key cannot bypass.

## Constructing the client {#constructing-the-client}

First, install the SDK.

```sh
npm install kokio-sdk
```

Then, construct `KokioAdmin` with a viem wallet client that carries the admin account.

```ts title="KokioAdmin"
import { KokioAdmin } from "kokio-sdk/admin";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";

const account = privateKeyToAccount(process.env.ADMIN_PRIVATE_KEY as `0x${string}`);
const walletClient = createWalletClient({
  account,
  chain: baseSepolia,
  transport: http(process.env.RPC_URL),
});

const admin = new KokioAdmin(walletClient);
```

:::warning
Give `http()` a real RPC URL. The SDK reads it to build the public client it uses for reads.
:::

The example targets Base Sepolia. For Base mainnet, import `base` from `viem/chains` and point `RPC_URL` at a mainnet node. The SDK picks the contract addresses from the chain id, so nothing else changes.

Writes sign locally with the key and go out as raw transactions, so any hosted RPC works and never sees the key. A connected wallet account works too.

## Which surfaces are ready when {#surfaces}

| Surface | Ready |
|---|---|
| `deviceWalletFactory`, `eSIMWalletFactory`, `registry`, `lazyWalletRegistry`, `paymentAdapter`, `protocolAdmin` | As soon as the instance exists, because they are chain-wide |
| [`calls`](./calls.md), [`utils`](./utils.md) | As soon as the instance exists, because they take every address as an argument |
| `deviceWallet`, `eSIMWallet` | Once bound to an address. `undefined` until then |

```ts
admin.setDeviceWalletAddress(deviceWalletAddress);
admin.setESIMWalletAddress(eSIMWalletAddress);
```

This matters more on a backend than on a phone, because the backend usually deploys a wallet and then needs to act on it in the same request. Both setters mutate the instance and return `this`, so they chain. `admin.setWalletClient(newWalletClient)` swaps the signing key the same way, for a rotation or a failover, and keeps every bound address.

## Provisioning a user {#provisioning}

The order is fixed:

1. A device wallet
2. An eSIM wallet under it
3. The eSIM's identifier

```ts title="Device wallet, then eSIM wallet"
const deployHash = await admin.deviceWalletFactory.createAccount(
  deviceUniqueIdentifier,
  ownerKey,
  salt,
  depositAmount,
);

admin.setDeviceWalletAddress(deviceWalletAddress);
await admin.deviceWallet!.deployESIMWallet(salt);
```

See [device wallet factory](./device-wallet-factory.md) for the checks to run before deploying, and [lazy wallet registry](./lazy-wallet-registry.md) for users who bought an eSIM before they had a wallet at all.

## Buying for a user {#buying}

```ts
admin.setESIMWalletAddress(eSIMWalletAddress);
const maxAmountIn = await admin.paymentAdapter.quote(asset, priceUSDCents);
await admin.eSIMWallet!.buyDataBundleWithToken(
  { id: bundleId, priceUSDCents, settlement: 0 }, // 0 = the device wallet pays
  asset,
  maxAmountIn,
  paymentReference,
);
```

Prices are whole US cents as a `bigint`, and a currency is named by a `bytes32`. Both encodings are explained on the [payments](./payments.md) page.

## Payment references {#payment-references}

`paymentReference` is a `bytes32` order id the backend mints. The SDK never invents one. Anything unique per purchase works, for example `keccak256(toBytes(internalOrderId))`. It is spendable once per eSIM wallet.

```ts title="Check whether a reference is spent"
const used = await admin.registry.usedPaymentReferences(
  keccak256(encodeAbiParameters(
    [{ type: "address" }, { type: "bytes32" }],
    [eSIMWalletAddress, paymentReference],
  )),
);
```

:::warning
Mint the reference and store it against the order before calling `buyDataBundleWithToken` or `recordSettledPurchase`. A retry after a dropped transaction then reuses the same reference instead of recording the purchase twice.
:::

## Governance {#governance}

`admin.protocolAdmin` wraps the timelock that owns the five upgradeable contracts onchain: the registry, the lazy wallet registry, both factories and the payment adapter. It schedules, executes and cancels privileged calls behind a delay, split across four role-scoped surfaces:

| Surface | Does |
|---|---|
| `proposer` | Schedules a call |
| `executor` | Runs one once its delay has passed |
| `canceller` | Cancels a pending one |
| `guardian` | Skips the delay for emergency actions, such as unpausing or disabling a compromised admin |

See [protocol admin](./protocol-admin.md).

## Where to go next {#next}

- [Device wallet](./device-wallet.md) and [device wallet factory](./device-wallet-factory.md)
- [eSIM wallet](./esim-wallet.md)
- [Registry](./registry.md) and [lazy wallet registry](./lazy-wallet-registry.md)
- [Payments](./payments.md)
- [Protocol admin](./protocol-admin.md)
