---
title: Kokio SDK
description: kokio-sdk is the TypeScript client for the Kokio eSIM contracts, with one entry point for the mobile app signing with a passkey and one for a backend signing with an admin key.
---

# Kokio SDK {#kokio-sdk}

`kokio-sdk` is the TypeScript package for talking to the Kokio eSIM contracts. It wraps [viem](https://viem.sh), including viem's account abstraction module, so you do not assemble calldata or manage an ERC-4337 bundler yourself. Install it, construct one of the two entry points, and call methods.

```sh
npm install kokio-sdk
```

Version 3.0.1. It ships as ES modules and needs Node 18 or newer, or a React Native runtime. `viem` comes with it, so there is nothing else to install.

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
    console.error("reverted:", err.message);
  }
}
```

`KokioError` is the base class. The named subclasses are `MissingSmartWalletError`, `MissingEOAWalletError`, `InvalidClientError`, `UnsupportedChainError`, `CounterfactualMismatchError` and `ContractRevertError`. `decodeContractRevert` turns raw revert data into a readable reason.

Some errors are not exported by name. The paginated `lazyWalletRegistry` calls can throw narrower subclasses such as `BatchSizeOutOfRangeError`. Catch those with `instanceof KokioError` and read `.code` rather than importing the class.

## Chains {#chains}

Both entry points expose an async `constants` getter holding the resolved factory addresses, chain, RPC URL and custom error selectors for whichever chain the wallet client is connected to.

```ts
const { factoryAddresses, chain, rpcURL } = await kokio.constants;
```

The first read resolves them and every later one is served from that result, so reading `constants` repeatedly costs nothing.

You never pass contract addresses in. The SDK resolves them from the wallet client's chain id. Base Sepolia, chain id 84532, is the only chain with a live deployment, and its addresses are listed on the [deployed addresses](../contracts/deployments.md) page. Ethereum, Optimism and Arbitrum, mainnet and testnets, are wired into the chain resolution but not deployed. Connecting to one of them throws `UnconfiguredChainError`.

## Reference {#reference}

Every method, with an example and a return type.

**Mobile, the `Kokio` surface.** [Setup](./mobile/setup.md), [smart account](./mobile/smart-account.md), [device wallet](./mobile/device-wallet.md), [device wallet factory](./mobile/device-wallet-factory.md), [eSIM wallet](./mobile/esim-wallet.md), [registry](./mobile/registry.md), [payments](./mobile/payments.md).

**Backend, the `KokioAdmin` surface.** [Setup](./backend/setup.md), [device wallet](./backend/device-wallet.md), [device wallet factory](./backend/device-wallet-factory.md), [eSIM wallet](./backend/esim-wallet.md), [registry](./backend/registry.md), [lazy wallet registry](./backend/lazy-wallet-registry.md), [payments](./backend/payments.md), [protocol admin](./backend/protocol-admin.md).

The contracts these methods reach are documented separately, starting at the [wallet suite overview](../contracts/overview.md).

Source and issues: [github.com/Blockchain-Powered-eSIM/kokio-sdk](https://github.com/Blockchain-Powered-eSIM/kokio-sdk). MIT licensed.
