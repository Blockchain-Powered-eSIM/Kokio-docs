---
title: Resources
description: "Where the rest of Kokio is written down: the contract and SDK repositories, and the wikis covering eSIM provisioning, key management and the problems with the standard model."
---

# Resources {#resources}

Kokio's documentation is split between this site and a handful of repositories and wikis. This site is the maintained surface, and the pages here are generated from or checked against the source repositories. The links below are those sources, worth opening when you want the code itself or the longer background rather than the summary.

## Source code {#source-code}

| Repository | What is in it |
|---|---|
| [smart-contract-suite](https://github.com/Blockchain-Powered-eSIM/smart-contract-suite) | The Solidity contracts, their tests and the deployment scripts. The reference on every page under [smart contracts](./contracts/overview.md) is generated from this repository |
| [kokio-sdk](https://github.com/Blockchain-Powered-eSIM/kokio-sdk) | The TypeScript client the mobile app and the backend use to reach those contracts. Documented under [SDK](./sdk/overview.md) |
| [Kokio-docs](https://github.com/Blockchain-Powered-eSIM/Kokio-docs) | This site |

## Background reading {#background-reading}

Written before the current contracts existed, and still the fullest write-up of the problem Kokio is answering.

| Page | What it covers |
|---|---|
| [Problems with eSIMs](https://github.com/Blockchain-Powered-eSIM/Kokio-docs/wiki/Problems-With-eSIMs) | The provisioning and privacy weaknesses in the standard eSIM model, at length. Summarised on [the problem with eSIMs](./esim/problem.md) |
| [eSIM and key integration point](https://github.com/Blockchain-Powered-eSIM/eSIM-Wallet/wiki/eSIM-and-Key-Integration-Point) | How eSIM technology works end to end, and where cryptographic keys enter it. The background behind [how eSIM provisioning works](./esim/working.md) |
| [Remote SIM provisioning](https://github.com/Blockchain-Powered-eSIM/eSIM-Wallet/wiki/Remote-SIM-Provisioning) | The RSP half of the stack in detail: the SM-DP+, the LPA, and the life of a profile |
| [Key management](https://github.com/Blockchain-Powered-eSIM/eSIM-Wallet/wiki/Key-Management) | How keys are held and used in an eSIM wallet |
| [eSIM Wallet mobile app](https://github.com/Blockchain-Powered-eSIM/eSIM-Wallet/wiki) | The mobile app wiki, including the testing approach for the MVP |
