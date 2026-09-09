---
title: Mobile setup
description: "Constructing the Kokio client in a React Native app: the viem wallet client, the passkey credential, the Pimlico bundler keys, and the two-step construction every contract surface depends on."
---

# Mobile setup {#mobile-setup}

`Kokio` is the [Kokio SDK](../overview.md) entry point for the mobile app. It acts for one user through their device wallet, an ERC-4337 smart account owned by a P-256 passkey held on the phone. No private key is ever in the app. Every write is a user operation signed by that passkey and submitted by a bundler.

This page gets you from an empty project to a client that can send one.

## What you need {#what-you-need}

- a viem `WalletClient` for the target chain, carrying an `account` and a real RPC URL
- the passkey `credentialId` and `rpId` registered for this device
- a Pimlico API key and a gas policy id, used by the bundler and paymaster

Passkey signing goes through [`react-native-passkey`](https://github.com/f-23/react-native-passkey) and runs only on a device or simulator that supports WebAuthn. It does not work in a plain Node process.

## Constructing the client {#constructing-the-client}

```ts
import { Kokio } from "kokio-sdk";
import { createWalletClient, http } from "viem";
import { baseSepolia } from "viem/chains";

const rpcUrl = `https://base-sepolia.g.alchemy.com/v2/${alchemyApiKey}`;

const walletClient = createWalletClient({
  account: deviceWalletAddress, // presence is checked, this client never signs
  chain: baseSepolia,
  transport: http(rpcUrl),
});

const kokio = new Kokio(
  walletClient,
  credentialId,   // passkey credential id on the device
  rpId,           // relying party id, your app domain
  pimlicoAPIKey,
  gasPolicyId,
);
```

Two details in that wallet client are easy to get wrong, and both fail later, far from the line that caused them.

**`account` has to be set.** Without it `getSmartWallet` throws "No signer account found with WalletClient". It is only a presence check. The passkey signs everything and this account is never asked for a signature. Any address the app already holds will do, including the stored device wallet address. The one call that actually spends from it is `deviceWalletFactory.createAccountWithEOA`, which a normal app never uses.

**Give `http()` a real RPC URL.** The SDK reads `client.transport.url` to build the public client it uses for contract reads and nonce lookups. Calling `http()` with no argument leaves that undefined, the reads fall back to Base Sepolia's public endpoint, and its rate limit makes wallet derivation fail intermittently.

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

Check `receipt.success`. This is the mistake worth guarding against: an operation whose calls revert is still mined and still returns a receipt, so the await resolving is not proof that anything landed. `receipt.receipt.transactionHash` is the onchain transaction, which is what a block explorer link needs.

## Switching eSIM wallet {#switching-esim-wallet}

A device wallet often holds several eSIM wallets. Point the client at a different one without resolving the passkey again.

```ts
session.setESIMWalletAddress(anotherESIMWalletAddress);
```

`setDeviceWalletAddress` and `setESIMWalletAddress` both mutate the instance and return `this`, so they chain. Both need a `smartAccountClient` already present, the same requirement as the constructor.

## Who deploys the device wallet {#who-deploys}

Normally the backend does, with `admin.deviceWalletFactory.createAccount`. See [backend setup](../backend/setup.md). The app only needs `deviceWalletFactory.createAccountWithEOA` if it holds its own funded EOA, which the wallet client above does not set up.

## Where to go next {#next}

[Buy a data bundle](./esim-wallet.md), [read protocol state](./registry.md), or [check which currencies are accepted](./payments.md). Prices are whole US cents as a `bigint` and currencies are `bytes32`, both explained on the [payments](./payments.md) page.
