---
title: Registry
description: The central record of the Kokio wallet suite, holding the admin address, the vault, the pause switch and the price ceiling, and tracking which device and eSIM wallets are real.
---

# Registry contract {#registry-contract}

The central record of the suite: the admin, the vault, the pause switch, the default limits, and which wallets are real.

---

`Registry` is the single source of truth for who is who in the Kokio [wallet suite](./overview.md). Every wallet reads it before it does anything guarded.

It holds:

- the admin address
- the vault that receives payments
- the pause flag
- the defaults for each eSIM wallet's price ceiling and admin allowance
- the record of which [device wallets](./device-wallet.md) and [eSIM wallets](./esim-wallet.md) the protocol deployed, as opposed to someone imitating it

One place, not several, and that is the point. Device wallets and eSIM wallets are beacon proxies tracked by mappings with no enumerable list, so there is no way to write a new value into each of them one by one. Every wallet reads this contract on its guarded paths instead, so rotating the admin key or raising the pause reaches all of them in the same transaction.

## What it decides {#what-it-decides}

- **Who the admin is.** `adminOfRecord` is the address on the books. A suspended admin keeps its entry, so the suspension can be lifted without anyone having to remember the address.

  :::warning
  To find out who may act right now, read `eSIMWalletAdmin()`, not `adminOfRecord`.
  :::

- **Whether the protocol is paused.** `pause()` accepts the admin or the owner. The owner route is what lets a [guardian](./protocol-admin.md) pause through the timelock while the admin key is suspended. Releasing it is owner only, and a guardian can do that without waiting out the delay.
- **What a purchase may cost.** `defaultPriceCapUSDCents` is the ceiling a new eSIM wallet starts with, set by the owner and never zero. The owning device wallet can set its own wallet's cap to any figure, and the admin cannot change it.
- **What the admin may charge in total.** `defaultAdminAllowanceUSDCents` is the total the admin may charge a new [eSIM wallet](./esim-wallet.md#what-the-admin-can-and-cannot-do), set at `initialize` and changed by the owner. It is zero on Base mainnet, so a new wallet allows no admin charges until its owner sets an allowance. Wallets that already exist keep their own figure, and a wallet that moves to another device takes the default again.
- **Which wallets count.** `isDeviceWalletValid` and `isESIMWalletValid` answer for anything deployed through the two factories. A wallet deployed outside the suite is not in these mappings and every guarded path rejects it. When a device wallet registers a new owner key, the registry reads the key back from the wallet and refuses one the wallet does not hold (`OwnerKeyNotHeldByWallet`), so no wallet can claim someone else's key first.
- **Which eSIM identifiers are spoken for.** An identifier reserved for a fiat user's lazy batch cannot be handed out through `assignESIMIdentifier`. Only the [lazy wallet registry](./lazy-wallet-registry.md) can claim it, through its own path.
- **Payment references.** `usedPaymentReferences` records which offchain order ids have been spent, so a purchase call that is retried after it already landed cannot charge the user twice. It is keyed by the wallet and the reference together, so one wallet cannot burn a reference another wallet is about to use. This lives here rather than on the [payment adapter](./payment-adapter.md) so that rotating the adapter does not reset it.

## Two contracts, one deployment {#two-contracts-one-deployment}

The reference below is in two parts. `Registry` holds the admin, pause and payment logic. `RegistryHelper` holds the mappings and the lazy deployment paths, and `Registry` inherits it, so both sets of members live at the same address. Only the [lazy wallet registry](./lazy-wallet-registry.md) calls into the helper's functions directly; everything else goes through `Registry` itself.

`Registry` is a UUPS proxy owned by [`ProtocolAdmin`](./protocol-admin.md). Its address is on the [Base mainnet](../deployments/base.md) and [Base Sepolia](../deployments/base-sepolia.md) pages, and it does not change when the implementation behind it does.

<!-- docgen:start source=smart-contract-suite/docs/Registry.md -->
## Registry {#registry}

Holds the protocol's roles and switches: admin, vault, pause flag and price ceiling

Wallets are beacon proxies with no enumerable list, so one write here is the only way a change reaches all of them in the same transaction. `IPausable` and `IRegistryAdmin` let the compiler check what `ProtocolAdmin` calls, since a mismatch would only show as a revert mid-incident. `enableAdmin` is left out on purpose, so nothing invites a fast path for restoring a suspended key.

### entryPoint {#registry-entrypoint}

```solidity
contract IEntryPoint entryPoint
```

Entry point contract address (one entryPoint per chain)

### adminOfRecord {#registry-adminofrecord}

```solidity
address adminOfRecord
```

Address holding the admin role, whether or not its powers are currently live

The only copy, so a rotation reaches every reader at once and none keeps the old key. Use `eSIMWalletAdmin()` to ask who may act: this keeps naming a suspended admin so the suspension can be lifted without re-supplying the address.

### vault {#registry-vault}

```solidity
address vault
```

Address of the vault that receives payments for the eSIM data bundles

### newRequestedAdmin {#registry-newrequestedadmin}

```solidity
address newRequestedAdmin
```

Address of the admin to be appointed

Set by the owner, cleared on acceptance. While set the incumbent has no powers, so an unaccepted handover leaves the role dormant rather than shared.

### paused {#registry-paused}

```solidity
bool paused
```

True while the protocol's guarded purchase and pull paths are stopped

Held here so one write reaches every wallet; they all read it on their guarded paths.

### adminDisabled {#registry-admindisabled}

```solidity
bool adminDisabled
```

True while the admin's powers are suspended, leaving the address on the books

Packs beside `paused`. Suspending is instant through a guardian but lifting it is an owner action that waits, so a compromised key cannot restore itself as fast.

### defaultPriceCapUSDCents {#registry-defaultpricecapusdcents}

```solidity
uint64 defaultPriceCapUSDCents
```

Most an eSIM wallet may be charged for one data bundle, in USD cents, unless it sets its own limit

Never zero, both setters refuse it: zero on a wallet means "follow the registry", so it has no meaning here.

### paymentAdapter {#registry-paymentadapter}

```solidity
address paymentAdapter
```

Contract holding the accepted currencies

### usedPaymentReferences {#registry-usedpaymentreferences}

```solidity
mapping(bytes32 => bool) usedPaymentReferences
```

Payment references already spent, scoped per eSIM wallet

Held here so replay protection survives `setPaymentAdapter`. Keyed by `keccak256(abi.encode(eSIMWallet, paymentReference))` so one wallet spending a reference cannot burn it for another wallet's pending settlement.

### defaultAdminAllowanceUSDCents {#registry-defaultadminallowanceusdcents}

```solidity
uint64 defaultAdminAllowanceUSDCents
```

What a new eSIM wallet lets the admin charge it in total, in USD cents

Copied into each wallet at deploy and handover, so a change here never moves an existing wallet. Zero means new wallets take no admin charges.

### onlyESIMWallet {#registry-onlyesimwallet}

```solidity
modifier onlyESIMWallet()
```

Restricts a call to an eSIM wallet this registry has recorded

### onlyDeviceWallet {#registry-onlydevicewallet}

```solidity
modifier onlyDeviceWallet()
```

Restricts a call to a device wallet this registry has recorded

### onlyDeviceWalletFactory {#registry-onlydevicewalletfactory}

```solidity
modifier onlyDeviceWalletFactory()
```

Restricts a call to the device wallet factory

### onlyESIMWalletAdmin {#registry-onlyesimwalletadmin}

```solidity
modifier onlyESIMWalletAdmin()
```

Restricts a call to the current eSIM wallet admin

Reads the accessor, not `adminOfRecord`, so a suspended admin is refused here too.

### constructor {#registry-constructor}

```solidity
constructor() public
```

Disables initializers on the implementation contract

Otherwise anyone could initialize and own the implementation. The proxy is unaffected, but an owned implementation is a trap for a later upgrade that adds an outward call.

### initialize {#registry-initialize}

```solidity
function initialize(address _eSIMWalletAdmin, address _vault, address _upgradeManager, address _deviceWalletFactory, address _eSIMWalletFactory, contract IEntryPoint _entryPoint, uint64 _defaultPriceCapUSDCents, uint64 _defaultAdminAllowanceUSDCents) external
```

Wires the registry to the two factories and sets the protocol's addresses

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| _eSIMWalletAdmin | address | Admin address of the eSIM wallet project |
| _vault | address | Address of the vault that receives payments for the data bundles |
| _upgradeManager | address | Admin address responsible for upgrading contracts |
| _deviceWalletFactory | address | Factory that deploys device wallets |
| _eSIMWalletFactory | address | Factory that deploys eSIM wallets |
| _entryPoint | contract IEntryPoint | ERC-4337 EntryPoint singleton for this chain |
| _defaultPriceCapUSDCents | uint64 | Starting price ceiling in USD cents. Non-zero, since zero        reads as "no ceiling" in `ESIMWallet._requirePriceWithinCap`. |
| _defaultAdminAllowanceUSDCents | uint64 | Total the admin may charge each new eSIM wallet, in USD cents |

### requestAdminUpdate {#registry-requestadminupdate}

```solidity
function requestAdminUpdate(address _newAdmin) external
```

Nominates a new admin, which strips the incumbent until the nominee accepts

Owner, not admin: a compromised admin could never be replaced, and could hold the pause on with no other key able to end it. Nominating strips the incumbent at once (via `eSIMWalletAdmin()`), so the two never hold the role together; keep nomination and acceptance close. Calling again overrides a mistaken nomination, and naming the incumbent withdraws it and lifts a suspension.

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| _newAdmin | address | Address of the recipient to receive the admin role |

### acceptAdminUpdate {#registry-acceptadminupdate}

```solidity
function acceptAdminUpdate() external returns (address)
```

Takes up the admin role, callable only by the nominated address

Clears the suspension too: it targets a key, not the role, so a fresh key accepting ends the incident.

**Return Values**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | Address of the new admin |

### disableAdmin {#registry-disableadmin}

```solidity
function disableAdmin() external
```

Suspends the admin's powers protocol-wide, leaving its address on the books

Every gate reads `eSIMWalletAdmin()`, which returns zero from here, so one write closes them all. Owner gated so `ProtocolAdmin` can give a guardian an instant route. A repeat reverts so a guardian mid-incident never believes it acted when it did not.

### enableAdmin {#registry-enableadmin}

```solidity
function enableAdmin() external
```

Hands a suspended admin its powers back

Owner only with no instant route, so a compromised key cannot undo its suspension as fast as it is applied. An outstanding handover still keeps the incumbent powerless; withdraw it with `requestAdminUpdate` naming the incumbent.

### eSIMWalletAdmin {#registry-esimwalletadmin}

```solidity
function eSIMWalletAdmin() public view returns (address)
```

Admin address every gated call in the protocol is checked against

Zero while suspended or while a handover is outstanding. `msg.sender` is never zero, so both states close every gate at once.

**Return Values**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | The address that may act as admin right now, or zero if nobody may |

### updateVaultAddress {#registry-updatevaultaddress}

```solidity
function updateVaultAddress(address _newVaultAddress) external returns (address)
```

Points every data bundle payment at a different vault

Owner, not admin: every payment lands here, so moving it belongs behind the upgrade delay. Device wallets read `vault` on every purchase, so one write reaches all of them.

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| _newVaultAddress | address | Address that receives payments for the data bundles from now on |

**Return Values**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | The vault address now in force |

### pause {#registry-pause}

```solidity
function pause() external
```

Stops the token purchase and pull paths on every device wallet and eSIM wallet

The admin trips it and the owner clears it: the hot key must act fast, but holding the release too would let one key freeze user funds indefinitely. The owner can also trip it, so a guardian can pause through `ProtocolAdmin` while the admin is suspended. A pause never reaches a wallet owner's own `execute`, so users can still spend their ETH.

### unpause {#registry-unpause}

```solidity
function unpause() external
```

Clears the pause

Owner only, see `pause`

### requireNotPaused {#registry-requirenotpaused}

```solidity
function requireNotPaused() external view
```

Reverts while the protocol is paused

Wallets call this instead of reading `paused`, so the revert reason is the same everywhere.

### setDefaultPriceCapUSDCents {#registry-setdefaultpricecapusdcents}

```solidity
function setDefaultPriceCapUSDCents(uint64 _cap) external
```

Sets the price ceiling eSIM wallets fall back to when they hold none of their own

Owner, not admin: the admin is the party this limits. Zero is refused because it reads as "no ceiling" in `ESIMWallet._requirePriceWithinCap` for wallets without their own.

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| _cap | uint64 | Maximum price in USD cents, non-zero |

### setDefaultAdminAllowanceUSDCents {#registry-setdefaultadminallowanceusdcents}

```solidity
function setDefaultAdminAllowanceUSDCents(uint64 _allowance) external
```

Sets the admin allowance new eSIM wallets start with

Owner, not admin: the admin is the party this limits. Existing wallets keep theirs.

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| _allowance | uint64 | Total the admin may charge each new eSIM wallet, in USD cents |

### setPaymentAdapter {#registry-setpaymentadapter}

```solidity
function setPaymentAdapter(address _paymentAdapter) external
```

Points this registry at the payment adapter

Owner, not admin: the adapter decides where money goes. Spent payment references live on this registry, so they survive a swap.

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| _paymentAdapter | address | Address of the payment adapter |

### consumePaymentReference {#registry-consumepaymentreference}

```solidity
function consumePaymentReference(bytes32 _paymentReference) external
```

Spends a payment reference for an eSIM wallet paying with an accepted ERC-20

Scoped to `msg.sender`, so this and `recordSettledPurchase` cannot spend the same reference once on each for the same wallet.

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| _paymentReference | bytes32 | Hash tying the purchase to the offchain order behind it |

### recordSettledPurchase {#registry-recordsettledpurchase}

```solidity
function recordSettledPurchase(address _eSIMWallet, struct DataBundleDetails _dataBundleDetail, bytes32 _asset, uint256 _tokenAmount, bytes32 _paymentReference) external
```

Records a data bundle paid for through an external wallet or a card

No money moves here. The admin's claim is bounded by the price cap, a once-only payment reference, and a settlement other than `DeviceWallet`. Written here, not by the adapter, because eSIM wallets accept history only from this address.

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| _eSIMWallet | address | Wallet the purchase belongs to |
| _dataBundleDetail | struct DataBundleDetails | The purchase, priced in USD cents like everywhere else |
| _asset | bytes32 | Symbol of the currency the user paid in |
| _tokenAmount | uint256 | What the user actually paid, in that currency's smallest unit. Recorded        for offchain matching, never checked: it and the price both come from the admin. |
| _paymentReference | bytes32 | Hash tying this purchase to its offchain payment intent |

### requireLazyHistoryCopied {#registry-requirelazyhistorycopied}

```solidity
function requireLazyHistoryCopied(address _eSIMWallet) external view
```

Refuses a new entry while older history is still waiting to be copied in

Otherwise the new entry lands before the older ones and the history is out of order. Enforced here because the backend retries whole steps on failure. External so wallets can run it on their own paths that see the money move.

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| _eSIMWallet | address | Wallet being appended to |

### updateDeviceWalletInfo {#registry-updatedevicewalletinfo}

```solidity
function updateDeviceWalletInfo(address _deviceWallet, string _deviceUniqueIdentifier, bytes32[2] _deviceWalletOwnerKey) external
```

Records a device wallet the factory has just deployed

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| _deviceWallet | address | Address of the device wallet |
| _deviceUniqueIdentifier | string | String unique identifier associated with the device wallet |
| _deviceWalletOwnerKey | bytes32[2] | X,Y co-ordinates of the P256 key owning the wallet |

### updateDeviceWalletOwnerKey {#registry-updatedevicewalletownerkey}

```solidity
function updateDeviceWalletOwnerKey(bytes32[2] _newOwnerKey) external
```

Called by a device wallet when the P256 key that owns it is replaced

Without this the registry keeps the retired key and the new one could be claimed by a second wallet, breaking one key to one wallet. The key must be the one the wallet holds, or a wallet could claim a stranger's key through `execute` and block them registering.

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| _newOwnerKey | bytes32[2] | X,Y co-ordinates of the P256 key taking over |

### requireDeviceIdentifierNotReserved {#registry-requiredeviceidentifiernotreserved}

```solidity
function requireDeviceIdentifierNotReserved(string _deviceUniqueIdentifier) external view
```

Refuses a device identifier a fiat user's eSIMs are already waiting on

Called by the ordinary deploy route. Taking such an identifier strands the lazy user: history copy, wallet deploy and device switch all refuse an identifier with a wallet. Passes while `lazyWalletRegistry` is unset, since nothing can be reserved before then.

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| _deviceUniqueIdentifier | string | Identifier the caller is about to take |

### bindESIMWallet {#registry-bindesimwallet}

```solidity
function bindESIMWallet(address _eSIMWalletAddress, address _deviceWalletAddress) external
```

Binds an eSIM wallet to the calling device wallet and settles any outstanding transfer

The only writer of the association, which once set always names a device wallet, so zero is refused; a release raises standby via `toggleESIMWalletStandbyStatus` instead. Authorization reads `ESIMWallet.owner()` because the association can lag behind an accepted ownership transfer. Standby is cleared here since both facts change together.

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| _eSIMWalletAddress | address | Address of the eSIM wallet |
| _deviceWalletAddress | address | The device wallet taking it on, which must be the caller |

### assignESIMIdentifier {#registry-assignesimidentifier}

```solidity
function assignESIMIdentifier(address _eSIMWalletAddress, string _eSIMUniqueIdentifier) external returns (string)
```

Binds an eSIM identifier to an eSIM wallet and writes it onto the wallet

Admin only: which identifier a wallet is owed is known offchain, and a device wallet could fake any onchain proof through `execute`. Reserved identifiers are refused even on their own device, because the lazy route assigns them and taking one strands that batch.

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| _eSIMWalletAddress | address | Wallet receiving the identifier |
| _eSIMUniqueIdentifier | string | Identifier being assigned |

**Return Values**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | string | The identifier now on the wallet |

### toggleESIMWalletStandbyStatus {#registry-toggleesimwalletstandbystatus}

```solidity
function toggleESIMWalletStandbyStatus(address _eSIMWalletAddress, bool _isOnStandby) public
```

Marks an eSIM wallet as being moved from one device wallet to another, or cancels that

Only the flag moves; the association keeps naming the last device wallet, so raising standby on a wallet the caller still holds is normal. Authorization reads `ESIMWallet.owner()` for the same reason as `bindESIMWallet`.

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| _eSIMWalletAddress | address | Address of the eSIM wallet |
| _isOnStandby | bool | True while a transfer is outstanding, false once it is settled or revoked |

### addOrUpdateLazyWalletRegistryAddress {#registry-addorupdatelazywalletregistryaddress}

```solidity
function addOrUpdateLazyWalletRegistryAddress(address _lazyWalletRegistry) public returns (address)
```

Points the registry at the lazy wallet registry, which is deployed after it

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| _lazyWalletRegistry | address | Address of the lazy wallet registry |

**Return Values**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | The address now in force |

### renounceOwnership {#registry-renounceownership}

```solidity
function renounceOwnership() public pure
```

Ownership of this contract is never renounced

The owner is the only upgrade route, so renouncing would freeze this logic for good.

### _authorizeUpgrade {#registry-_authorizeupgrade}

```solidity
function _authorizeUpgrade(address newImplementation) internal
```

Restricts UUPS upgrades to the owner

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| newImplementation | address | Address of the implementation being moved to |

### upgradeManager {#registry-upgrademanager}

```solidity
function upgradeManager() public view returns (address)
```

Address (owned/controlled by eSIM wallet project) that can upgrade contracts

Reads through to the owner, which `_authorizeUpgrade` checks, since a separate copy could only disagree with it.

**Return Values**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | The address that may upgrade this contract |
<!-- docgen:end -->

<!-- docgen:start source=smart-contract-suite/docs/RegistryHelper.md -->
## RegistryHelper {#registryhelper}

Storage and the lazy deployment paths that `Registry` inherits

Of the external functions here, the deploy and history ones are callable only by the lazy wallet registry; the rest are public reads.

### lazyWalletRegistry {#registryhelper-lazywalletregistry}

```solidity
address lazyWalletRegistry
```

Address of the Lazy wallet registry

### deviceWalletFactory {#registryhelper-devicewalletfactory}

```solidity
contract DeviceWalletFactory deviceWalletFactory
```

Device wallet factory instance

### eSIMWalletFactory {#registryhelper-esimwalletfactory}

```solidity
contract ESIMWalletFactory eSIMWalletFactory
```

eSIM wallet factory instance

### uniqueIdentifierToDeviceWallet {#registryhelper-uniqueidentifiertodevicewallet}

```solidity
mapping(string => address) uniqueIdentifierToDeviceWallet
```

Device wallet recorded for each device identifier, zero if unused

### deviceWalletToOwner {#registryhelper-devicewallettoowner}

```solidity
mapping(address => bytes32[2]) deviceWalletToOwner
```

X,Y co-ordinates of the P256 keys associated with the device wallet

### registeredP256Keys {#registryhelper-registeredp256keys}

```solidity
mapping(bytes32 => address) registeredP256Keys
```

Device wallet registered under each owner key hash, `keccak256(abi.encode(X, Y))`

Keeps one P256 key to one device wallet.

### isDeviceWalletValid {#registryhelper-isdevicewalletvalid}

```solidity
mapping(address => bool) isDeviceWalletValid
```

True for every device wallet the registry has recorded

### isESIMWalletValid {#registryhelper-isesimwalletvalid}

```solidity
mapping(address => address) isESIMWalletValid
```

Device wallet each protocol eSIM wallet is bound to, zero if not a protocol wallet

Non-zero for the wallet's whole life; mid-transfer it names the last device wallet, never zero for "released". `bindESIMWallet`, the only writer, checks the factory deployed it.

### isESIMWalletOnStandby {#registryhelper-isesimwalletonstandby}

```solidity
mapping(address => bool) isESIMWalletOnStandby
```

True while an eSIM wallet sits between device wallets, released by one and not yet taken on by another

A marker for offchain readers, not a gate. Gating spend on it would brick a wallet its device wallet just removed, since `removeESIMWallet` raises it whether or not a transfer follows. Use `isESIMWalletValid` to ask whether a wallet belongs to the protocol.

### claimedESIMIdentifiers {#registryhelper-claimedesimidentifiers}

```solidity
mapping(bytes32 => address) claimedESIMIdentifiers
```

The eSIM wallet holding each eSIM identifier, protocol-wide

Stops two wallets, one per deploy route, taking the same identifier. Written once and never cleared, even on ownership transfer, since the eSIM belongs to the wallet.

### LazyWalletDeployed {#registryhelper-lazywalletdeployed}

```solidity
event LazyWalletDeployed(address _deviceWallet, string _deviceUniqueIdentifier, address _eSIMWallet, string _eSIMUniqueIdentifier)
```

Emitted for each eSIM wallet deployed on behalf of the lazy wallet registry

### DeviceWalletInfoUpdated {#registryhelper-devicewalletinfoupdated}

```solidity
event DeviceWalletInfoUpdated(address _deviceWallet, string _deviceUniqueIdentifier, bytes32[2] _deviceWalletOwnerKey)
```

Emitted when a device wallet is first recorded, with its identifier and owner key

### DeviceWalletOwnerKeyUpdated {#registryhelper-devicewalletownerkeyupdated}

```solidity
event DeviceWalletOwnerKeyUpdated(address _deviceWallet, bytes32[2] _oldOwnerKey, bytes32[2] _newOwnerKey)
```

Emitted when a device wallet rotates the P256 key that owns it

### ESIMIdentifierClaimed {#registryhelper-esimidentifierclaimed}

```solidity
event ESIMIdentifierClaimed(bytes32 _hashOfESIMIdentifier, string _eSIMUniqueIdentifier, address _eSIMWallet)
```

Emitted the first and only time an eSIM identifier is bound to an eSIM wallet

The string is also carried unindexed, since an indexed string keeps only its hash.

### UpdatedDeviceWalletAssociatedWithESIMWallet {#registryhelper-updateddevicewalletassociatedwithesimwallet}

```solidity
event UpdatedDeviceWalletAssociatedWithESIMWallet(address _eSIMWalletAddress, address _deviceWalletAddress)
```

Emitted when an eSIM wallet is bound to a device wallet

### UpdatedLazyWalletRegistryAddress {#registryhelper-updatedlazywalletregistryaddress}

```solidity
event UpdatedLazyWalletRegistryAddress(address _lazyWalletRegistry)
```

Emitted when the owner points the registry at the lazy wallet registry

### RegistryInitialized {#registryhelper-registryinitialized}

```solidity
event RegistryInitialized(address _eSIMWalletAdmin, address _vault, address _upgradeManager, address _deviceWalletFactory, address _eSIMWalletFactory)
```

Emitted once, when the registry is initialised

### AdminUpdateRequested {#registryhelper-adminupdaterequested}

```solidity
event AdminUpdateRequested(address eSIMWalletAdmin, address _newAdmin)
```

Emitted when the owner nominates a new address for the admin role

The role goes dormant here: the incumbent is powerless until the nominee accepts.

### AdminUpdated {#registryhelper-adminupdated}

```solidity
event AdminUpdated(address _newAdmin)
```

Emitted when the newly requested admin accepts the role

### AdminUpdateRevoked {#registryhelper-adminupdaterevoked}

```solidity
event AdminUpdateRevoked(address _caller, address _revokedAddress)
```

Emitted when the owner withdraws an outstanding nomination

### AdminDisabled {#registryhelper-admindisabled}

```solidity
event AdminDisabled(address _adminOfRecord, address _caller)
```

Emitted when the admin's powers are suspended, naming the address left on the books

### AdminEnabled {#registryhelper-adminenabled}

```solidity
event AdminEnabled(address _adminOfRecord, address _caller)
```

Emitted when a suspended admin is given its powers back

### VaultAddressUpdated {#registryhelper-vaultaddressupdated}

```solidity
event VaultAddressUpdated(address _updatedVaultAddress)
```

Emitted when the owner points data bundle payments at a different vault

### Paused {#registryhelper-paused}

```solidity
event Paused(address _admin)
```

Emitted when the admin or owner stops the guarded purchase and pull paths

### Unpaused {#registryhelper-unpaused}

```solidity
event Unpaused(address _owner)
```

Emitted when the owner releases the pause

### DefaultPriceCapUSDCentsUpdated {#registryhelper-defaultpricecapusdcentsupdated}

```solidity
event DefaultPriceCapUSDCentsUpdated(uint64 _cap)
```

Emitted when the owner changes the price ceiling eSIM wallets fall back to

### DefaultAdminAllowanceUSDCentsUpdated {#registryhelper-defaultadminallowanceusdcentsupdated}

```solidity
event DefaultAdminAllowanceUSDCentsUpdated(uint64 _allowance)
```

Emitted when the admin allowance new eSIM wallets start with is set

### PaymentAdapterUpdated {#registryhelper-paymentadapterupdated}

```solidity
event PaymentAdapterUpdated(address _paymentAdapter)
```

Emitted when the owner points the registry at a payment adapter

### PaymentReferenceConsumed {#registryhelper-paymentreferenceconsumed}

```solidity
event PaymentReferenceConsumed(address _eSIMWallet, bytes32 _paymentReference)
```

Emitted when a payment reference is spent for an eSIM wallet

### DataBundleSettled {#registryhelper-databundlesettled}

```solidity
event DataBundleSettled(address _eSIMWallet, bytes32 _dataBundleID, uint64 _priceUSDCents, enum Settlement _settlement, bytes32 _asset, address _token, uint256 _tokenAmount, bytes32 _paymentReference)
```

Emitted for a purchase paid for outside the protocol

On the registry so an indexer follows one address. `_tokenAmount` is unchecked: it and the price both come from the admin.

### ESIMWalletSetOnStandby {#registryhelper-esimwalletsetonstandby}

```solidity
event ESIMWalletSetOnStandby(address _eSIMWalletAddress, bool _isOnStandby, address _deviceWalletAddress)
```

Emitted when an eSIM wallet's outstanding transfer is raised or settled

### onlyLazyWalletRegistry {#registryhelper-onlylazywalletregistry}

```solidity
modifier onlyLazyWalletRegistry()
```

Restricts a call to the lazy wallet registry

### deployLazyWallet {#registryhelper-deploylazywallet}

```solidity
function deployLazyWallet(bytes32[2] _deviceWalletOwnerKey, string _deviceUniqueIdentifier, uint256 _salt, string[] _eSIMUniqueIdentifiers, uint256 _depositAmount) external payable returns (address, address[])
```

Allow LazyWalletRegistry to deploy a device wallet and its first eSIM wallets

History is copied later via `populateLazyHistory`, so gas here does not grow with both eSIM count and history size. Later batches go through `deployMoreLazyESIMWallets`. The lazy wallet registry reserves the whole salt range first, so no salt bound is needed.

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| _deviceWalletOwnerKey | bytes32[2] | P256 public key of user |
| _deviceUniqueIdentifier | string | Unique device identifier associated with the device |
| _salt | uint256 | CREATE2 salt the device wallet and its first eSIM wallet are deployed at |
| _eSIMUniqueIdentifiers | string[] | First batch of eSIM identifiers, in the order the full list holds them |
| _depositAmount | uint256 | ETH forwarded to the new device wallet |

**Return Values**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | The device wallet address |
| [1] | address[] | The eSIM wallet addresses this call deployed |

### deployMoreLazyESIMWallets {#registryhelper-deploymorelazyesimwallets}

```solidity
function deployMoreLazyESIMWallets(address _deviceWallet, string _deviceUniqueIdentifier, uint256 _baseSalt, uint256 _startIndex, string[] _eSIMUniqueIdentifiers) external returns (address[])
```

Deploys the next batch of eSIM wallets for a device the lazy registry already set up

Separate from `deployLazyWallet`, whose key, salt and deposit belong to the one-time device deploy (the key may have rotated since). The salt continues from earlier batches, since a repeat would land CREATE2 on an address that already holds a wallet.

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| _deviceWallet | address | Device wallet the new eSIM wallets are bound to |
| _deviceUniqueIdentifier | string | Device identifier the wallets belong to |
| _baseSalt | uint256 | Salt the device's deployment started from |
| _startIndex | uint256 | Position of this batch's first identifier in the device's full list |
| _eSIMUniqueIdentifiers | string[] | This batch's identifiers, in the order the full list holds them |

**Return Values**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address[] | Addresses of the eSIM wallets this call deployed |

### populateLazyHistory {#registryhelper-populatelazyhistory}

```solidity
function populateLazyHistory(address _eSIMWallet, struct DataBundleDetails[] _dataBundleDetails) external
```

Forwards one batch of pre-deployment purchase history to an eSIM wallet on behalf of the lazy wallet registry

Routed through here because eSIM wallets accept history from this contract only. The lazy wallet registry decides which entries each batch carries.

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| _eSIMWallet | address | Wallet receiving the batch |
| _dataBundleDetails | struct DataBundleDetails[] | One batch of data bundle purchase details |

### _deployLazyESIMWallet {#registryhelper-_deploylazyesimwallet}

```solidity
function _deployLazyESIMWallet(address _deviceWallet, string _deviceUniqueIdentifier, uint256 _salt, string _eSIMUniqueIdentifier) internal returns (address)
```

Deploys one eSIM wallet, binds it to the device wallet and sets its eSIM identifier

Shared by every batch so they cannot drift apart. The identifier is known up front on this route, so setting it here saves the admin a transaction per wallet.

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| _deviceWallet | address | Device wallet the eSIM wallet is bound to |
| _deviceUniqueIdentifier | string | Device identifier the wallet belongs to |
| _salt | uint256 | CREATE2 salt for this eSIM wallet |
| _eSIMUniqueIdentifier | string | Identifier written onto the new eSIM wallet |

**Return Values**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | Address of the eSIM wallet deployed |

### _assignESIMIdentifier {#registryhelper-_assignesimidentifier}

```solidity
function _assignESIMIdentifier(address _eSIMWalletAddress, string _eSIMUniqueIdentifier) internal returns (string)
```

Records an eSIM identifier against a wallet and writes it onto the wallet

Internal so a device wallet cannot claim through `execute` a string someone else bought; `Registry.assignESIMIdentifier` is the admin's way in. Claims before writing the wallet, whose slot is set once, so a failed claim never strands an identifier there.

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| _eSIMWalletAddress | address | Wallet receiving the identifier |
| _eSIMUniqueIdentifier | string | Identifier being assigned |

**Return Values**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | string | The identifier now on the wallet |

### _claimESIMIdentifier {#registryhelper-_claimesimidentifier}

```solidity
function _claimESIMIdentifier(string _eSIMUniqueIdentifier, address _eSIMWalletAddress, address _deviceWallet) internal
```

Records the wallet holding an eSIM identifier, refusing a second holder

A reservation is compared against the device wallet's own identifier rather than refused outright, since the lazy route claims against its own reservation.

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| _eSIMUniqueIdentifier | string | Identifier being claimed |
| _eSIMWalletAddress | address | Wallet claiming it |
| _deviceWallet | address | Device wallet holding that eSIM wallet |

### _updateDeviceWalletInfo {#registryhelper-_updatedevicewalletinfo}

```solidity
function _updateDeviceWalletInfo(address _deviceWallet, string _deviceUniqueIdentifier, bytes32[2] _deviceWalletOwnerKey) internal
```

Records a device wallet against its identifier and its owner key

Writes all four mappings together, so a wallet is either fully recorded or not recorded.

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| _deviceWallet | address | Address of the device wallet |
| _deviceUniqueIdentifier | string | Identifier the wallet is reached by |
| _deviceWalletOwnerKey | bytes32[2] | X,Y co-ordinates of the P256 key owning the wallet |

### _updateDeviceWalletOwnerKey {#registryhelper-_updatedevicewalletownerkey}

```solidity
function _updateDeviceWalletOwnerKey(address _deviceWallet, bytes32[2] _newOwnerKey) internal
```

Moves a device wallet's registry bindings from its current owner key to a new one

The old key comes from storage, not the caller, so a wallet cannot free someone else's key. Clearing it before the check lets a wallet rotate onto the key it already holds.

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| _deviceWallet | address | Wallet whose owner key is rotating |
| _newOwnerKey | bytes32[2] | X,Y co-ordinates of the P256 key taking over |

### isDeviceIdentifierAlreadyUsed {#registryhelper-isdeviceidentifieralreadyused}

```solidity
function isDeviceIdentifierAlreadyUsed(string _deviceUniqueIdentifier) public view returns (bool)
```

Whether a device identifier already has a wallet recorded against it

Covers both deploy routes, so each can refuse an identifier the other already used.

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| _deviceUniqueIdentifier | string | Device identifier being checked |

**Return Values**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | True if the identifier is taken |

### eSIMWalletForIdentifier {#registryhelper-esimwalletforidentifier}

```solidity
function eSIMWalletForIdentifier(string _eSIMUniqueIdentifier) public view returns (address)
```

The eSIM wallet holding an eSIM identifier, or zero if nobody holds it

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| _eSIMUniqueIdentifier | string | eSIM identifier being looked up |

**Return Values**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | The wallet that claimed it |

### isESIMIdentifierClaimed {#registryhelper-isesimidentifierclaimed}

```solidity
function isESIMIdentifierClaimed(string _eSIMUniqueIdentifier) public view returns (bool)
```

Whether an eSIM identifier is already held by a wallet

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| _eSIMUniqueIdentifier | string | eSIM identifier being checked |

**Return Values**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | True if the identifier is taken |
<!-- docgen:end -->
