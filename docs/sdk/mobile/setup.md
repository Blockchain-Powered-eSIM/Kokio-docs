---
title: Mobile setup
description: "Constructing the Kokio client in a React Native app: the viem wallet client, the passkey credential, the Pimlico bundler keys, and the two-step construction every contract surface depends on."
---

# Mobile setup {#mobile-setup}

`Kokio` is the [Kokio SDK](../overview.md) entry point for the mobile app. It acts for one user through their device wallet, an ERC-4337 smart account owned by a P-256 passkey held on the phone. No private key is ever in the app. Every write is a user operation signed by that passkey and submitted by a bundler.

This page gets you from an empty project to a client that can send one.

## What you need {#what-you-need}

- a viem `WalletClient` for the target chain, with a real RPC URL
- the passkey `credentialId` and `rpId` registered for this device
- a Pimlico API key, used by the bundler and paymaster, and optionally a Pimlico sponsorship policy id

Passkey signing goes through [`react-native-passkey`](https://github.com/f-23/react-native-passkey), which the app installs itself (`npm install kokio-sdk react-native-passkey`). It runs only on a device or simulator that supports WebAuthn, not in a plain Node process.

## Constructing the client {#constructing-the-client}

```ts
import { Kokio } from "kokio-sdk";
import { createWalletClient, http } from "viem";
import { baseSepolia } from "viem/chains";

const rpcUrl = `https://base-sepolia.g.alchemy.com/v2/${alchemyApiKey}`;

const walletClient = createWalletClient({
  chain: baseSepolia,
  transport: http(rpcUrl),
});

const kokio = new Kokio(
  walletClient,
  credentialId,   // passkey credential id on the device
  rpId,           // relying party id, your app domain
  pimlicoAPIKey,
  gasPolicyId,    // Pimlico sponsorship policy id, or "" for none
);
```

The wallet client needs no `account`. The passkey signs everything. The one call that needs an account on it is `deviceWalletFactory.createAccountWithEOA`, which a normal app never uses.

**Give `http()` a real RPC URL.** This is easy to get wrong, and it fails later, far from the line that caused it. The SDK reads `client.transport.url` to build the public client it uses for contract reads and nonce lookups. Calling `http()` with no argument leaves that undefined, the reads fall back to Base Sepolia's public endpoint, and its rate limit makes wallet derivation fail intermittently.

## The second construction {#the-second-construction}

`kokio.smartAccount` works right away. Every contract surface needs a `smartAccountClient`, which needs an account, which needs the passkey resolved first. So the client is built in two passes.

```ts
// 1. Resolve the device's smart account from its passkey.
const account = await kokio.smartAccount.getSmartWallet(deviceUniqueIdentifier, ownerKey, salt);

// 2. Build the bundler-backed client that signs with the passkey.
const smartAccountClient = await kokio.smartAccount.getSmartWalletClient(account);

// 3. Re-create Kokio with the client, and any addresses you already know.
const session = new Kokio(
  walletClient, credentialId, rpId, pimlicoAPIKey, gasPolicyId,
  smartAccountClient, deviceWalletAddress, eSIMWalletAddress,
);
```

Do this once per app session, straight after login. See [smart account](./smart-account.md) for what those two calls return.

The contract surfaces are `deviceWallet`, `eSIMWallet`, `deviceWalletFactory`, `eSIMWalletFactory`, `registry`, `paymentAdapter` and `P256Verifier`. All of them stay `undefined` until a `smartAccountClient` is supplied. The two instance surfaces, `deviceWallet` and `eSIMWallet`, also need their contract address, so they stay `undefined` until you pass one.

## Sending a write {#sending-a-write}

```ts
const hash = await session.deviceWallet!.toggleAccessToFunds(eSIMWalletAddress, true);
const receipt = await smartAccountClient.waitForUserOperationReceipt({ hash });
if (!receipt.success) throw new Error("operation reverted");
```

A write the contract would refuse throws `ContractRevertError` before it is sent, with the contract's error name in `err.decoded?.errorName`. Still check `receipt.success`: if the chain changes between that check and inclusion, the operation can revert onchain, and it is then mined and still returns a receipt, so the await resolving is not proof that anything landed. `receipt.receipt.transactionHash` is the onchain transaction, which is what a block explorer link needs.

## Switching eSIM wallet {#switching-esim-wallet}

A device wallet often holds several eSIM wallets. Point the client at a different one without resolving the passkey again.

```ts
session.setESIMWalletAddress(anotherESIMWalletAddress);
```

`setDeviceWalletAddress` and `setESIMWalletAddress` both mutate the instance and return `this`, so they chain. Both need a `smartAccountClient` already present, the same requirement as the constructor.

## Who deploys the device wallet {#who-deploys}

Either side can. The backend can deploy it with `admin.deviceWalletFactory.createAccount`, see [backend setup](../backend/setup.md). Or the app deploys it with its first sponsored user operation, since the smart account carries its own deployment:

```ts
await session.deviceWallet!.sendUserOperation([]); // an empty operation that only deploys the wallet
```

A wallet deployed that way is not registered yet, so it cannot deploy eSIM wallets. The backend registers it with [`admin.deviceWalletFactory.postCreateAccount`](../backend/device-wallet-factory.md#postcreateaccount).

The app only needs `deviceWalletFactory.createAccountWithEOA` if it holds its own funded EOA, which the wallet client above does not set up.

## Where to go next {#next}

[Buy a data bundle](./esim-wallet.md), [read protocol state](./registry.md), or [check which currencies are accepted](./payments.md). Prices are whole US cents as a `bigint` and currencies are `bytes32`, both explained on the [payments](./payments.md) page.
