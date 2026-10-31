---
title: Base mainnet
description: The Kokio contract addresses on Base mainnet, chain 8453, with the currencies they accept and the limits they were configured with.
---

# Base mainnet {#base-mainnet}

Kokio contract addresses, currencies and limits on Base mainnet.

---

The live Kokio deployment. The testnet is on the [Base Sepolia](./base-sepolia.md) page.

:::warning
Real funds move through these addresses.
:::

| | |
|---|---|
| Chain ID | 8453 |
| Explorer | [basescan.org](https://basescan.org) |
| RPC | `https://mainnet.base.org` |
| ERC-4337 EntryPoint | v0.8.0, [`0x4337084D9E255Ff0702461CF8895CE9E3b5Ff108`](https://basescan.org/address/0x4337084D9E255Ff0702461CF8895CE9E3b5Ff108) |

## Contracts {#contracts}

Point an app at these. The proxies keep their address when the code behind them is upgraded.

| Contract | Address |
|---|---|
| [Registry](../contracts/registry.md) | [`0x76fB7F8C97457A5a6dF19a7041a66a7f1b3c910c`](https://basescan.org/address/0x76fB7F8C97457A5a6dF19a7041a66a7f1b3c910c) |
| [LazyWalletRegistry](../contracts/lazy-wallet-registry.md) | [`0x2046aE906FB940Ad99147f233711Bb6711A2Ab0C`](https://basescan.org/address/0x2046aE906FB940Ad99147f233711Bb6711A2Ab0C) |
| [DeviceWalletFactory](../contracts/device-wallet-factory.md) | [`0xAC6B6A9F905e2593d587D244cEee6a0886952a6D`](https://basescan.org/address/0xAC6B6A9F905e2593d587D244cEee6a0886952a6D) |
| [ESIMWalletFactory](../contracts/esim-wallet-factory.md) | [`0xC88723826B9070ea89d9040387DE4C22A490EdB6`](https://basescan.org/address/0xC88723826B9070ea89d9040387DE4C22A490EdB6) |
| [PaymentAdapter](../contracts/payment-adapter.md) | [`0xbb80B10BECB997b02a4BA4068C145Ef18129943d`](https://basescan.org/address/0xbb80B10BECB997b02a4BA4068C145Ef18129943d) |
| [P256Verifier](../contracts/p256-verifier.md) | [`0x4E2C5B9B88184464162d581D6BF36615f0040fE6`](https://basescan.org/address/0x4E2C5B9B88184464162d581D6BF36615f0040fE6) |
| [ProtocolAdmin](../contracts/protocol-admin.md) | [`0x0E664e956aAD2599D17dE2381cc22687a066778B`](https://basescan.org/address/0x0E664e956aAD2599D17dE2381cc22687a066778B) |

Device and eSIM wallets have one address per device and per eSIM, so none is listed here. Every wallet of a kind follows one beacon, and the beacon says which code they all run:

| Beacon | Address |
|---|---|
| [DeviceWallet](../contracts/device-wallet.md) | [`0x3c3B431C0e3289DDEAc1F20Eb49e11bE5a0daFcA`](https://basescan.org/address/0x3c3B431C0e3289DDEAc1F20Eb49e11bE5a0daFcA) |
| [ESIMWallet](../contracts/esim-wallet.md) | [`0x7C5F070927032BEfEda6f375da2ad97C3eaf2bd9`](https://basescan.org/address/0x7C5F070927032BEfEda6f375da2ad97C3eaf2bd9) |

## Currencies {#currencies}

| Symbol | Token | Decimals |
|---|---|---|
| `USDC` | [`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`](https://basescan.org/address/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913) | 6 |
| `USDT` | [`0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2`](https://basescan.org/address/0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2) | 6 |
| `DAI` | [`0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb`](https://basescan.org/address/0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb) | 18 |
| `USD` | none, a card or bank payment taken outside the contracts | 2 |

## Limits {#limits}

| | |
|---|---|
| Price cap a new eSIM wallet starts with | 25000 US cents, \$250.00 per purchase |
| Admin allowance a new eSIM wallet starts with | 0. The admin cannot charge a new eSIM wallet until its owner sets an allowance |
| Delay on every owner change | 2 days, floor 1 day |

A user can set their own wallet's price cap and admin allowance. Every proxy and both beacons are owned, directly or through a factory, by ProtocolAdmin, so an upgrade or a settings change waits out the delay.

## Checking an address {#checking-an-address}

```bash
# The contract exists
cast code 0x76fB7F8C97457A5a6dF19a7041a66a7f1b3c910c --rpc-url https://mainnet.base.org

# Its owner is ProtocolAdmin
cast call 0x76fB7F8C97457A5a6dF19a7041a66a7f1b3c910c "owner()(address)" --rpc-url https://mainnet.base.org
```

:::warning
If `owner()` returns anything other than `0x0E664e956aAD2599D17dE2381cc22687a066778B`, this page is out of date.
:::
