---
title: Kokio SDK
description: kokio-sdk is the TypeScript client for the Kokio eSIM contracts, with one entry point for the mobile app signing with a passkey and one for a backend signing with an admin key.
---

# Kokio SDK {#kokio-sdk}

The TypeScript client for the Kokio contracts: one entry point for the mobile app, one for a backend.

---

`kokio-sdk` is the TypeScript package for talking to the Kokio eSIM contracts. It wraps [viem](https://viem.sh), including viem's account abstraction module, so you do not assemble calldata or manage an ERC-4337 bundler yourself. Install it, construct one of the two entry points, and call methods.

## Install {#install}

In the mobile app, install the passkey module alongside it:

```sh title="Mobile app"
npm install kokio-sdk react-native-passkey
```

A backend that only uses `kokio-sdk/admin` needs the SDK alone:

```sh title="Backend"
npm install kokio-sdk
```

Version 3.5.1. It ships as ES modules and needs Node 18 or newer, or a React Native runtime. `viem` comes with it.

:::note
`react-native-passkey` is a peer dependency because it is a native module. Expo only links native code for packages the app lists itself, and one copy avoids version clashes. The admin entry point never loads it.
:::

## Two entry points {#two-entry-points}

The same contracts are used by two callers who have nothing in common. A phone acts for one user and holds no private key, only a passkey. A server acts for the platform and holds an ordinary key. Rather than one class with half its parameters unused, each caller gets its own.

| Entry point | Import from | Signs with | Used by |
|---|---|---|---|
| `Kokio` | `kokio-sdk` | a WebAuthn P-256 passkey, through user operations | the mobile app |
| `KokioAdmin` | `kokio-sdk/admin` | an admin or owner EOA, through ordinary transactions | the backend server |

`KokioAdmin` exists because some contract functions are restricted onchain to the admin or owner account (`onlyAdmin`, `onlyOwner`, `onlyESIMWalletAdmin`). A device wallet cannot call those at all, whatever it signs. Splitting the two makes that boundary visible in the import line.

Start at [mobile setup](./mobile/setup.md) or [backend setup](./backend/setup.md). Both pages build a working client from nothing.

## User operations, in one paragraph {#user-operations}

A smart account cannot broadcast a transaction the way an ordinary account does. The app builds a user operation, the passkey signs it, and a bundler submits it to the chain on the wallet's behalf. A paymaster can pay the gas, so a user never has to hold a cryptocurrency just to pay a fee. Every write on the `Kokio` surface works this way and resolves to a user operation hash rather than a transaction hash. Everything on `KokioAdmin` is an ordinary transaction.

## Two more subpaths {#subpaths}

- `kokio-sdk/types` re-exports the shared types, including `P256Key`, `WebAuthnSignature`, `DataBundleDetails`, `KokioSmartAccountClient` and `OwnerCall`, so you can type your own code without importing from internal paths.
- `kokio-sdk/abis` re-exports the typed contract ABIs, including `DeviceWallet`, `ESIMWallet`, `Registry` and `ProtocolAdmin`. Useful for decoding logs or calling a contract directly with viem.

## Errors {#errors}

Both entry points export the same error types, so an onchain revert can be caught and read without reaching into module internals.

```ts
import { KokioError, ContractRevertError } from "kokio-sdk"; // or "kokio-sdk/admin"

try {
  await admin.registry.requestAdminUpdate(newAdmin);
} catch (err) {
  if (err instanceof ContractRevertError) {
    console.error("reverted:", err.decoded?.errorName); // e.g. "OwnableUnauthorizedAccount"
  }
}
```

A write the contract would refuse throws `ContractRevertError` before anything is sent, on both entry points. For a user operation the SDK reads the reason out of the bundler's simulation error, so the contract's own error name reaches the app instead of a generic bundler message.

:::note
`decoded` is `null` only when the revert data matches no Kokio contract's errors.
:::

`KokioError` is the base class. Its named subclasses:

| Error | Thrown when |
|---|---|
| `MissingSmartWalletError`, `MissingEOAWalletError`, `InvalidClientError`, `UnsupportedChainError`, `UnconfiguredChainError`, `CounterfactualMismatchError`, `ContractRevertError` | Any call on either entry point |
| `BatchSizeOutOfRangeError`, `DepositOnResumeError`, `ESIMWalletNotLazyDeployedError`, `MissingBatchEventError`, `StalledBatchError` | The paginated `lazyWalletRegistry` calls |
| `NullOrUndefinedValueError` | A required argument was left out |

`decodeContractRevert` turns raw revert data into a readable reason.

`kokio-sdk/admin` exports a few more, all thrown before anything is sent:

- `AdminAllowanceExceededError`, when an [admin purchase](./backend/esim-wallet.md#buydatabundlewithtoken) costs more than the wallet's admin allowance has left.
- `InvalidPaymentReferenceError` and `CouponSplitOutOfRangeError`, from [payment reference tags](./backend/utils.md#payment-references) and the [coupon split](./backend/registry.md#coupon-split).
- `InvalidAddressError`, `InvalidSymbolError`, `TokenNotAcceptedError`, `NotAProtocolESIMWalletError`, `UnknownTransactionError`, `TransactionRevertedError`, `ReceiptNotCanonicalError`, `UnmatchedPaymentEventsError`, `NotAnERC20TokenError` and `PriceOutOfRangeError`, from the [payment checks](./backend/utils.md).

## Chains {#chains}

Both entry points expose an async `constants` getter holding the resolved factory addresses, chain, RPC URL and custom error selectors for whichever chain the wallet client is connected to.

```ts
const { factoryAddresses, chain, rpcURL } = await kokio.constants;
```

The first read resolves them and every later one is served from that result, so reading `constants` repeatedly costs nothing.

You never pass contract addresses in. The SDK resolves them from the wallet client's chain id.

| Chain | Chain id |
|---|---|
| [Base mainnet](../deployments/base.md) | 8453 |
| [Base Sepolia](../deployments/base-sepolia.md) | 84532 |

:::warning
Any other chain id throws `UnsupportedChainError`.
:::

## Reference {#reference}

Every method, with an example and a return type.

| Surface | Pages |
|---|---|
| Mobile, `Kokio` | [Setup](./mobile/setup.md), [smart account](./mobile/smart-account.md), [device wallet](./mobile/device-wallet.md), [device wallet factory](./mobile/device-wallet-factory.md), [eSIM wallet](./mobile/esim-wallet.md), [registry](./mobile/registry.md), [payments](./mobile/payments.md) |
| Backend, `KokioAdmin` | [Setup](./backend/setup.md), [device wallet](./backend/device-wallet.md), [device wallet factory](./backend/device-wallet-factory.md), [eSIM wallet](./backend/esim-wallet.md), [registry](./backend/registry.md), [lazy wallet registry](./backend/lazy-wallet-registry.md), [payments](./backend/payments.md), [protocol admin](./backend/protocol-admin.md), [calls](./backend/calls.md), [utils](./backend/utils.md) |

The contracts these methods reach are documented separately, starting at the [wallet suite overview](../contracts/overview.md).

Source and issues: [github.com/Blockchain-Powered-eSIM/kokio-sdk](https://github.com/Blockchain-Powered-eSIM/kokio-sdk). MIT licensed.
