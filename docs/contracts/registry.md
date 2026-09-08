---
title: Registry
description: The central record of the Kokio wallet suite, holding the admin address, the vault, the pause switch and the price ceiling, and tracking which device and eSIM wallets are real.
---

# Registry contract {#registry-contract}

`Registry` is the single source of truth for who is who in the Kokio [wallet suite](./overview.md), and the switchboard every wallet reads before it does anything guarded. It holds the admin address, the vault that receives payments, the pause flag and the default price ceiling, and it keeps the record of which [device wallets](./device-wallet.md) and [eSIM wallets](./esim-wallet.md) were deployed by the protocol rather than by someone imitating it.

One place, not several, and that is the point. Device wallets and eSIM wallets are beacon proxies tracked by mappings with no enumerable list, so there is no way to write a new value into each of them one by one. Every wallet reads this contract on its guarded paths instead, which means rotating the admin key or raising the pause reaches all of them in the same transaction.

## What it decides {#what-it-decides}

- **Who the admin is.** `adminOfRecord` is the address on the books. Read `eSIMWalletAdmin()` rather than that field to find out who may currently act: a suspended admin keeps its entry so the suspension can be lifted without anyone having to remember the address.
- **Whether the protocol is paused.** `pause()` is the admin's lever. Releasing it is the [timelock's](./protocol-admin.md), and a guardian can do it without waiting out the delay.
- **What a purchase may cost.** `defaultPriceCapUSDCents` is the ceiling a new eSIM wallet starts with. A user can lower their own wallet's cap; nobody can raise it for them.
- **Which wallets count.** `isDeviceWalletValid` and `isESIMWalletValid` answer for anything deployed through the two factories. A wallet deployed outside the suite is not in these mappings and every guarded path rejects it.
- **Payment references.** `usedPaymentReferences` records which offchain order ids have been spent, so a purchase call that is retried after it already landed cannot charge the user twice. It is keyed by the wallet and the reference together, so one wallet cannot burn a reference another wallet is about to use. This lives here rather than on the [payment adapter](./payment-adapter.md) so that rotating the adapter does not reset it.

## Two contracts, one deployment {#two-contracts-one-deployment}

The reference below is in two parts. `Registry` holds the admin, pause and payment logic. `RegistryHelper` holds the mappings and the lazy deployment paths, and `Registry` inherits it, so both sets of members live at the same address. Only the [lazy wallet registry](./lazy-wallet-registry.md) calls into the helper's functions directly; everything else goes through `Registry` itself.

`Registry` is a UUPS proxy owned by [`ProtocolAdmin`](./protocol-admin.md). Its address is on the [deployed addresses](./deployments.md) page, and it does not change when the implementation behind it does.

<!-- docgen:start source=smart-contract-suite/docs/Registry.md -->
## Registry {#registry}

Single source of truth for who is who in the protocol, and the switchboard the wallets read on every guarded path

Holds the admin address, the vault, the pause flag and the price ceiling in one place. Device wallets and eSIM wallets are beacon proxies tracked by mappings with no enumerable list, so there is no way to write a value into each of them: one write here is how a change reaches all of them in the same transaction.

`IPausable` and `IRegistryAdmin` are declared so the compiler checks the signatures `ProtocolAdmin` calls through them. A guardian acts with no delay, so a drift between the two would only show as a revert during an incident. What each interface leaves out is deliberate: `pause()` is the hot admin key's lever while releasing it is the timelock's, and `enableAdmin()` is absent for the same reason in reverse, so nothing invites a fast path for handing a suspended key its powers back.

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

The only copy in the protocol. `DeviceWalletFactory`, `DeviceWallet`, `ESIMWallet` and `LazyWalletRegistry` all read it from here, so rotating it below reaches every one of them in the same transaction. Holding it in more than one place is what previously let a rotation update some readers and leave the rest authorising the retired key.

Read `eSIMWalletAdmin()` rather than this to find out who may act: this is the address on the books, and it keeps naming a suspended admin so the suspension can be lifted without anyone having to remember who it was.

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

Only the owner can request the transfer. The nominated address has to accept it, and this resets once they do. While it is set the incumbent has no powers, so a handover that is never accepted leaves the role dormant rather than shared.

### paused {#registry-paused}

```solidity
bool paused
```

True while the protocol's guarded purchase and pull paths are stopped

Held here for the same reason the admin address is: device wallets and eSIM wallets are beacon proxies tracked by a mapping with no enumerable list, so there is no way to write a flag into each of them. Both already read this contract on their guarded paths, so one write here reaches every wallet in the same transaction.

### adminDisabled {#registry-admindisabled}

```solidity
bool adminDisabled
```

True while the admin's powers are suspended, leaving the address on the books

Packs into the spare bytes beside `paused`, so it costs no slot of its own. Suspension is the lever against a compromised admin key: it is instant through a guardian, while lifting it is an owner action and therefore waits. A key that could restore itself as fast as it was suspended would leave the two sides trading transactions forever.

### defaultPriceCapUSDCents {#registry-defaultpricecapusdcents}

```solidity
uint64 defaultPriceCapUSDCents
```

Most an eSIM wallet may be charged for one data bundle, in USD cents, unless it sets its own limit

Held here because there is no way to list every wallet and write into each one, so one write here is how a change reaches all of them. Never zero: both setters reject it, because zero on a wallet means "follow the registry" and would mean nothing here.

### paymentAdapter {#registry-paymentadapter}

```solidity
address paymentAdapter
```

Contract holding the accepted currencies and the spent payment references

A pointer and a setter, the same shape this registry already uses for the lazy wallet registry.

### usedPaymentReferences {#registry-usedpaymentreferences}

```solidity
mapping(bytes32 => bool) usedPaymentReferences
```

Payment references already spent, scoped per eSIM wallet

Held here rather than on the payment adapter, so replay protection survives an adapter rotation through `setPaymentAdapter` instead of resetting with it. Keyed by `keccak256(abi.encode(eSIMWallet, paymentReference))` rather than by the reference alone, so one wallet spending a reference cannot burn it for an unrelated wallet's pending settlement.

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

The hot key the backend signs with, not the owner. It can trip the pause but not release it, and cannot upgrade anything. Reads the accessor rather than the stored address, so a suspended admin is refused here for the same reason it is refused everywhere else.

### constructor {#registry-constructor}

```solidity
constructor() public
```

Disables initializers on the implementation contract

Locks the implementation contract itself. Without this, anyone can call initialize directly on the implementation and own it. The proxy is unaffected either way, but an owned implementation is a trap for any later upgrade that adds an outward call.

### initialize {#registry-initialize}

```solidity
function initialize(address _eSIMWalletAdmin, address _vault, address _upgradeManager, address _deviceWalletFactory, address _eSIMWalletFactory, contract IEntryPoint _entryPoint, uint64 _defaultPriceCapUSDCents) external
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
| _defaultPriceCapUSDCents | uint64 | Starting price ceiling in USD cents. Must be non-zero: a        zero cap, here or on a wallet's own, reads as "no ceiling" in        `ESIMWallet._requirePriceWithinCap`. |

### requestAdminUpdate {#registry-requestadminupdate}

```solidity
function requestAdminUpdate(address _newAdmin) external
```

Nominates a new admin, which strips the incumbent until the nominee accepts

Owner and not the admin, deliberately. An admin that had to nominate its own replacement could not be removed once its key was in someone else's hands, and the pause is the admin's own lever, so a compromised key could hold the protocol stopped for as long as it liked and no other key could end it.

Nominating strips the incumbent at once, through the accessor rather than through a write: a handover in flight leaves the role dormant until the nominee accepts, so the two never hold it at the same time. A rotation therefore has a gap in it, and the nomination and the acceptance belong close together.

Deliberately does not check for an existing request, so an unintended nomination is overridden by calling this again. Naming the incumbent withdraws the request and hands the powers back, which also lifts a suspension, so one call undoes either mistake.

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| _newAdmin | address | Address of the recipient to receive the admin role |

### acceptAdminUpdate {#registry-acceptadminupdate}

```solidity
function acceptAdminUpdate() external returns (address)
```

Takes up the admin role, callable only by the nominated address

Clears the suspension as well as the request. The suspension names a key, not the role, so a fresh key accepting is the end of the incident rather than something that has to be lifted separately afterwards.

**Return Values**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | Address of the new admin |

### disableAdmin {#registry-disableadmin}

```solidity
function disableAdmin() external
```

Suspends the admin's powers protocol-wide, leaving its address on the books

Every gate in the protocol reads `eSIMWalletAdmin()`, which answers zero from here on, and no transaction can arrive from the zero address, so one write closes all of them in the same transaction. The address itself is kept so the suspension can be lifted without anyone having to supply it again.

Owner gated, which is what lets `ProtocolAdmin` offer a guardian an instant route to it. Refuses a repeat rather than passing quietly: a guardian doing this during an incident should not be left believing it acted when it did not.

### enableAdmin {#registry-enableadmin}

```solidity
function enableAdmin() external
```

Hands a suspended admin its powers back

Owner only, with no instant route for anyone. Suspending is instant and restoring waits, so a compromised key cannot undo its own suspension as fast as it is applied. Reversing that would recreate the deadlock the suspension exists to break.

Does nothing for an outstanding handover, which keeps the incumbent powerless on its own. Withdraw that with `requestAdminUpdate` naming the incumbent.

### eSIMWalletAdmin {#registry-esimwalletadmin}

```solidity
function eSIMWalletAdmin() public view returns (address)
```

Admin address every gated call in the protocol is checked against

Zero while the admin is suspended or while a handover is outstanding, which is how both states close every gate at once: `msg.sender` is never zero, so no caller matches. `adminOfRecord` holds the address itself either way.

**Return Values**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | The address that may act as admin right now, or zero if nobody may |

### updateVaultAddress {#registry-updatevaultaddress}

```solidity
function updateVaultAddress(address _newVaultAddress) external returns (address)
```

Points every data bundle payment at a different vault

Owner and not admin, deliberately. This is the destination of every payment the protocol collects, so moving it is a fund-flow change and belongs behind the same delay as an upgrade rather than on the hot key that signs backend batches all day.

Device wallets read `vault` here on every purchase instead of caching it, so one write reaches all of them in the same transaction. This used to live on `DeviceWalletFactory`, which nothing on the payment path ever read, so rotating the vault there changed nothing and the real address could not be moved at all.

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

The admin trips this and the owner clears it. The admin key signs backend batches all day and is the one watching, so it needs to act without waiting; giving it the release as well would let a single hot key hold user funds indefinitely. Neither key can reach an owner's own `execute`, so a pause never stops someone spending their own ETH.

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

Device wallets and eSIM wallets call this rather than reading `paused` and reverting themselves, so the revert reason is the same wherever it comes from.

### setDefaultPriceCapUSDCents {#registry-setdefaultpricecapusdcents}

```solidity
function setDefaultPriceCapUSDCents(uint64 _cap) external
```

Sets the price ceiling eSIM wallets fall back to when they hold none of their own

Owner and not admin, deliberately. The admin is the party this ceiling constrains, so letting it raise its own limit would leave the ceiling meaningless. Zero is refused: it would read as "no ceiling" in `ESIMWallet._requirePriceWithinCap` for every wallet that has not set its own.

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| _cap | uint64 | Maximum price in USD cents, non-zero |

### setPaymentAdapter {#registry-setpaymentadapter}

```solidity
function setPaymentAdapter(address _paymentAdapter) external
```

Points this registry at the payment adapter

Owner and not admin. The adapter holds the spent payment references, so an admin that could swap it would get an empty set back and record every purchase a second time.

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| _paymentAdapter | address | Address of the payment adapter |

### consumePaymentReference {#registry-consumepaymentreference}

```solidity
function consumePaymentReference(bytes32 _paymentReference) external
```

Spends a payment reference for an eSIM wallet paying with USDC (or any other acceptable stablecoin/ERC20)

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

No money moves here. Three things bound what the admin can state: the price ceiling, the payment reference being spendable once, and the settlement not being `DeviceWallet`. Written here and not by the adapter, because eSIM wallets accept history from this address alone.

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

The new entry would land first and the older ones append after it, leaving the history out of order. The backend retries the whole onchain step on failure, so this cannot be left as an ordering rule for the caller to follow. External so a wallet can run the same check on its own paths that see the money move; `recordSettledPurchase` uses the private form since it already has this contract's own state in scope.

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| _eSIMWallet | address | Wallet being appended to |

### updateDeviceWalletInfo {#registry-updatedevicewalletinfo}

```solidity
function updateDeviceWalletInfo(address _deviceWallet, string _deviceUniqueIdentifier, bytes32[2] _deviceWalletOwnerKey) external
```

Records a device wallet the factory has just deployed

Factory only. Writes the identifier, the address and the owner key together, so the three stay consistent with each other.

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

Only the wallet itself can move its own bindings, so `msg.sender` is the subject rather than a parameter. Without this the registry keeps naming the retired key after a rotation, and the key taking over stays unregistered and can be claimed by a second wallet, which breaks the one key to one wallet rule the deploy paths enforce.

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| _newOwnerKey | bytes32[2] | X,Y co-ordinates of the P256 key taking over |

### requireDeviceIdentifierNotReserved {#registry-requiredeviceidentifiernotreserved}

```solidity
function requireDeviceIdentifierNotReserved(string _deviceUniqueIdentifier) external view
```

Refuses a device identifier a fiat user's eSIMs are already waiting on

The ordinary deployment route calls this. Taking such an identifier used to succeed and strand the lazy user: the history copy, the wallet deployment and the device switch all refuse an identifier that has a wallet.

Passes while `lazyWalletRegistry` is unset, the window between deploying this contract and wiring the two together. Nothing can be reserved before the contract holding reservations exists, so the window is empty rather than unguarded.

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| _deviceUniqueIdentifier | string | Identifier the caller is about to take |

### bindESIMWallet {#registry-bindesimwallet}

```solidity
function bindESIMWallet(address _eSIMWalletAddress, address _deviceWalletAddress) external
```

Binds an eSIM wallet to the calling device wallet and settles any outstanding transfer

The association is a registration: once the registry has named a device wallet for an eSIM wallet it always names one, and this is the only place it moves. Zero is refused for that reason, so releasing an eSIM wallet raises the standby flag through `toggleESIMWalletStandbyStatus` and leaves the association naming the last device wallet that held it.

Authorization reads `ESIMWallet.owner()` rather than the association above, because the association can still name a former device wallet after an ownership transfer has been accepted and never bound back through `addESIMWallet`.

Taking a wallet on is the one moment both facts change together, which is why the flag is cleared here rather than in a second call. Nothing else in this function reads it.

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

Admin only. Which identifier a wallet is owed is known offchain when the eSIM is bought, and no onchain check replaces that: a device wallet reaches every external function through `execute`, and any fact it could present about its own wallets is one it writes itself. The lazy route shares the same internal claim.

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

Only the flag moves here. The association is a separate fact and keeps naming the device wallet that last held the eSIM wallet, so raising standby on a wallet this caller still holds is the ordinary case rather than a contradiction.

Authorization reads `ESIMWallet.owner()` rather than the association, for the same reason as `bindESIMWallet`: the association can still name a former device wallet after an accepted transfer that was never bound back.

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

The owner is the only caller _authorizeUpgrade accepts, and there is no other route to replace this implementation. Renouncing would freeze the contract on its current logic permanently.

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

Reads through to the owner rather than holding its own copy. `_authorizeUpgrade` is gated on `onlyOwner`, so the owner is the upgrade authority by definition and a second copy could only ever disagree with it.

**Return Values**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | The address that may upgrade this contract |
<!-- docgen:end -->

<!-- docgen:start source=smart-contract-suite/docs/RegistryHelper.md -->
## RegistryHelper {#registryhelper}

Storage and the lazy deployment paths that `Registry` inherits

Split out so `Registry` holds the admin and pause logic while the mappings and the calls into the two factories live here. Only the lazy wallet registry reaches the functions in this file; everything else goes through `Registry` itself.

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

Mapping for all the device wallets deployed by the registry

Use this to check if a device identifier has already been used or not

### deviceWalletToOwner {#registryhelper-devicewallettoowner}

```solidity
mapping(address => bytes32[2]) deviceWalletToOwner
```

X,Y co-ordinates of the P256 keys associated with the device wallet

### registeredP256Keys {#registryhelper-registeredp256keys}

```solidity
mapping(bytes32 => address) registeredP256Keys
```

keccak256 hash to device wallet address

keccak256(abi.encode(X, Y)) <> device wallet address Used to maintain one-to-one relationship between P256 keys and device wallet

### isDeviceWalletValid {#registryhelper-isdevicewalletvalid}

```solidity
mapping(address => bool) isDeviceWalletValid
```

true if deployed by the registry or device wallet factory Mapping of all the device wallets deployed by the registry (or the device wallet factory) are set to true

### isESIMWalletValid {#registryhelper-isesimwalletvalid}

```solidity
mapping(address => address) isESIMWalletValid
```

All the eSIM wallets deployed using this registry are valid and mapped to their owner device wallet

This is the registration record. A non-zero entry means the protocol deployed this eSIM wallet, and it stays non-zero for the rest of the wallet's life. Mid-transfer it names the device wallet that last held it, so it is never zero to mean "released". `bindESIMWallet` is the only writer and it checks the deployment with the factory, which is what makes the first sentence true rather than assumed.

### isESIMWalletOnStandby {#registryhelper-isesimwalletonstandby}

```solidity
mapping(address => bool) isESIMWalletOnStandby
```

True while an eSIM wallet sits between device wallets, released by one and not yet taken on by another

A marker for offchain readers, not a gate: nothing in the protocol reads it, and no purchase, pull or history path is held while it is true. Gating spend on it would brick a wallet its device wallet simply removed, since `removeESIMWallet` raises it whether or not a transfer follows and only a later bind lowers it again.

`isESIMWalletValid` still names the device wallet that last held the wallet while this is true. Do not use this mapping to ask whether an eSIM wallet belongs to the protocol; that is what `isESIMWalletValid` is for.

### claimedESIMIdentifiers {#registryhelper-claimedesimidentifiers}

```solidity
mapping(bytes32 => address) claimedESIMIdentifiers
```

The eSIM wallet holding each eSIM identifier, protocol-wide

An eSIM wallet's own identifier slot is set once, but nothing stopped two wallets from being set to the same identifier, one per deployment route. This is what makes the identifier answer with a single wallet. Keyed by hash for the same reason `registeredP256Keys` is: `eSIMWalletForIdentifier` takes the string.

Written once and never cleared, including through an ownership transfer, because the eSIM belongs to the wallet rather than to whichever device is holding it.

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

The identifier is carried unindexed as well as hashed, because indexing a dynamic type stores its hash and no consumer can read the value back out of that.

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

The incumbent is powerless from here until the nominee accepts, so a reader following the admin has to treat this as the moment the role went dormant.

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

Emitted when the admin stops the protocol's guarded purchase and pull paths

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

On the registry and not the wallet, so an indexer follows one address instead of one per wallet. `_tokenAmount` is unchecked: it and the price both come from the admin.

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

Deploys the wallets and sets their identifiers only. Purchase history is copied in afterwards through `populateLazyHistory`, because carrying it here made one transaction grow with the eSIM count and each eSIM's history at the same time.

`_eSIMUniqueIdentifiers` is the first batch rather than the device's whole list, and any identifier past it reaches `deployMoreLazyESIMWallets`. The lazy wallet registry owns the cursor deciding where one batch ends and the next begins, and it reserves the whole salt range before this runs, so no bound on the salt is needed here.

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

Separate from `deployLazyWallet` because that call deploys the device wallet itself, and the owner key, salt and deposit it takes describe a one-time act. Reaching a device this way needs none of them, and repeating them would either be ignored or checked against a key the owner is free to rotate between batches.

The salt continues from where the first batch stopped rather than starting over, because the eSIM wallet factory salts CREATE2 with it and a repeat would land on an address that already holds a wallet.

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

eSIM wallets accept history from this contract and nothing else, so the copy is routed through here rather than giving them a second address to trust. The lazy wallet registry owns the cursor that decides which entries a batch carries.

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

Shared by the first batch and every batch after it so the two cannot drift apart. The identifier is known up front on this route, unlike the ordinary one, so setting it here saves the admin a second transaction per wallet.

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

Internal on purpose. Only the admin knows which identifier a wallet is owed, and a device wallet can call anything through `execute`, so an external claim let any owner take a string bought by someone else. `Registry.assignESIMIdentifier` is the way in.

Both slots are written here so they cannot disagree. Claim first: the wallet's slot is set once, so a claim failing after it would strand an identifier the registry never saw.

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

The retired key comes from `deviceWalletToOwner` rather than from the caller, so a wallet cannot name a key it never held and free someone else's reservation. Clearing the old hash before checking the new one is what lets a wallet rotate onto the key it already holds: the clear removes its own reservation, so the check sees a free slot.

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

True whichever route deployed it. Both routes have to refuse an identifier the other already used, and this contract is the only place that knows about both.

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

Takes the string so callers do not have to hash it themselves, which is the only difference from reading `claimedESIMIdentifiers` directly.

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
