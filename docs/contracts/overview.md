---
title: Wallet suite overview
description: The eighteen contracts behind Kokio, what each one does, which proxy pattern it uses, and the terms you need to read the rest of the reference.
---

# The Kokio wallet suite {#the-kokio-wallet-suite}

Kokio's onchain half is a suite of eighteen Solidity units that deploy and manage eSIM data. A user buys a data bundle, the purchase is recorded onchain, and the wallet holding that record is theirs rather than the operator's. The same wallet works as an everyday hot wallet, so the eSIM and the money that pays for it live in one place.

Two ideas hold the design together. Every user gets a wallet per phone and a wallet per eSIM, so an eSIM can be moved between devices without moving anything else. And the wallets are ERC-4337 smart accounts owned by a passkey in the phone's secure enclave, so there is no seed phrase to write down and nothing for Kokio to hold on the user's behalf.

The whole suite is deployed on Base Sepolia and nowhere else. Addresses are on the [deployed addresses](./deployments.md) page.

![Architecture of the Kokio smart contract suite: the Registry at the centre, with the device wallet factory and eSIM wallet factory deploying beacon-proxy wallets beneath it, and the lazy wallet registry and payment adapter beside it.](../../resources/KokioSCWithBG.png)

## What each contract does {#what-each-contract-does}

| Contract | What it does | Pattern |
|---|---|---|
| [Registry](./registry.md) | The central record. Holds the admin address, the vault, the pause flag and the price ceiling, and tracks which wallets are real | UUPS proxy |
| `RegistryHelper` | Storage and the lazy deployment paths `Registry` inherits. Not deployed on its own | Part of `Registry` |
| [LazyWalletRegistry](./lazy-wallet-registry.md) | Holds what a fiat user bought before they had a wallet, then deploys the wallets and copies the record across | UUPS proxy |
| [DeviceWalletFactory](./device-wallet-factory.md) | Deploys device wallets at addresses you can compute in advance, and owns the beacon they all follow | UUPS proxy |
| [DeviceWallet](./device-wallet.md) | One per phone. Owns that phone's eSIM wallets, funds them, and decides which may spend its money | Beacon proxy |
| [ESIMWalletFactory](./esim-wallet-factory.md) | Deploys eSIM wallets and owns the beacon they all follow | UUPS proxy |
| [ESIMWallet](./esim-wallet.md) | One per eSIM. Buys data bundles and keeps the purchase history | Beacon proxy |
| [PaymentAdapter](./payment-adapter.md) | Holds the accepted currencies, turns a price in US cents into a token amount, and pays the vault | UUPS proxy |
| [ProtocolAdmin](./protocol-admin.md) | The timelock that owns the four singletons above. Every change it makes waits out a delay | Not upgradeable |
| [Account4337](./account-4337.md) | The ERC-4337 and ERC-1271 base that `DeviceWallet` inherits. Validates user operations against a P-256 key | Base contract |
| [P256Verifier](./p256-verifier.md) | The one address every account verifies passkey signatures through | Plain contract |
| [WebAuthn](./webauthn.md) | Checks a WebAuthn assertion. Tries the RIP-7212 precompile, falls back to FreshCryptoLib | Library |
| [Errors](./errors.md) | Every custom error the protocol reverts with, in one place | Interface |
| [CustomStructs](./types.md) | The shared structs and the `Settlement` enum | Types |
| [IPausable, IOwnable2Step, IRegistryAdmin, IPaymentRegistry](./interfaces.md) | Narrow views of a larger contract, so the compiler checks a signature that is called across a boundary | Interfaces |

The two beacons the factories own are OpenZeppelin's [`UpgradeableBeacon`](https://docs.openzeppelin.com/contracts/5.x/api/proxy#UpgradeableBeacon), used unchanged. They are not Kokio contracts and are not documented here.

## How a purchase runs through it {#how-a-purchase-runs-through-it}

1. The app registers a passkey and asks [`DeviceWalletFactory`](./device-wallet-factory.md) for the wallet address that key will own. The address is known before anything is deployed, so the app can show it immediately.
2. Deploying the device wallet also deploys its first [eSIM wallet](./esim-wallet.md) and writes both into the [Registry](./registry.md), in one transaction.
3. To buy a data bundle, the eSIM wallet asks [`PaymentAdapter`](./payment-adapter.md) what the price in US cents comes to in the currency being paid, sends that amount, and the adapter pays the vault and refunds the difference.
4. The purchase is written into the eSIM wallet's own history, so the record belongs to the user rather than to a provider's database.

A user who pays by card has no wallet at the moment of purchase. That path runs through the [LazyWalletRegistry](./lazy-wallet-registry.md) instead, which holds the history against a device identifier until wallets are deployed and the record is copied onto them.

## Smart contract wallets, and what self-custodial means here {#self-custodial}

A smart contract wallet for an eSIM keeps activation, profile switching and payment under rules written in code rather than in a provider's terms of service. Transferring an eSIM, changing a plan or paying for data are all calls anyone can read and nobody can quietly reinterpret.

Self-custodial means the key that authorises those calls is on the user's device and nowhere else. Kokio cannot sign for a user, cannot move their funds and cannot take an eSIM back. What Kokio's admin key can do is narrow and worth naming plainly: it can charge an eSIM wallet for a data bundle up to a ceiling the user sets, and it can record a purchase made outside the contracts. It cannot raise that ceiling. Every upgrade and every change of the admin key itself runs through the [ProtocolAdmin](./protocol-admin.md) timelock, which means an announcement and a two day wait before anything moves.

## Terms used in this reference {#terms}

Kokio's product glossary is at [kokio.app/glossary](https://kokio.app/glossary). These are the terms specific to this suite:

- **Beacon proxy.** Many wallets, one shared pointer to the code they run. Upgrading the beacon moves every wallet at once, and there is no per-wallet opt-out. Both wallet types work this way, which is what makes an upgrade a governance question rather than a deployment detail.
- **UUPS proxy.** A single contract whose upgrade logic lives in the implementation rather than in the proxy. The four singletons use it, and `ProtocolAdmin` owns them all.
- **CREATE2.** Deploying to an address computed from the deployer, a salt and the code, rather than from a transaction counter. It is why a device wallet's address is known before it exists.
- **RIP-7212.** A precompile that verifies a P-256 signature natively. Base ships it, which is what makes passkey signatures cheap enough to use on every transaction.
- **ERC-1271.** The standard way a contract says "yes, that signature is valid for me", so a smart account can sign messages the way a plain account does.
- **FreshCryptoLib.** A Solidity implementation of P-256 verification, used as the fallback when the precompile is missing or rejects the call.
