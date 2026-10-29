---
title: Base Sepolia
description: The Kokio contract addresses on the Base Sepolia testnet, chain 84532, with the currencies they accept and the limits they were configured with.
---

# Base Sepolia {#base-sepolia}

The Kokio testnet. Balances here are worth nothing, and anything on this page can be redeployed without notice. The live deployment is on the [Base mainnet](./base.md) page.

| | |
|---|---|
| Chain ID | 84532 |
| Explorer | [sepolia.basescan.org](https://sepolia.basescan.org) |
| RPC | `https://sepolia.base.org` |
| ERC-4337 EntryPoint | v0.8.0, [`0x4337084D9E255Ff0702461CF8895CE9E3b5Ff108`](https://sepolia.basescan.org/address/0x4337084D9E255Ff0702461CF8895CE9E3b5Ff108) |

## Contracts {#contracts}

Point an app at these. The proxies keep their address when the code behind them is upgraded.

| Contract | Address |
|---|---|
| [Registry](../contracts/registry.md) | [`0x916b6b554119c789EF3026EDeB0E1Ba741b42A49`](https://sepolia.basescan.org/address/0x916b6b554119c789EF3026EDeB0E1Ba741b42A49) |
| [LazyWalletRegistry](../contracts/lazy-wallet-registry.md) | [`0x5bE46Cf216186Bc2E3C220729331D6bE7d186e84`](https://sepolia.basescan.org/address/0x5bE46Cf216186Bc2E3C220729331D6bE7d186e84) |
| [DeviceWalletFactory](../contracts/device-wallet-factory.md) | [`0x0BB3BA8D9233514a4aA6D72c243a2473f9cFf0bb`](https://sepolia.basescan.org/address/0x0BB3BA8D9233514a4aA6D72c243a2473f9cFf0bb) |
| [ESIMWalletFactory](../contracts/esim-wallet-factory.md) | [`0x57da54e07705de17c713ec311ac193e83470D5a5`](https://sepolia.basescan.org/address/0x57da54e07705de17c713ec311ac193e83470D5a5) |
| [PaymentAdapter](../contracts/payment-adapter.md) | [`0xBFaA666a8074924588E96507c307b680ecCeB2c1`](https://sepolia.basescan.org/address/0xBFaA666a8074924588E96507c307b680ecCeB2c1) |
| [P256Verifier](../contracts/p256-verifier.md) | [`0x6FA3E7E145476Dc4682734Fd845019A3872b4821`](https://sepolia.basescan.org/address/0x6FA3E7E145476Dc4682734Fd845019A3872b4821) |
| [ProtocolAdmin](../contracts/protocol-admin.md) | [`0xdBC411D2fEc7758B32885DbF0B4AE957c3b918Fe`](https://sepolia.basescan.org/address/0xdBC411D2fEc7758B32885DbF0B4AE957c3b918Fe) |

Device and eSIM wallets have one address per device and per eSIM, so none is listed here. Every wallet of a kind follows one beacon, and the beacon says which code they all run:

| Beacon | Address |
|---|---|
| [DeviceWallet](../contracts/device-wallet.md) | [`0x81Ac8133Ab32151460898D402E2f0dd0c6FfA30f`](https://sepolia.basescan.org/address/0x81Ac8133Ab32151460898D402E2f0dd0c6FfA30f) |
| [ESIMWallet](../contracts/esim-wallet.md) | [`0xc2C09990cA54c3B0A88C9F51d540f9cf78F4D424`](https://sepolia.basescan.org/address/0xc2C09990cA54c3B0A88C9F51d540f9cf78F4D424) |

## Currencies {#currencies}

| Symbol | Token | Decimals |
|---|---|---|
| `USDC` | [`0x036CbD53842c5426634e7929541eC2318f3dCF7e`](https://sepolia.basescan.org/address/0x036CbD53842c5426634e7929541eC2318f3dCF7e), Circle's testnet USDC | 6 |
| `USD` | none, a card or bank payment taken outside the contracts | 2 |

## Limits {#limits}

| | |
|---|---|
| Price cap a new eSIM wallet starts with | 50000 US cents, \$500.00 per purchase |
| Admin allowance a new eSIM wallet starts with | 10000 US cents, \$100.00 in total |
| Delay on every owner change | 2 days, floor 1 day |

A user can lower their own wallet's price cap and set their own admin allowance. Every proxy and both beacons are owned, directly or through a factory, by ProtocolAdmin, so an upgrade or a settings change waits out the delay.

## Checking an address {#checking-an-address}

```bash
# The contract exists
cast code 0x916b6b554119c789EF3026EDeB0E1Ba741b42A49 --rpc-url https://sepolia.base.org

# Its owner is ProtocolAdmin
cast call 0x916b6b554119c789EF3026EDeB0E1Ba741b42A49 "owner()(address)" --rpc-url https://sepolia.base.org
```

If `owner()` returns anything other than `0xdBC411D2fEc7758B32885DbF0B4AE957c3b918Fe`, this page is out of date.
