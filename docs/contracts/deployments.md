---
title: Deployed contract addresses
description: Every Kokio contract address on Base Sepolia, chain 84532, with the proxy and implementation for each, the admin timelock settings, and the compiler build they were deployed from.
---

# Deployed contract addresses

Kokio is deployed on Base Sepolia and nowhere else. There is no mainnet deployment yet. Everything below is a testnet address, the balances behind it are worth nothing, and any of it can be redeployed without notice.

| | |
|---|---|
| Network | Base Sepolia |
| Chain ID | 84532 |
| Deployed | 1 September 2026, block 46246173 |
| Deployer | [`0x749e003F324cb13E59a2A102B49c78C1e1467F29`](https://sepolia.basescan.org/address/0x749e003F324cb13E59a2A102B49c78C1e1467F29) |
| ERC-4337 EntryPoint | v0.8.0 |
| Explorer | [sepolia.basescan.org](https://sepolia.basescan.org) |

## Addresses to call {#addresses-to-call}

These are the addresses an app talks to. Five of them are proxies, so the code they run lives somewhere else and can be replaced by an upgrade. Point your app at the address in this table and it keeps working across upgrades.

| Contract | Address | What it is |
|---|---|---|
| [Registry](./registry.md) | [`0x916b6b554119c789EF3026EDeB0E1Ba741b42A49`](https://sepolia.basescan.org/address/0x916b6b554119c789EF3026EDeB0E1Ba741b42A49) | proxy |
| [LazyWalletRegistry](./lazy-wallet-registry.md) | [`0x5bE46Cf216186Bc2E3C220729331D6bE7d186e84`](https://sepolia.basescan.org/address/0x5bE46Cf216186Bc2E3C220729331D6bE7d186e84) | proxy |
| [DeviceWalletFactory](./device-wallet-factory.md) | [`0x0BB3BA8D9233514a4aA6D72c243a2473f9cFf0bb`](https://sepolia.basescan.org/address/0x0BB3BA8D9233514a4aA6D72c243a2473f9cFf0bb) | proxy |
| [ESIMWalletFactory](./esim-wallet-factory.md) | [`0x57da54e07705de17c713ec311ac193e83470D5a5`](https://sepolia.basescan.org/address/0x57da54e07705de17c713ec311ac193e83470D5a5) | proxy |
| PaymentAdapter | [`0xBFaA666a8074924588E96507c307b680ecCeB2c1`](https://sepolia.basescan.org/address/0xBFaA666a8074924588E96507c307b680ecCeB2c1) | proxy |
| [P256Verifier](./p256-verifier.md) | [`0x6FA3E7E145476Dc4682734Fd845019A3872b4821`](https://sepolia.basescan.org/address/0x6FA3E7E145476Dc4682734Fd845019A3872b4821) | plain contract |
| ProtocolAdmin | [`0xdDeCC2C1345BC966337B5f4Fe57EC2D5bfad751A`](https://sepolia.basescan.org/address/0xdDeCC2C1345BC966337B5f4Fe57EC2D5bfad751A) | timelock, owns the five proxies |
| EntryPoint | [`0x4337084D9E255Ff0702461CF8895CE9E3b5Ff108`](https://sepolia.basescan.org/address/0x4337084D9E255Ff0702461CF8895CE9E3b5Ff108) | ERC-4337 v0.8.0, not ours |

## Implementations behind them {#implementations-behind-them}

You do not call these. They are listed so anyone can read the source that actually runs, and so an upgrade is visible as a change to this table.

| Contract | Implementation | Beacon |
|---|---|---|
| Registry | [`0x3aefD65516A72Eb78f2bCEBbaf78c994eeedF71e`](https://sepolia.basescan.org/address/0x3aefD65516A72Eb78f2bCEBbaf78c994eeedF71e) | |
| LazyWalletRegistry | [`0x334a233E9913AFAdef59abAC52B57160aFEEaE3C`](https://sepolia.basescan.org/address/0x334a233E9913AFAdef59abAC52B57160aFEEaE3C) | |
| DeviceWalletFactory | [`0x2b34f39e739D8606580DE1F0cF260A3a19CE0D8E`](https://sepolia.basescan.org/address/0x2b34f39e739D8606580DE1F0cF260A3a19CE0D8E) | |
| ESIMWalletFactory | [`0xc1b87aC654BEF15498693A9Cf6a6809A3b44315b`](https://sepolia.basescan.org/address/0xc1b87aC654BEF15498693A9Cf6a6809A3b44315b) | |
| PaymentAdapter | [`0x87EFa8638bF16910FF8F6a94105E329F331aA594`](https://sepolia.basescan.org/address/0x87EFa8638bF16910FF8F6a94105E329F331aA594) | |
| [DeviceWallet](./device-wallet.md) | [`0x572BF04F9Ed9b0213C127EFC0215477fa3D5CffB`](https://sepolia.basescan.org/address/0x572BF04F9Ed9b0213C127EFC0215477fa3D5CffB) | [`0x81Ac8133Ab32151460898D402E2f0dd0c6FfA30f`](https://sepolia.basescan.org/address/0x81Ac8133Ab32151460898D402E2f0dd0c6FfA30f) |
| [ESIMWallet](./esim-wallet.md) | [`0x06b8F9986fD15034364Fa8d98A9E959613400B07`](https://sepolia.basescan.org/address/0x06b8F9986fD15034364Fa8d98A9E959613400B07) | [`0xc2C09990cA54c3B0A88C9F51d540f9cf78F4D424`](https://sepolia.basescan.org/address/0xc2C09990cA54c3B0A88C9F51d540f9cf78F4D424) |

Device wallets and eSIM wallets have no single address, because there is one per device and one per eSIM. Each is a beacon proxy deployed by its factory, and all of them follow the beacon in this table, so one upgrade moves every wallet at once. To find a specific wallet, ask the [Registry](./registry.md) or ask the factory for the counterfactual address.

## Settings the contracts were deployed with {#settings-the-contracts-were-deployed-with}

| Setting | Value |
|---|---|
| Settlement token | USDC at [`0x6Ac3aB54Dc5019A2e57eCcb214337FF5bbD52897`](https://sepolia.basescan.org/address/0x6Ac3aB54Dc5019A2e57eCcb214337FF5bbD52897), 6 decimals |
| Price cap | 50000 US cents, so \$500.00 per purchase |
| Vault | [`0x9E60E1d876e0E47c410174dC4Ea7F59D5E6c6D1d`](https://sepolia.basescan.org/address/0x9E60E1d876e0E47c410174dC4Ea7F59D5E6c6D1d) |
| eSIM wallet admin | [`0x9Be9a586A2C8Ee59504805F7491B1861E541fe3a`](https://sepolia.basescan.org/address/0x9Be9a586A2C8Ee59504805F7491B1861E541fe3a) |

The PaymentAdapter accepts two assets. `USDC` is the ERC-20 above and settles onchain. `USD` has no token address and two decimals, and stands for a card or bank payment taken outside the contracts, recorded so the purchase history is complete either way.

## Who can change things {#who-can-change-things}

Every proxy is owned by ProtocolAdmin, a timelock. Nobody holds a key that upgrades a contract on the spot.

| | |
|---|---|
| Delay before a queued change can run | 172800 seconds, two days |
| Shortest delay the timelock will accept | 3600 seconds, one hour |
| Proposers | [`0x97a2103118064820180fb3acbCBedDe6E4D9fCb9`](https://sepolia.basescan.org/address/0x97a2103118064820180fb3acbCBedDe6E4D9fCb9), [`0xC85Da397D15827d4F15c9D380AdA4e4Abe99227e`](https://sepolia.basescan.org/address/0xC85Da397D15827d4F15c9D380AdA4e4Abe99227e) |
| Guardians | [`0xA71daa87b7C653843b177Ef296B8a7aB90DebE1A`](https://sepolia.basescan.org/address/0xA71daa87b7C653843b177Ef296B8a7aB90DebE1A) |
| Cancellers | none |

A proposer queues a change and it becomes executable two days later. A guardian can cancel it during those two days. This is a testnet setup with a small number of signers, so treat the two day window as the only real protection here, not the signer list.

## Build {#build}

| | |
|---|---|
| Compiler | solc 0.8.36, optimizer on, 10000000 runs, viaIR, EVM version osaka |
| Bytecode metadata hash | none |
| Source | [smart-contract-suite](https://github.com/Blockchain-Powered-eSIM/smart-contract-suite), commit `3397b6a268e43aa41ccf4ba3d82603a8efcccd5f` |
| Total deployment cost | 28084525 gas, 0.00016850715 ETH |

Every contract in both tables is verified on Basescan, so the source is readable next to the bytecode without trusting this page.

## Checking these yourself {#checking-these-yourself}

Do not take an address from a documentation page on faith, here or anywhere. Each of these can be checked in a few seconds:

```bash
# Contract has code at all
cast code 0x916b6b554119c789EF3026EDeB0E1Ba741b42A49 --rpc-url https://sepolia.base.org

# Which implementation a proxy is running, from the ERC-1967 slot
cast storage 0x916b6b554119c789EF3026EDeB0E1Ba741b42A49 \
  0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc \
  --rpc-url https://sepolia.base.org

# Which implementation a beacon points at
cast call 0x81Ac8133Ab32151460898D402E2f0dd0c6FfA30f "implementation()(address)" \
  --rpc-url https://sepolia.base.org

# Who owns a proxy
cast call 0x916b6b554119c789EF3026EDeB0E1Ba741b42A49 "owner()(address)" \
  --rpc-url https://sepolia.base.org
```

The owner call returns ProtocolAdmin. If it ever returns a plain account, the ownership transfer described above has been undone and this page is out of date.
