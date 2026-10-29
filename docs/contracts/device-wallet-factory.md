---
title: DeviceWalletFactory
description: Deploys Kokio device wallets at addresses you can compute before they exist, and owns the beacon every device wallet follows.
---

# Device wallet factory {#device-wallet-factory}

`DeviceWalletFactory` deploys [device wallets](./device-wallet.md) and owns the beacon they all point at. Every Kokio wallet on a phone comes from here. It is a UUPS singleton, one per chain, and it sits under the [Registry](./registry.md) in the [suite](./overview.md).

Two things about it matter to anyone integrating. The address of a wallet is known before the wallet exists, and there are two routes to deploying one.

## Predicting an address {#predicting-an-address}

`getCounterFactualAddress` returns the address a device wallet will have, computed with CREATE2 from the owner key and the device identifier. Nothing has to be deployed for this to work, and the answer does not change afterwards.

That is what lets the app show a user their wallet address the moment they register a passkey, accept a deposit into it before it is deployed, and deploy it later out of the funds that arrived. It is also the check an integrator should make before deploying: if the predicted address already has code, the wallet is there and deploying again is not what you want. `preCreateAccountValidation` is the read that answers whether a set of inputs is still free.

## Two deployment routes, one address {#two-deployment-routes}

`deployDeviceWalletForUsers` is the admin route. It deploys the wallet, its first [eSIM wallet](./esim-wallet.md) and the registry records together, in one transaction.

`createAccount` is the ERC-4337 route, called by the EntryPoint when a user operation carries an `initCode`. It writes no external storage at all, which is what keeps it inside the EntryPoint's validation rules. A wallet created that way is registered afterwards with `postCreateAccount`, and until that runs the [Registry](./registry.md) does not know about it.

Both routes land on the same address for the same inputs. Which one ran is not visible from the address, only from whether the registry records exist yet.

## Upgrades {#upgrades}

`updateDeviceWalletImplementation` points the beacon at new code, which moves every device wallet at once. `getCurrentDeviceWalletImplementation` reads back what they are running now. The beacon's address is on the [Base mainnet](../deployments/base.md#contracts) and [Base Sepolia](../deployments/base-sepolia.md#contracts) pages. The owner of this contract is the [`ProtocolAdmin`](./protocol-admin.md) timelock, so that call waits out a delay like every other privileged change.

<!-- docgen:start source=smart-contract-suite/docs/device-wallet/DeviceWalletFactory.md -->
## DeviceWalletFactory {#devicewalletfactory}

Deploys device wallets at deterministic addresses and owns the beacon they all point at

The admin batch route deploys and registers in one go. `createAccount` runs inside ERC-4337 validation and writes no external storage, so `postCreateAccount` registers it afterwards. Both routes give the same CREATE2 address for the same inputs.

### beacon {#devicewalletfactory-beacon}

```solidity
contract UpgradeableBeacon beacon
```

Beacon every device wallet proxy reads its implementation from

One update moves every wallet at once, and none can decline it.

### entryPoint {#devicewalletfactory-entrypoint}

```solidity
contract IEntryPoint entryPoint
```

ERC-4337 EntryPoint singleton passed into every device wallet implementation

### verifier {#devicewalletfactory-verifier}

```solidity
contract P256Verifier verifier
```

Contract the device wallets verify WebAuthn assertions through

### registry {#devicewalletfactory-registry}

```solidity
contract Registry registry
```

Registry contract instance

### eSIMWalletFactory {#devicewalletfactory-esimwalletfactory}

```solidity
contract ESIMWalletFactory eSIMWalletFactory
```

eSIM wallet factory contract instance

### deviceWalletInfoAdded {#devicewalletfactory-devicewalletinfoadded}

```solidity
mapping(address => bool) deviceWalletInfoAdded
```

Tracks all the device wallets that have their data added into the registry upon deployment

### DeviceWalletFactoryDeployed {#devicewalletfactory-devicewalletfactorydeployed}

```solidity
event DeviceWalletFactoryDeployed(address _upgradeManager, address _deviceWalletImplementation, address _beacon)
```

Emitted when factory is deployed

### DeviceWalletDeployed {#devicewalletfactory-devicewalletdeployed}

```solidity
event DeviceWalletDeployed(address _deviceWalletAddress, address _eSIMWalletAddress, bytes32[2] _deviceWalletOwnerKey)
```

Emitted when a new device wallet is deployed

### DeviceWalletImplementationUpdated {#devicewalletfactory-devicewalletimplementationupdated}

```solidity
event DeviceWalletImplementationUpdated(address _newDeviceImplementation)
```

Emitted when the device wallet implementation is updated

### AddedRegistry {#devicewalletfactory-addedregistry}

```solidity
event AddedRegistry(address registry)
```

Emitted when the registry is added to the factory contract

### onlyAdminOrRegistry {#devicewalletfactory-onlyadminorregistry}

```solidity
modifier onlyAdminOrRegistry()
```

Restricts a call to the eSIM wallet admin or the registry

### constructor {#devicewalletfactory-constructor}

```solidity
constructor() public
```

Disables initializers on the implementation contract

Otherwise anyone could initialize and own the implementation itself. The proxy is unaffected, but an owned implementation is a trap for a later upgrade that adds an outward call.

### initialize {#devicewalletfactory-initialize}

```solidity
function initialize(address _deviceWalletImplementation, address _upgradeManager, address _eSIMWalletFactoryAddress, contract IEntryPoint _entryPoint, contract P256Verifier _verifier) external
```

Deploys the beacon and hands ownership of this factory to the upgrade manager

The admin and the vault are read from the registry, set later by addRegistryAddress, so there is one source for each. Admin functions stay closed until then.

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| _deviceWalletImplementation | address | First device wallet logic contract the beacon points at |
| _upgradeManager | address | Admin address responsible for upgrading contracts |
| _eSIMWalletFactoryAddress | address | Factory the device wallets deploy their eSIM wallets through |
| _entryPoint | contract IEntryPoint | ERC-4337 EntryPoint singleton for this chain |
| _verifier | contract P256Verifier | Contract the device wallets verify WebAuthn assertions through |

### addRegistryAddress {#devicewalletfactory-addregistryaddress}

```solidity
function addRegistryAddress(address _registryContractAddress) external returns (address)
```

Sets the registry, once, after it has been deployed

Gated on the owner because the admin is read from the registry, so there is no admin to check until this lands. Same as ESIMWalletFactory.

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| _registryContractAddress | address | Address of the registry |

**Return Values**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | The registry address now in force |

### updateDeviceWalletImplementation {#devicewalletfactory-updatedevicewalletimplementation}

```solidity
function updateDeviceWalletImplementation(address _newDeviceImpl) external returns (address)
```

Points the beacon at a new device wallet implementation

A protocol-wide upgrade: every device wallet moves at once and none can decline it.

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| _newDeviceImpl | address | Address of the new device implementation contract |

**Return Values**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | The implementation now in force |

### deployDeviceWalletForUsers {#devicewalletfactory-deploydevicewalletforusers}

```solidity
function deployDeviceWalletForUsers(string[] _deviceUniqueIdentifiers, bytes32[2][] _deviceWalletOwnersKey, uint256[] _salts, uint256[] _depositAmounts) external payable returns (struct Wallets[])
```

Deploys device wallets, each with its first eSIM wallet and registry records

Unspent ETH is returned to the caller. Refused while paused, since it moves ETH.

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| _deviceUniqueIdentifiers | string[] | Device identifier per wallet |
| _deviceWalletOwnersKey | bytes32[2][] | Owner P256 public key per wallet |
| _salts | uint256[] | CREATE2 salt per wallet |
| _depositAmounts | uint256[] | ETH to deposit per wallet |

**Return Values**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | struct Wallets[] | The deployed device and eSIM wallet addresses |

### postCreateAccount {#devicewalletfactory-postcreateaccount}

```solidity
function postCreateAccount(address _deviceWallet, string _deviceUniqueIdentifier, bytes32[2] _deviceWalletOwnerKey, uint256 _salt) external
```

Records a wallet the EntryPoint deployed through createAccount

The key and identifier are proxy constructor arguments, so an address that matches the derivation and holds code was deployed by this factory with exactly those arguments.

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| _deviceWallet | address | Wallet that was deployed |
| _deviceUniqueIdentifier | string | Identifier the device is reached by |
| _deviceWalletOwnerKey | bytes32[2] | X,Y co-ordinates of the P256 key owning the wallet |
| _salt | uint256 | CREATE2 salt the wallet was deployed with |

### createAccount {#devicewalletfactory-createaccount}

```solidity
function createAccount(string _deviceUniqueIdentifier, bytes32[2] _deviceWalletOwnerKey, uint256 _salt) public payable returns (contract DeviceWallet deviceWallet)
```

Deploys a device wallet, returning the existing one if that address already holds it

Runs in ERC-4337 validation, so it leaves the registry to `postCreateAccount`. Reading its own and the beacon's storage needs a staked factory. Returning an existing wallet instead of reverting keeps `entryPoint.getSenderAddress()` working after creation.

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| _deviceUniqueIdentifier | string | Identifier the device is reached by |
| _deviceWalletOwnerKey | bytes32[2] | X,Y co-ordinates of the P256 key owning the wallet |
| _salt | uint256 | CREATE2 salt for the wallet |

**Return Values**

| Name | Type | Description |
| ---- | ---- | ----------- |
| deviceWallet | contract DeviceWallet | The wallet at the computed address, new or already deployed |

### renounceOwnership {#devicewalletfactory-renounceownership}

```solidity
function renounceOwnership() public pure
```

Ownership of this contract is never renounced

The owner alone upgrades this factory and the beacon, so renouncing would freeze every device wallet on its current logic for good.

### _authorizeUpgrade {#devicewalletfactory-_authorizeupgrade}

```solidity
function _authorizeUpgrade(address newImplementation) internal
```

Restricts UUPS upgrades of this factory to the owner

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| newImplementation | address | Address of the implementation being moved to |

### _deployDeviceWallet {#devicewalletfactory-_deploydevicewallet}

```solidity
function _deployDeviceWallet(string _deviceUniqueIdentifier, bytes32[2] _deviceWalletOwnerKey, uint256 _salt, uint256 _depositAmount) internal returns (struct Wallets, uint256)
```

Deploys one device wallet, its first eSIM wallet and the binding between them

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| _deviceUniqueIdentifier | string | Identifier the device is reached by |
| _deviceWalletOwnerKey | bytes32[2] | Owner P256 public key of the device and eSIM wallets |
| _salt | uint256 | CREATE2 salt for both wallets |
| _depositAmount | uint256 | ETH to deposit into the device wallet |

**Return Values**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | struct Wallets | The device and eSIM wallet addresses |
| [1] | uint256 | ETH actually forwarded, zero if an already registered wallet was returned |

### _createAccountForUser {#devicewalletfactory-_createaccountforuser}

```solidity
function _createAccountForUser(string _deviceUniqueIdentifier, bytes32[2] _deviceWalletOwnerKey, uint256 _salt, uint256 _depositAmount) internal returns (contract DeviceWallet deviceWallet, uint256 spentETH)
```

Deploys a device wallet and writes its registry records, or adopts one that already exists

Callers holding a budget must charge `spentETH`, not the requested deposit. It is zero for an already registered wallet, and the full deposit for a new or adopted one.

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| _deviceUniqueIdentifier | string | Identifier the device is reached by |
| _deviceWalletOwnerKey | bytes32[2] | X,Y co-ordinates of the P256 key owning the wallet |
| _salt | uint256 | CREATE2 salt for the wallet |
| _depositAmount | uint256 | ETH the caller asked to be deposited |

**Return Values**

| Name | Type | Description |
| ---- | ---- | ----------- |
| deviceWallet | contract DeviceWallet | The wallet at the computed address |
| spentETH | uint256 | ETH actually forwarded to it |

### eSIMWalletAdmin {#devicewalletfactory-esimwalletadmin}

```solidity
function eSIMWalletAdmin() public view returns (address)
```

Admin address of the eSIM wallet project

Read from the registry so a rotation there applies here too. Returns address(0), which no caller matches, until the registry is set, rather than calling into address(0).

**Return Values**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | The current admin, or zero if the registry is not yet wired up |

### preCreateAccountValidation {#devicewalletfactory-precreateaccountvalidation}

```solidity
function preCreateAccountValidation(string _deviceUniqueIdentifier, bytes32[2] _deviceWalletOwnerKey) public view returns (address wallet)
```

Checks the inputs for a fresh device wallet against the registry

For use before `createAccount`, which cannot read the registry itself

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| _deviceUniqueIdentifier | string | Identifier the device is reached by |
| _deviceWalletOwnerKey | bytes32[2] | Owner P256 public key of the device and eSIM wallets |

**Return Values**

| Name | Type | Description |
| ---- | ---- | ----------- |
| wallet | address | address(0) if both are free, else the wallet already holding one of them |

### getCounterFactualAddress {#devicewalletfactory-getcounterfactualaddress}

```solidity
function getCounterFactualAddress(bytes32[2] _deviceWalletOwnerKey, string _deviceUniqueIdentifier, uint256 _salt) public view returns (address)
```

The address createAccount would deploy to for these inputs

The key and identifier are proxy constructor arguments, so changing either, or the salt, moves the address.

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| _deviceWalletOwnerKey | bytes32[2] | X,Y co-ordinates of the P256 key owning the wallet |
| _deviceUniqueIdentifier | string | Identifier the device is reached by |
| _salt | uint256 | CREATE2 salt |

**Return Values**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | The predicted device wallet address |

### getCurrentDeviceWalletImplementation {#devicewalletfactory-getcurrentdevicewalletimplementation}

```solidity
function getCurrentDeviceWalletImplementation() public view returns (address)
```

The device wallet logic contract every device wallet currently runs

**Return Values**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | The current implementation address |
<!-- docgen:end -->
