---
title: ESIMWallet
description: The Kokio wallet that stands for one eSIM, holding its data bundle purchase history, its spending ceiling, and the funds moving through it.
---

# eSIM wallet {#esim-wallet}

An eSIM wallet is one eSIM's account in the Kokio [suite](./overview.md). It holds that eSIM's purchase history, the ceiling on what may be charged for a single data bundle, and whatever funds are passing through it on the way to paying for one.

Its owner is always a [device wallet](./device-wallet.md), never a key. That is unusual and it is the security property the whole design rests on: every call that moves ETH or changes ownership arrives through a device wallet `execute`, which means it has already been signed for by the user's passkey. There is no key that can act on an eSIM wallet directly.

## What the admin can and cannot do {#what-the-admin-can-and-cannot-do}

Kokio's admin can charge this wallet for a data bundle. It cannot raise the ceiling that limits what it may charge.

`priceCapUSDCents` is that ceiling, in US cents, and only the owning device wallet can set it. Zero means "follow the [Registry's](./registry.md) default", not "no ceiling". Beyond the cap, the money still only moves if the device wallet has granted this wallet access to its funds, so a charge needs the user to have said yes twice: once to the access and once to the cap.

## Buying a data bundle {#buying-a-data-bundle}

`buyDataBundleWithToken` takes the bundle, the currency symbol, the most the buyer will spend, and a payment reference. The [PaymentAdapter](./payment-adapter.md) works out what the price in US cents comes to in that currency, so there is never a second figure to take on trust, and anything unspent comes back. A shortfall is pulled from the device wallet.

The payment reference is spent once. Retrying a call that already landed cannot charge the user a second time.

A token that delivers less than it was asked to transfer, such as a fee-on-transfer token, fails at the adapter's funding check with a readable reason. The protocol does not support such tokens otherwise, because the vault still has to receive the price in full.

## Reading the purchase history {#reading-the-purchase-history}

`transactionHistory` is a public array of `DataBundleDetails`, described on the [types](./types.md) page. Solidity generates an indexed getter for a public array but not a length getter, so `transactionHistory(0)`, `transactionHistory(1)` and so on work while there is no `transactionHistory.length` to call.

Reading the whole history therefore means one of two things: index upwards until the call reverts, or read the `DataBundleBoughtWithToken` and `DataBundleSettlementRecorded` events from the logs, which is cheaper and carries a timestamp the struct does not store. The [Kokio SDK](../sdk/mobile/esim-wallet.md) does the second.

Each entry records how the bundle was paid for, in a `Settlement` field with three values: paid from this wallet onchain, paid from an external wallet, or paid in fiat. Only the first can be proven onchain. The other two are the admin's word, which is why the price cap applies to them as well.

## A beacon proxy {#a-beacon-proxy}

Every eSIM wallet is a beacon proxy deployed by [`ESIMWalletFactory`](./esim-wallet-factory.md), and they all follow one beacon. One upgrade moves every eSIM wallet in the protocol at once, with no per-wallet opt-out. The beacon's owner is the [`ProtocolAdmin`](./protocol-admin.md) timelock.

<!-- docgen:start source=smart-contract-suite/docs/esim-wallet/ESIMWallet.md -->
## ESIMWallet {#esimwallet}

One eSIM, its purchase history, and the funds that move through it while it buys data bundles

A beacon proxy deployed by `ESIMWalletFactory`, always owned by a device wallet. The owner is a contract rather than a key, so every call that moves ETH or ownership arrives through a device wallet `execute` and has already been signed for. The admin can charge this wallet for a data bundle but cannot raise the ceiling that limits what it may charge.

### eSIMWalletFactory {#esimwallet-esimwalletfactory}

```solidity
address eSIMWalletFactory
```

Address of the eSIM wallet factory contract

### eSIMUniqueIdentifier {#esimwallet-esimuniqueidentifier}

```solidity
string eSIMUniqueIdentifier
```

String identifier to uniquely identify eSIM wallet

### deviceWallet {#esimwallet-devicewallet}

```solidity
contract DeviceWallet deviceWallet
```

Device wallet contract instance associated with this eSIM wallet

### transactionHistory {#esimwallet-transactionhistory}

```solidity
struct DataBundleDetails[] transactionHistory
```

Array of all the data bundle purchase

### newRequestedOwner {#esimwallet-newrequestedowner}

```solidity
address newRequestedOwner
```

Address of the owner (device wallet) that becomes the new owner

### priceCapUSDCents {#esimwallet-pricecapusdcents}

```solidity
uint64 priceCapUSDCents
```

Most this wallet may be charged for one data bundle, in USD cents, or zero to follow the registry

Declared here so it shares a slot with `newRequestedOwner`. Solidity packs in declaration order, so moving this line costs that slot. A handover clears both, which is then one write instead of two. Zero means "follow the registry", not "no ceiling".

### ESIMWalletDeployed {#esimwallet-esimwalletdeployed}

```solidity
event ESIMWalletDeployed(address _eSIMWalletAddress, address _deviceWalletAddress, address _owner)
```

Emitted when the eSIM wallet is deployed

### DataBundleBoughtWithToken {#esimwallet-databundleboughtwithtoken}

```solidity
event DataBundleBoughtWithToken(bytes32 _dataBundleID, uint64 _priceUSDCents, bytes32 _asset, address _token, uint256 _amountSpent, bytes32 _paymentReference)
```

Emitted when a data bundle is paid for in USDC (or any other acceptable stablecoin/ERC20)

The adapter emits the settlement. This one is for an indexer watching one wallet.

### TokenSentToDeviceWallet {#esimwallet-tokensenttodevicewallet}

```solidity
event TokenSentToDeviceWallet(address _token, address _deviceWallet, uint256 _amount)
```

Emitted when an ERC-20 is returned to the owning device wallet

### DataBundleSettlementRecorded {#esimwallet-databundlesettlementrecorded}

```solidity
event DataBundleSettlementRecorded(bytes32 _dataBundleID, uint64 _priceUSDCents, enum Settlement _settlement)
```

Emitted when a purchase paid for outside the protocol is recorded here

The registry emits the full record. This one is for an indexer watching one wallet.

### ESIMUniqueIdentifierInitialised {#esimwallet-esimuniqueidentifierinitialised}

```solidity
event ESIMUniqueIdentifierInitialised(string _eSIMUniqueIdentifier)
```

Emitted when the eSIM unique identifier is initialised

### TransactionHistoryPopulated {#esimwallet-transactionhistorypopulated}

```solidity
event TransactionHistoryPopulated(struct DataBundleDetails[] _dataBundleDetails, uint256 _totalEntries)
```

Emitted for every batch of history the lazy wallet registry copies in after deployment. `_totalEntries` is the transaction history length once the batch has landed, which is what tells a partial copy apart from a finished one.

### ETHSent {#esimwallet-ethsent}

```solidity
event ETHSent(address _recipient, uint256 _amount)
```

Emitted when ETH moves out of this contract

### OwnershipTransferRequested {#esimwallet-ownershiptransferrequested}

```solidity
event OwnershipTransferRequested(address _currentOwner, address _newOwner)
```

Emitted when the current owner wants to transfer the ownership to a new device wallet

### OwnershipTransferRevoked {#esimwallet-ownershiptransferrevoked}

```solidity
event OwnershipTransferRevoked(address _currentOwner, address _revokedOwner)
```

Emitted when the current owner revoked the ownership transfer request

### PriceCapUSDCentsUpdated {#esimwallet-pricecapusdcentsupdated}

```solidity
event PriceCapUSDCentsUpdated(uint64 _cap)
```

Emitted when the owner sets this wallet's own price ceiling

### onlyDeviceWallet {#esimwallet-onlydevicewallet}

```solidity
modifier onlyDeviceWallet()
```

Restricts a call to the device wallet that owns this eSIM wallet

Reaching this means the owner signed for it, since a device wallet only calls out through `execute`.

### onlyRegistry {#esimwallet-onlyregistry}

```solidity
modifier onlyRegistry()
```

Restricts a call to the registry

### onlyDeviceWalletOrESIMWalletAdmin {#esimwallet-onlydevicewalletoresimwalletadmin}

```solidity
modifier onlyDeviceWalletOrESIMWalletAdmin()
```

Restricts a call to the owning device wallet or the eSIM wallet admin

### constructor {#esimwallet-constructor}

```solidity
constructor() public
```

Disables initializers on the implementation contract

`_disableInitializers` rather than an `initializer` modifier. The modifier leaves the version at 1, which a later `reinitializer(2)` would still accept on the implementation itself. This pins it at the maximum so no version can ever run there.

### initialize {#esimwallet-initialize}

```solidity
function initialize(address _eSIMWalletFactoryAddress, address _deviceWalletAddress) external
```

Binds a freshly deployed eSIM wallet to its factory and its owning device wallet

The eSIM identifier is not set here. It does not exist until the eSIM itself has been bought, so it arrives later through `setESIMUniqueIdentifier`.

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| _eSIMWalletFactoryAddress | address | eSIM wallet factory contract address |
| _deviceWalletAddress | address | Device wallet contract address (the contract that deploys this eSIM wallet) |

### setESIMUniqueIdentifier {#esimwallet-setesimuniqueidentifier}

```solidity
function setESIMUniqueIdentifier(string _eSIMUniqueIdentifier) external
```

Since buying the eSIM (along with data bundle) happens before the identifier is generated, the identifier is to be set separately after the wallet is deployed and eSIM is created

Set once, and only by the registry, which records the claim in the same call. The owning device wallet used to be the caller, which let an owner write a string the registry has no record of.

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| _eSIMUniqueIdentifier | string | String that uniquely identifies eSIM wallet |

### setPriceCapUSDCents {#esimwallet-setpricecapusdcents}

```solidity
function setPriceCapUSDCents(uint64 _cap) external
```

Sets the most this wallet may be charged for one data bundle

Only the owning device wallet, which means the person holding its P256 key: reaching this needs a device wallet `execute`, and that needs a signature. The admin names the price on `buyDataBundle`, so it must not also be able to raise the ceiling on that price. Setting zero hands the wallet back to the registry's ceiling. A handover clears it, so an incoming owner starts on the registry ceiling.

The ceiling bounds one charge and not what the admin can charge in total. Nothing limits how many purchases it makes, so a wallet holding `canPullFunds` is an open allowance over the device wallet's balance in that asset rather than a capped one.

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| _cap | uint64 | Maximum price in USD cents, or zero to follow the registry |

### populateHistory {#esimwallet-populatehistory}

```solidity
function populateHistory(struct DataBundleDetails[] _dataBundleDetails) external returns (bool)
```

Appends pre-deployment purchase history, one batch at a time, on behalf of the lazy wallet registry

The registry carries the cursor that says how much of an eSIM's history has already been copied, so this function appends whatever it is handed and does not police repeats.

Not held to the price ceiling, unlike `recordSettledPurchase`. These entries are a record of what the user already paid before any of this existed, so there is nothing here for a ceiling to bound: the ceiling limits what the admin can charge, and no charge happens on this path. Refusing an entry priced above today's ceiling would only stop true history from being written.

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| _dataBundleDetails | struct DataBundleDetails[] | One batch of data bundle purchase details from before the wallet        was deployed |

**Return Values**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | True once the batch has been appended |

### requestTransferOwnership {#esimwallet-requesttransferownership}

```solidity
function requestTransferOwnership(address _newOwner) external
```

Nominates a new device wallet to take this eSIM wallet over, in two steps

Any outstanding request is overwritten rather than refused, so an owner who nominated the wrong address just calls this again. Nominating the current owner cancels the request and re-binds the wallet to its device wallet in the same call, with ETH access left off since the flag it had before the removal is not recorded anywhere.

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| _newOwner | address | Address of the new device wallet to transfer ownership of this wallet |

### acceptOwnershipTransfer {#esimwallet-acceptownershiptransfer}

```solidity
function acceptOwnershipTransfer() external
```

Takes this eSIM wallet on, callable only by the nominated device wallet

The check compares the caller to `newRequestedOwner`, which both sides satisfy when they are zero. No transaction can arrive from the zero address, so this holds onchain, but any reasoning about this function has to exclude that caller explicitly.

### sendETHToDeviceWallet {#esimwallet-sendethtodevicewallet}

```solidity
function sendETHToDeviceWallet(uint256 _amount) external returns (uint256)
```

Allow the owner device wallet to callback all the ETH from this eSIM wallet

This function is generally called before the owner device wallet removes this eSIM wallet Deliberately not nonReentrant. removeESIMWallet calls this from inside a try/catch while requestTransferOwnership already holds this contract's guard, so guarding here would make the callback revert into that catch and strand the wallet's ETH with no error. It writes no state of its own, and only the owner can call it to move ETH to itself, so re-entering it gains nothing.

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| _amount | uint256 | Amount of ETH to be sent |

### buyDataBundleWithToken {#esimwallet-buydatabundlewithtoken}

```solidity
function buyDataBundleWithToken(struct DataBundleDetails _dataBundleDetail, bytes32 _asset, uint256 _maxAmountIn, bytes32 _paymentReference) external returns (bool)
```

Pays the vault for one data bundle in USDC (or any other acceptable stablecoin/ERC20) and records the purchase

The adapter works the amount out from the price, so there is never a second figure to take on trust. Any shortfall is pulled from the device wallet. What reaches the adapter is this wallet's real balance after the pull, not the nominal amount asked for, so a non-standard token that delivers less than requested (fee-on-transfer, deflationary) fails at `settle`'s funding check with a clear reason instead of an opaque transfer revert here. The protocol does not otherwise support such tokens: `settle` still needs the price in full.

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| _dataBundleDetail | struct DataBundleDetails | Data bundle being bought. Its settlement field is overwritten here. |
| _asset | bytes32 | Symbol of the currency to pay in |
| _maxAmountIn | uint256 | Most of that currency the buyer will spend, in its smallest unit |
| _paymentReference | bytes32 | The offchain order id. Spent once, so a retry of a call that        already landed cannot charge the user twice. |

**Return Values**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | True if the transaction is successful |

### sendTokenToDeviceWallet {#esimwallet-sendtokentodevicewallet}

```solidity
function sendTokenToDeviceWallet(address _token, uint256 _amount) external returns (uint256)
```

Sends an ERC-20 held here back to the owning device wallet

The callback on `removeESIMWallet` moves ETH only, so without this a token balance would be stranded when the wallet changes hands.

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| _token | address | ERC-20 to send back |
| _amount | uint256 | Amount in that token's smallest unit |

**Return Values**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | The amount sent |

### recordSettledPurchase {#esimwallet-recordsettledpurchase}

```solidity
function recordSettledPurchase(struct DataBundleDetails _dataBundleDetail) external
```

Appends a purchase paid for outside the protocol

No money moves here. Nothing onchain saw this payment, so the ceiling is the only limit on what the admin can write into a user's history. Checked here and not on the registry because the wallet's own ceiling lives here.

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| _dataBundleDetail | struct DataBundleDetails | The purchase to record |

### transferOwnership {#esimwallet-transferownership}

```solidity
function transferOwnership(address) public pure
```

The inherited one-step transfer is closed

Ownership moves through `requestTransferOwnership` and `acceptOwnershipTransfer`, which also keep `deviceWallet` in step with `owner()`. A one-step transfer would move only the latter.

### renounceOwnership {#esimwallet-renounceownership}

```solidity
function renounceOwnership() public pure
```

An eSIM wallet always belongs to a device wallet, so ownership is never renounced

Renouncing leaves owner() at zero while deviceWallet still points at the old device wallet. sendETHToDeviceWallet then reverts on its own zero-owner check and DeviceWallet._addESIMWallet can never accept this wallet again, so the ETH held here is unreachable for the rest of the wallet's life.

### _secureTransferOwnership {#esimwallet-_securetransferownership}

```solidity
function _secureTransferOwnership() internal
```

Completes a handover, moving `deviceWallet`, `owner()` and the price ceiling together

Clears the request before it writes anything, so a second acceptance finds nothing. The ceiling is the owner's own limit and only the owner can set it, so it goes with the owner rather than binding the incoming one to a figure it never chose.

### _transferETH {#esimwallet-_transfereth}

```solidity
function _transferETH(address _recipient, uint256 _amount) internal virtual
```

Sends ETH out of this contract, reverting if the call fails

A zero amount is a no-op rather than a revert, so callers that may have nothing to send do not need their own guard.

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| _recipient | address | Address receiving the ETH |
| _amount | uint256 | Amount in wei |

### owner {#esimwallet-owner}

```solidity
function owner() public view returns (address)
```

The device wallet that owns this eSIM wallet

Declared so subclasses and mocks have one place to override.

**Return Values**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | The owning device wallet address |

### receive {#esimwallet-receive}

```solidity
receive() external payable
```

Accepts plain ETH transfers, which is how the device wallet tops this wallet up
<!-- docgen:end -->
