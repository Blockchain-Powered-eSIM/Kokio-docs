---
title: ESIMWalletFactory
description: Deploys Kokio eSIM wallets, owns the beacon they all follow, and is the reason a wallet deployed outside the suite is never treated as valid.
---

# eSIM wallet factory {#esim-wallet-factory}

`ESIMWalletFactory` deploys [eSIM wallets](./esim-wallet.md) and owns the beacon they all point at. Every eSIM Kokio sells ends up owned by a wallet this contract deployed. It is a UUPS singleton, one per chain, sitting under the [Registry](./registry.md) in the [suite](./overview.md).

It is also what makes "valid" mean something. A wallet is only a real eSIM wallet if this factory deployed it, and `isESIMWalletDeployed` is the record. Anything else with the same bytecode at a different address is not in that mapping, and every guarded path in the protocol rejects it. Copying the code is not the attack this stops; claiming to be part of the suite is.

## Who may deploy one {#who-may-deploy-one}

Three callers, and only three: the [Registry](./registry.md), the [device wallet factory](./device-wallet-factory.md), and a device wallet deploying another eSIM wallet for itself. A user gets a new eSIM wallet by going through their own [device wallet](./device-wallet.md), which is the only route that does not need Kokio's involvement.

`getCounterFactualAddress` predicts the address the same way the device wallet factory does, so an eSIM wallet address is known before it exists.

## One beacon, every wallet {#one-beacon-every-wallet}

`updateESIMWalletImplementation` points the beacon at new code. Every eSIM wallet in the protocol moves onto it in that transaction, and there is no opt-out for a wallet whose owner would rather stay put. `getCurrentESIMWalletImplementation` reads back what they are running, and the value is published on the [deployed addresses](./deployments.md) page.

That is a real amount of power over other people's wallets, which is why the owner of this contract is the [`ProtocolAdmin`](./protocol-admin.md) timelock. An upgrade is announced by being scheduled, and cannot execute for two days.

<!-- docgen:start source=smart-contract-suite/docs/esim-wallet/ESIMWalletFactory.md -->
## ESIMWalletFactory {#esimwalletfactory}

Deploys eSIM wallets and owns the beacon they all point at

_A UUPS singleton. It owns an `UpgradeableBeacon`, so one call here moves every eSIM wallet in the protocol onto new logic at once. There is no per-wallet opt-out._

### registry {#esimwalletfactory-registry}

```solidity
contract Registry registry
```

Address of the registry contract

### beacon {#esimwalletfactory-beacon}

```solidity
contract UpgradeableBeacon beacon
```

Upgradeable beacon that points to the correct eSIM wallet logic contract

_Every eSIM wallet is a beacon proxy reading its implementation from here, so the implementation is replaced once rather than on each proxy:

eSIM wallet beacon proxy ─┐ eSIM wallet beacon proxy ─┼─> beacon ─> eSIM wallet implementation eSIM wallet beacon proxy ─┘_

### isESIMWalletDeployed {#esimwalletfactory-isesimwalletdeployed}

```solidity
mapping(address => bool) isESIMWalletDeployed
```

Set to true if eSIM wallet address is deployed using the factory, false otherwise

### ESIMWalletFactoryDeployed {#esimwalletfactory-esimwalletfactorydeployed}

```solidity
event ESIMWalletFactoryDeployed(address _upgradeManager, address _eSIMWalletImplementation, address _beacon)
```

Emitted when the eSIM wallet factory is deployed

### ESIMWalletDeployed {#esimwalletfactory-esimwalletdeployed}

```solidity
event ESIMWalletDeployed(address _eSIMWalletAddress, address _deviceWalletAddress, address _caller)
```

Emitted when a new eSIM wallet is deployed

### ESIMWalletImplementationUpdated {#esimwalletfactory-esimwalletimplementationupdated}

```solidity
event ESIMWalletImplementationUpdated(address _newImplementation)
```

Emitted when the eSIM wallet implementation is updated

### AddedRegistry {#esimwalletfactory-addedregistry}

```solidity
event AddedRegistry(address registry)
```

Emitted when the registry is added to the factory contract

### onlyRegistryOrDeviceWalletFactoryOrDeviceWallet {#esimwalletfactory-onlyregistryordevicewalletfactoryordevicewallet}

```solidity
modifier onlyRegistryOrDeviceWalletFactoryOrDeviceWallet()
```

Restricts a call to the registry, the device wallet factory or a known device wallet

_The first two deploy on behalf of a device wallet during setup. A device wallet reaching this directly is constrained further inside `deployESIMWallet`.

That third caller is what makes `DeviceWallet.deployESIMWallet`'s admin gate a workflow convenience rather than a boundary: an owner can sign an `execute` straight at this function and get the same wallet with no admin in the call. Deliberate, since a device wallet reaches every external function through `execute` and no check downstream of its call can tell which of its owner's intents produced it._

### constructor {#esimwalletfactory-constructor}

```solidity
constructor() public
```

Disables initializers on the implementation contract

_Locks the implementation contract itself. Without this, anyone can call initialize directly on the implementation, own it, and make it deploy a beacon it controls. The proxy is unaffected either way, but an owned implementation is a trap for any later upgrade that adds an outward call._

### initialize {#esimwalletfactory-initialize}

```solidity
function initialize(address _eSIMWalletImplementation, address _upgradeManager) external
```

Deploys the beacon and hands ownership of this factory to the upgrade manager

_The factory owns the beacon rather than the upgrade manager owning it directly, so the only way to move the implementation is `updateESIMWalletImplementation`, which is owner gated and emits an event._

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| _eSIMWalletImplementation | address | First eSIM wallet logic contract the beacon points at |
| _upgradeManager | address | Admin address responsible for upgrading contracts |

### addRegistryAddress {#esimwalletfactory-addregistryaddress}

```solidity
function addRegistryAddress(address _registryContractAddress) external returns (address)
```

Points the factory at the registry, which is deployed after it

_Write-once. Every caller check in this contract reads the registry, so allowing it to move would let a later owner redirect all of them at once._

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| _registryContractAddress | address | Address of the registry |

**Return Values**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | The registry address now in force |

### deployESIMWallet {#esimwalletfactory-deployesimwallet}

```solidity
function deployESIMWallet(address _deviceWalletAddress, uint256 _salt) external returns (address)
```

Deploys an eSIM wallet at a deterministic address and binds it to a device wallet

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| _deviceWalletAddress | address | Address of the associated device wallet |
| _salt | uint256 | CREATE2 salt, chosen by the caller and unique per wallet |

**Return Values**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | Address of the newly deployed eSIM wallet |

### getCounterFactualAddress {#esimwalletfactory-getcounterfactualaddress}

```solidity
function getCounterFactualAddress(address _deviceWalletAddress, uint256 _salt) public view returns (address)
```

The address deployESIMWallet would land on for these inputs

_Lets a caller probe a salt for occupancy before spending a deployment on it._

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| _deviceWalletAddress | address | Device wallet the eSIM wallet would be bound to |
| _salt | uint256 | CREATE2 salt |

**Return Values**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | The predicted eSIM wallet address |

### updateESIMWalletImplementation {#esimwalletfactory-updateesimwalletimplementation}

```solidity
function updateESIMWalletImplementation(address _eSIMWalletImpl) external returns (address)
```

Update the eSIM wallet implementation address in the beacon contract

_Moves every eSIM wallet in the protocol at once. Treat any change here as a protocol-wide upgrade, since no wallet can decline it._

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| _eSIMWalletImpl | address | Address of the new eSIM wallet implementation contract |

**Return Values**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | The implementation now in force |

### renounceOwnership {#esimwalletfactory-renounceownership}

```solidity
function renounceOwnership() public pure
```

Ownership of this contract is never renounced

_The owner is the only caller _authorizeUpgrade accepts, and this contract owns the beacon, so it is also the only route to updateESIMWalletImplementation. Renouncing would freeze every eSIM wallet on its current logic permanently._

### _authorizeUpgrade {#esimwalletfactory-_authorizeupgrade}

```solidity
function _authorizeUpgrade(address newImplementation) internal
```

Restricts UUPS upgrades of this factory to the owner

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| newImplementation | address | Address of the implementation being moved to |

### getCurrentESIMWalletImplementation {#esimwalletfactory-getcurrentesimwalletimplementation}

```solidity
function getCurrentESIMWalletImplementation() public view returns (address)
```

The eSIM wallet logic contract every eSIM wallet currently runs

**Return Values**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | The current implementation address |
<!-- docgen:end -->
