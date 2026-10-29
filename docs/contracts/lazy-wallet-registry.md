---
title: LazyWalletRegistry
description: Where a Kokio purchase is recorded when the buyer paid by card and has no wallet yet, and how that history is copied onto real wallets once they are deployed.
---

# Lazy wallet registry {#lazy-wallet-registry}

How a card purchase is recorded before the buyer has a wallet, then copied onto one.

---

`LazyWalletRegistry` solves an ordering problem Kokio has with every card payment. Someone buys an eSIM with a card, on a phone that has never touched a blockchain, and the purchase has to be recorded before there is anything to record it on. This contract holds that history until wallets exist, then deploys them and copies the record across.

Everything here is keyed by string identifiers rather than by addresses, because a user in this state has no address yet:

- A **device identifier** stands in for the phone.
- An **eSIM identifier** stands in for the eSIM.

The [Registry](./registry.md) resolves both to real wallets once `deployLazyWalletAndSetESIMIdentifier` has run. From that point the user's purchases live on their own [eSIM wallet](./esim-wallet.md) and this contract is out of the path.

## Retrying is the normal case {#retrying-is-the-normal-case}

Both the deployment and the history copy are batched, and both keep their own cursor in storage. A dropped transaction is retried by sending the same call again. The cursor says how far the last attempt got, and the work resumes from there rather than starting over or double-writing.

:::note
Each batch loop reverts on its terminal condition rather than returning quietly. That lets a backend call the same function in a loop until it stops, without tracking completion separately. `outstandingHistoryEntries` answers how much is left.
:::

The batch size limits, `MAX_HISTORY_ENTRIES_PER_CALL` and `MAX_ESIM_WALLETS_PER_CALL`, are constants.

:::warning
A call asking for more than the batch limit is rejected, not truncated.
:::

## Who can write here {#who-can-write-here}

Only the eSIM wallet admin. A record in this contract is Kokio's word that a card payment happened, because a card payment leaves no trace a contract can check.

That is why the [price ceiling](./registry.md) applies to these purchases too, and why the `Settlement` value stored against each entry says which of the three payment routes was used. The [types](./types.md) page lists them.

`LazyWalletRegistry` is a UUPS proxy owned by [`ProtocolAdmin`](./protocol-admin.md). Its address is on the [Base mainnet](../deployments/base.md) and [Base Sepolia](../deployments/base-sepolia.md) pages.

<!-- docgen:start source=smart-contract-suite/docs/LazyWalletRegistry.md -->
## LazyWalletRegistry {#lazywalletregistry}

Holds what a fiat user bought before they had a wallet, then deploys the wallets and copies the record onto them

Keyed by string identifiers, since a lazy user has no address yet. Deployment and history copy keep their cursors in storage, so a dropped transaction is retried by repeating it.

### MAX_HISTORY_ENTRIES_PER_CALL {#lazywalletregistry-max_history_entries_per_call}

```solidity
uint256 MAX_HISTORY_ENTRIES_PER_CALL
```

Most purchase history entries `setHistoryForLazyWallet` will copy in one call

About 50,000 gas per entry, so a full batch is ~2,500,000: sized to keep a failed batch cheap to retry, not for the block limit. Refused rather than clamped, so a caller never believes it wrote more than it did.

### MAX_ESIM_WALLETS_PER_CALL {#lazywalletregistry-max_esim_wallets_per_call}

```solidity
uint256 MAX_ESIM_WALLETS_PER_CALL
```

Most eSIM wallets a single call will deploy for one device

About 500,000 gas per wallet, so a full batch is ~10,000,000. Sized for retry cost, since a batch that runs out of gas is paid for and lost, and to leave room for `forge coverage --ir-minimum`, which adds about a fifth. Refused rather than clamped.

### registry {#lazywalletregistry-registry}

```solidity
contract Registry registry
```

Registry contract instance

### deviceIdentifierToESIMDetails {#lazywalletregistry-deviceidentifiertoesimdetails}

```solidity
mapping(string => mapping(string => struct DataBundleDetails[])) deviceIdentifierToESIMDetails
```

eSIM identifiers and their details associated with the device identifiers

### eSIMIdentifierToDeviceIdentifier {#lazywalletregistry-esimidentifiertodeviceidentifier}

```solidity
mapping(string => string) eSIMIdentifierToDeviceIdentifier
```

Mapping from eSIM unique identifier to device unique identifier

A device can have many eSIMs, but an eSIM has only one device.

### eSIMIdentifiersAssociatedWithDeviceIdentifier {#lazywalletregistry-esimidentifiersassociatedwithdeviceidentifier}

```solidity
mapping(string => string[]) eSIMIdentifiersAssociatedWithDeviceIdentifier
```

List of eSIM identifiers associated with the device identifiers

### historyEntriesCopied {#lazywalletregistry-historyentriescopied}

```solidity
mapping(string => uint256) historyEntriesCopied
```

How many of an eSIM's stored purchase entries have already reached its wallet

The wallet appends whatever it is handed, so this alone stops a repeat call writing entries twice. Read here rather than taken from the caller, so two calls in flight are safe.

### lazyDeployedESIMWallet {#lazywalletregistry-lazydeployedesimwallet}

```solidity
mapping(string => address) lazyDeployedESIMWallet
```

The eSIM wallet this contract deployed for an eSIM identifier

Without this, a wallet deployed through the ordinary route could claim a lazy user's eSIM identifier and receive their history. Written from the deployment's returned addresses and not touched by ownership transfers, so the copy follows the wallet.

### eSIMWalletsDeployed {#lazywalletregistry-esimwalletsdeployed}

```solidity
mapping(string => uint256) eSIMWalletsDeployed
```

How many of a device's eSIM wallets this contract has already deployed

Non-zero means this contract set the device up, since the first batch deploys at least one. Asking the registry instead would also accept a device wallet from the ordinary route under the same identifier, and hand it the lazy user's wallets.

### lazyDeploymentSalt {#lazywalletregistry-lazydeploymentsalt}

```solidity
mapping(string => uint256) lazyDeploymentSalt
```

Salt the device's first deployment batch started from

Later batches continue from this rather than restart on an address already in use. Stored, because a caller passing a different salt would silently give different addresses.

### DataUpdatedForDevice {#lazywalletregistry-dataupdatedfordevice}

```solidity
event DataUpdatedForDevice(string _deviceUniqueIdentifier, string[] _eSIMUniqueIdentifiers, struct DataBundleDetails[] _dataBundleDetails)
```

Emitted when data related to a device is updated

### ESIMBindedWithDevice {#lazywalletregistry-esimbindedwithdevice}

```solidity
event ESIMBindedWithDevice(string _eSIMUniqueIdentifier, string _deviceUniqueIdentifier)
```

Emitted when an eSIM identifier is associated with a device identifier

### LazyWalletDeployed {#lazywalletregistry-lazywalletdeployed}

```solidity
event LazyWalletDeployed(bytes32[2] _deviceOwnerPublicKey, address deviceWallet, string _deviceUniqueIdentifier, address[] eSIMWallets, string[] _eSIMUniqueIdentifiers)
```

Emitted when the Lazy wallet is deployed

String arrays are left unindexed on purpose: an indexed dynamic type stores only its hash, which no consumer can use.

### LazyESIMWalletsDeployed {#lazywalletregistry-lazyesimwalletsdeployed}

```solidity
event LazyESIMWalletsDeployed(string _deviceUniqueIdentifier, address _deviceWallet, address[] _eSIMWallets, string[] _eSIMUniqueIdentifiers, uint256 _remaining)
```

Emitted for every batch of eSIM wallets deployed for a device, including the first. `_remaining` of zero means the device is fully deployed.

`LazyWalletDeployed` carries only the first batch, so follow this for the whole set.

### LazyHistoryCopied {#lazywalletregistry-lazyhistorycopied}

```solidity
event LazyHistoryCopied(string _eSIMIdentifier, address _eSIMWallet, uint256 _copied, uint256 _remaining)
```

Emitted for every batch of purchase history copied into a deployed eSIM wallet. `_remaining` of zero means the copy is finished.

### ESIMIdentifierSwitchedToNewDeviceIdentifier {#lazywalletregistry-esimidentifierswitchedtonewdeviceidentifier}

```solidity
event ESIMIdentifierSwitchedToNewDeviceIdentifier(string _eSIMIdentifier, string _oldDeviceIdentifier, string currentDeviceIdentifier)
```

Emitted when the user switches eSIM to a new device

### NewDeviceIdentifierAssociatedWithESIMIdentifier {#lazywalletregistry-newdeviceidentifierassociatedwithesimidentifier}

```solidity
event NewDeviceIdentifierAssociatedWithESIMIdentifier(string _eSIMIdentifier, string _oldDeviceIdentifier, string _newDeviceIdentifier)
```

Emitted when the device identifier associated with an eSIM identifier is updated

### DataBundleDetailsTransferredToNewDeviceIdentifier {#lazywalletregistry-databundledetailstransferredtonewdeviceidentifier}

```solidity
event DataBundleDetailsTransferredToNewDeviceIdentifier(string _newDeviceIdentifier, struct DataBundleDetails[] _newDataBundleDetails)
```

Emitted when the Data bundle related details of an eSIM are transferred to a new device identifier

### DataBundleDetailsDeletedFromOldDeviceIdentifier {#lazywalletregistry-databundledetailsdeletedfromolddeviceidentifier}

```solidity
event DataBundleDetailsDeletedFromOldDeviceIdentifier(string _oldDeviceIdentifier, string _eSIMIdentifier)
```

Emitted when the data bundle details are deleted from the old device identifier

### ESIMIdentifierRemovedFromOldDeviceIdentifier {#lazywalletregistry-esimidentifierremovedfromolddeviceidentifier}

```solidity
event ESIMIdentifierRemovedFromOldDeviceIdentifier(string _oldDeviceIdentifier, string _eSIMIdentifier, string[] _eSIMIdentifierOfOldDevice)
```

Emitted when an eSIM identifier is removed from a device identifier's list

### ESIMIdentifierAddedToNewDeviceIdentifier {#lazywalletregistry-esimidentifieraddedtonewdeviceidentifier}

```solidity
event ESIMIdentifierAddedToNewDeviceIdentifier(string _newDeviceIdentifier, string _eSIMIdentifier, string[] _eSIMIdentifierOfNewDevice)
```

Emitted when an eSIM identifier is added to a new device identifier's list

### onlyESIMWalletAdmin {#lazywalletregistry-onlyesimwalletadmin}

```solidity
modifier onlyESIMWalletAdmin()
```

Restricts a call to the eSIM wallet admin

Read from the registry each call, so a rotation there takes effect at once.

### constructor {#lazywalletregistry-constructor}

```solidity
constructor() public
```

Disables initializers on the implementation contract

Otherwise anyone could initialise and own the implementation, a trap for any later upgrade that adds an outward call.

### initialize {#lazywalletregistry-initialize}

```solidity
function initialize(address _registry, address _upgradeManager) external
```

Points this contract at the registry and hands ownership to the upgrade manager

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| _registry | address | Registry this contract reads the admin from and deploys wallets through |
| _upgradeManager | address | Admin address responsible for upgrading contracts |

### batchPopulateHistory {#lazywalletregistry-batchpopulatehistory}

```solidity
function batchPopulateHistory(string[] _deviceUniqueIdentifiers, string[][] _eSIMUniqueIdentifiers, struct DataBundleDetails[][] _dataBundleDetails) external
```

Records devices, their eSIMs and the data bundles bought for them

Refused for a device that already has a wallet, which freezes its eSIM list and history while a deployment walks them.

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| _deviceUniqueIdentifiers | string[] | Devices being recorded |
| _eSIMUniqueIdentifiers | string[][] | Per device, the eSIM each purchase was made for |
| _dataBundleDetails | struct DataBundleDetails[][] | Per device, the purchases, aligned with the eSIM identifiers |

### deployLazyWalletAndSetESIMIdentifier {#lazywalletregistry-deploylazywalletandsetesimidentifier}

```solidity
function deployLazyWalletAndSetESIMIdentifier(bytes32[2] _deviceOwnerPublicKey, string _deviceUniqueIdentifier, uint256 _salt, uint256 _depositAmount, uint256 _maxWallets) external payable returns (address deviceWallet, address[] eSIMWallets, uint256 remaining)
```

Deploys a device wallet and the first batch of its eSIM wallets, setting their identifiers

The rest go through `deployMoreESIMWalletsForLazyDevice`: one transaction for every wallet stopped fitting in a block past about forty. The device wallet is usable at once, so a dropped later batch does not leave the user with nothing. Switching an eSIM is refused meanwhile, since the switch refuses any device that has a wallet. Pause-checked because it moves ETH. Its two siblings move none and run through a pause on purpose, so a half deployed device can still be finished.

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| _deviceOwnerPublicKey | bytes32[2] | P256 public key of the device owner |
| _deviceUniqueIdentifier | string | Device being deployed |
| _salt | uint256 | Salt every eSIM wallet address of the device derives from |
| _depositAmount | uint256 | ETH to deposit in the device wallet |
| _maxWallets | uint256 | Most eSIM wallets to deploy here, at most MAX_ESIM_WALLETS_PER_CALL |

**Return Values**

| Name | Type | Description |
| ---- | ---- | ----------- |
| deviceWallet | address | The deployed device wallet |
| eSIMWallets | address[] | eSIM wallets deployed here, in the device's identifier order |
| remaining | uint256 | eSIM wallets still waiting |

### deployMoreESIMWalletsForLazyDevice {#lazywalletregistry-deploymoreesimwalletsforlazydevice}

```solidity
function deployMoreESIMWalletsForLazyDevice(string _deviceUniqueIdentifier, uint256 _maxWallets) external returns (address[] eSIMWallets, uint256 remaining)
```

Deploys the next batch of eSIM wallets for a device already set up by the lazy route

Call until it reverts `AllESIMWalletsDeployed`, which means done, not failed. No pause check: it moves no ETH, and `_populateHistory` refuses a device with a wallet, so the list it walks cannot grow under a running deployment.

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| _deviceUniqueIdentifier | string | Device whose remaining eSIM wallets are being deployed |
| _maxWallets | uint256 | Most eSIM wallets to deploy here, at most MAX_ESIM_WALLETS_PER_CALL |

**Return Values**

| Name | Type | Description |
| ---- | ---- | ----------- |
| eSIMWallets | address[] | eSIM wallets deployed here, in the device's identifier order |
| remaining | uint256 | eSIM wallets still waiting |

### setHistoryForLazyWallet {#lazywalletregistry-sethistoryforlazywallet}

```solidity
function setHistoryForLazyWallet(string _eSIMIdentifier, uint256 _maxEntries) external returns (uint256 copied, uint256 remaining)
```

Copies the next batch of an eSIM's stored purchase history into its deployed wallet

Kept out of the deployment so neither grows with the other. Call until it reverts `HistoryAlreadyCopied`, which means done, not failed. No pause check: it moves no ETH, and `_populateHistory` froze these entries once the device had a wallet.

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| _eSIMIdentifier | string | eSIM whose history is being copied |
| _maxEntries | uint256 | Most entries to copy here, at most MAX_HISTORY_ENTRIES_PER_CALL |

**Return Values**

| Name | Type | Description |
| ---- | ---- | ----------- |
| copied | uint256 | Entries written by this call |
| remaining | uint256 | Entries still waiting |

### switchESIMIdentifierToNewDeviceIdentifier {#lazywalletregistry-switchesimidentifiertonewdeviceidentifier}

```solidity
function switchESIMIdentifierToNewDeviceIdentifier(string _eSIMIdentifier, string _oldDeviceIdentifier, string _newDeviceIdentifier) external returns (bool)
```

Moves a fiat user's eSIM to a new device, before either device has a wallet

After deployment the eSIM moves through ESIMWallet's ownership transfer instead.

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| _eSIMIdentifier | string | eSIM being switched |
| _oldDeviceIdentifier | string | Device the eSIM is bound to now |
| _newDeviceIdentifier | string | Device it moves to |

**Return Values**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | True if the switch succeeded |

### renounceOwnership {#lazywalletregistry-renounceownership}

```solidity
function renounceOwnership() public pure
```

Ownership of this contract is never renounced

Only the owner can upgrade, so renouncing would freeze this logic for good.

### _authorizeUpgrade {#lazywalletregistry-_authorizeupgrade}

```solidity
function _authorizeUpgrade(address newImplementation) internal
```

Restricts UUPS upgrades to the owner

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| newImplementation | address | Address of the implementation being moved to |

### _populateHistory {#lazywalletregistry-_populatehistory}

```solidity
function _populateHistory(string _deviceUniqueIdentifier, string[] _eSIMUniqueIdentifiers, struct DataBundleDetails[] _dataBundleDetails) internal
```

Records one device's eSIM identifiers and the purchases made against them

`_eSIMUniqueIdentifiers` may repeat an identifier, since one eSIM can have several purchases. An identifier already bound to a different device is refused.

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| _deviceUniqueIdentifier | string | Device the purchases belong to |
| _eSIMUniqueIdentifiers | string[] | One entry per purchase, naming the eSIM it was made for |
| _dataBundleDetails | struct DataBundleDetails[] | The purchases themselves, aligned with the identifiers |

### _moveESIMPurchaseHistory {#lazywalletregistry-_moveesimpurchasehistory}

```solidity
function _moveESIMPurchaseHistory(string _eSIMIdentifier, string _oldDeviceIdentifier, string _newDeviceIdentifier) internal
```

Moves what an eSIM bought to the device taking it over

A switch also needs `_moveESIMIdentifierBetweenDeviceLists` for the list membership.

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| _eSIMIdentifier | string | eSIM being switched |
| _oldDeviceIdentifier | string | Device it is leaving |
| _newDeviceIdentifier | string | Device it is joining |

### _moveESIMIdentifierBetweenDeviceLists {#lazywalletregistry-_moveesimidentifierbetweendevicelists}

```solidity
function _moveESIMIdentifierBetweenDeviceLists(string _eSIMIdentifier, string _oldDeviceIdentifier, string _newDeviceIdentifier) internal
```

Moves an eSIM identifier between the two devices' lists

This list is what a deployment walks. Removal is swap-and-pop, so the old device's list loses its order.

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| _eSIMIdentifier | string | eSIM being switched |
| _oldDeviceIdentifier | string | Device it is leaving |
| _newDeviceIdentifier | string | Device it is joining |

### upgradeManager {#lazywalletregistry-upgrademanager}

```solidity
function upgradeManager() public view returns (address)
```

Address (owned/controlled by eSIM wallet project) that can upgrade contracts

Reads the owner, who alone can upgrade, rather than a copy that could disagree.

**Return Values**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | The address that may upgrade this contract |

### outstandingHistoryEntries {#lazywalletregistry-outstandinghistoryentries}

```solidity
function outstandingHistoryEntries(string _eSIMIdentifier) external view returns (uint256)
```

How many history entries are still waiting to be copied into this eSIM's wallet

The public getter on `deviceIdentifierToESIMDetails` cannot return a length. Zero for an eSIM this contract never handled.

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| _eSIMIdentifier | string | eSIM being asked about |

**Return Values**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | Entries still waiting to be copied |

### isDeviceIdentifierReserved {#lazywalletregistry-isdeviceidentifierreserved}

```solidity
function isDeviceIdentifierReserved(string _deviceUniqueIdentifier) public view returns (bool)
```

Whether a device identifier has purchases recorded against it here

Checked by the ordinary route, since a wallet under a reserved identifier strands its eSIMs. Stays true after lazy deployment, harmless as the registry refuses a second claim.

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| _deviceUniqueIdentifier | string | Device identifier being checked |

**Return Values**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | True if a lazy user is waiting on this identifier |

### isESIMIdentifierReserved {#lazywalletregistry-isesimidentifierreserved}

```solidity
function isESIMIdentifierReserved(string _eSIMUniqueIdentifier) public view returns (bool)
```

Whether an eSIM identifier is bound to a device here

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| _eSIMUniqueIdentifier | string | eSIM identifier being checked |

**Return Values**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | True if a lazy user is waiting on this identifier |
<!-- docgen:end -->
