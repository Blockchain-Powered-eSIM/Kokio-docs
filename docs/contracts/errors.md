---
title: Custom errors
description: Every custom error the Kokio contracts revert with, grouped by the contract that raises it, with what each one means and how to decode one from a failed transaction.
---

# Custom errors {#custom-errors}

Every custom error in the Kokio [wallet suite](./overview.md) is declared in one place, `Errors`. It is an interface rather than a library, so each contract reaches them as `Errors.Name` without inheriting anything. Ninety-two of them, listed below and grouped by the contract that raises them.

If you are here because a transaction reverted, decode the selector first, then find the name in the tables.

## Decoding a revert {#decoding-a-revert}

A custom error arrives as four bytes of selector followed by the ABI-encoded arguments. The selector is the first four bytes of `keccak256` over the signature with no spaces and no parameter names, so `DataBundlePriceAboveCap(uint64,uint64)` rather than `DataBundlePriceAboveCap(uint64 priceUSDCents, uint64 cap)`.

```bash
# What selector does an error name produce
cast sig "DataBundlePriceAboveCap(uint64,uint64)"

# Decode the revert data a node handed back
cast decode-error 0x... --sig "DataBundlePriceAboveCap(uint64,uint64)"
```

The [Kokio SDK](../sdk/overview.md) does this for you. It resolves the selector against the same list and throws a `ContractRevertError` carrying the readable name, so a backend does not need a decoding table of its own.

## The ones you are most likely to hit {#the-ones-you-are-most-likely-to-hit}

| Error | What happened | What to do |
|---|---|---|
| `ProtocolPaused` | The [Registry's](./registry.md) pause flag is up, and every guarded path is stopped | Nothing you can fix. Retry once the pause is released |
| `DataBundlePriceAboveCap` | The bundle costs more than that [eSIM wallet's](./esim-wallet.md) ceiling | The wallet owner lowers the price or raises their own cap. The admin cannot raise it for them |
| `FundsAccessRevoked` | The [device wallet](./device-wallet.md) has not granted this eSIM wallet access to its funds | The user grants access with `toggleAccessToFunds` |
| `PaymentReferenceAlreadyUsed` | That order id was already spent on a purchase | The purchase went through. Read the result rather than retrying with the same reference |
| `SettlementNotFunded` | The [adapter](./payment-adapter.md) was told more was sent than actually arrived | Usually a fee-on-transfer token, which the protocol does not support. Otherwise the funding call and the settle call are not in the same transaction |
| `SettlementAboveMax` | The price came to more of the currency than the caller was willing to spend | Re-quote and retry. A stale quote is the usual cause |
| `AssetNotAllowed` | That currency symbol is not registered, or has been switched off | Read the accepted list with `resolveAsset` before building the call |
| `DeviceIdentifierAlreadyRegistered` | A [device wallet](./device-wallet-factory.md) already exists for that identifier | Look the wallet up in the registry instead of deploying a second one |
| `HistoryNotFullyCopied` | A fiat user's purchase history is still mid-copy | Keep calling until `outstandingHistoryEntries` reaches zero |
| `OnlyESIMWalletAdmin` | The caller is not the admin the registry currently recognises | Read `eSIMWalletAdmin()`. A suspended admin still appears in `adminOfRecord` |

## Raised by any contract {#raised-by-any-contract}

| Error | Meaning |
|---|---|
| `ZeroAddress(string parameter)` | An address argument was zero. The `parameter` string names which one, since a function often checks several |
| `OwnershipCannotBeRenounced()` | Every ownable contract in the suite blocks `renounceOwnership`. An owner-less UUPS proxy could never be upgraded again |
| `EmptyDeviceIdentifier()` | A device identifier was handed in empty |
| `EmptyESIMIdentifier()` | An eSIM identifier was handed in empty |
| `ArrayLengthMismatch(uint256 expected, uint256 actual)` | Parallel arrays of different lengths. Raised by [`LazyWalletRegistry`](./lazy-wallet-registry.md) and [`DeviceWalletFactory`](./device-wallet-factory.md) |

## Registry {#registry-errors}

Raised by the [Registry](./registry.md), which holds the admin role, the pause flag and the wallet records.

| Error | Meaning |
|---|---|
| `OnlyDeviceWallet()` | The caller is not a device wallet. Also raised by `ESIMWallet` |
| `OnlyDeviceWalletFactory()` | The caller is not the device wallet factory |
| `OnlyRequestedAdmin(address requestedAdmin)` | Only the nominated admin can accept the handover |
| `NotTheESIMWalletOwnerOrItsDeviceWallet(address eSIMWallet)` | The caller neither owns that eSIM wallet nor is the device wallet behind it |
| `ESIMWalletOwnershipTransferPending(address eSIMWallet, address newRequestedOwner)` | That eSIM wallet already has an ownership handover in flight |
| `NotTheAssociatedDeviceWallet(address eSIMWallet, address associatedDeviceWallet)` | The eSIM wallet belongs to a different device wallet than the caller |
| `AdminAlreadyDisabled()` | The admin is already suspended |
| `AdminNotDisabled()` | The call only makes sense on a suspended admin |
| `ProtocolPaused()` | The protocol is paused. Also raised by `DeviceWallet` and `ESIMWallet` |

These four are raised on the path for purchases paid for outside the protocol:

| Error | Meaning |
|---|---|
| `PaymentAdapterNotSet()` | No [payment adapter](./payment-adapter.md) is wired up yet |
| `PaymentAdapterUnchanged(address paymentAdapter)` | The adapter being set is the one already stored |
| `SettlementNotAsserted()` | Only `buyDataBundle` may claim the protocol saw the money move. A recorded outside purchase cannot |
| `HistoryNotFullyCopied(string eSIMIdentifier, uint256 outstanding)` | Older history is still waiting to be copied, so a new entry would land out of order |

## RegistryHelper {#registryhelper-errors}

Raised by the storage half of the Registry, which the Registry inherits, so they arrive from the same address.

| Error | Meaning |
|---|---|
| `OnlyLazyWalletRegistry()` | Only the lazy wallet registry may call the deferred deployment paths |
| `DeviceIdentifierAlreadyRegistered(string deviceIdentifier)` | A device wallet already exists for that identifier |
| `OwnerKeyAlreadyRegistered(bytes32 ownerKeyHash)` | That passkey already owns a device wallet |
| `SaltTooHigh(uint256 salt, uint256 count)` | The salt is past the number of wallets this device has |
| `DeviceWalletAlreadyExists(string deviceIdentifier, address deviceWallet)` | Deploying would overwrite a wallet already at that address |
| `NotAProtocolESIMWallet(address eSIMWallet)` | The address was not deployed by the eSIM wallet factory, so the protocol does not treat it as real |
| `DeviceIdentifierReservedForLazyWallet(string deviceIdentifier)` | The identifier belongs to a fiat user whose wallets are not deployed yet. Go through the [lazy wallet registry](./lazy-wallet-registry.md) |
| `ESIMIdentifierReservedForLazyWallet(string eSIMIdentifier)` | The same, for an eSIM identifier |
| `ESIMIdentifierAlreadyClaimed(string eSIMIdentifier, address eSIMWallet)` | That eSIM is already bound to a wallet |

## LazyWalletRegistry {#lazywalletregistry-errors}

Raised by the [lazy wallet registry](./lazy-wallet-registry.md), which holds a fiat user's purchases until their wallets exist.

| Error | Meaning |
|---|---|
| `LazyWalletAlreadyDeployed(string deviceIdentifier)` | The wallets for that device have already been deployed |
| `LazyWalletNotDeployed(string deviceIdentifier)` | The call needs wallets that have not been deployed yet |
| `IdentifierTooLong(string identifier, uint256 maxLength)` | An identifier is longer than the contract will store |
| `DepositDoesNotMatchValue(uint256 depositAmount, uint256 value)` | The ETH sent does not match the deposit the call declared |
| `NoESIMIdentifiersForDevice(string deviceIdentifier)` | That device has no eSIMs recorded against it |
| `UnknownESIMIdentifier(string eSIMIdentifier)` | No record of that eSIM identifier |
| `ESIMBoundToADifferentDevice(string eSIMIdentifier, string boundDeviceIdentifier)` | That eSIM belongs to another device. The name of the device holding it is in the error |
| `ESIMIdentifierNotFound(string eSIMIdentifier, string deviceIdentifier)` | That eSIM is not in the given device's list |
| `CannotSwitchToTheSameDevice(string deviceIdentifier)` | The move is to the device the eSIM is already on |
| `ESIMWalletNotLazyDeployed(string eSIMIdentifier)` | The eSIM wallet was not deployed through the lazy path |
| `HistoryAlreadyCopied(string eSIMIdentifier)` | That eSIM's history has already been copied onto its wallet |
| `TooManyHistoryEntries(uint256 requested, uint256 maxPerCall)` | The batch is larger than `MAX_HISTORY_ENTRIES_PER_CALL`. Split it |
| `AllESIMWalletsDeployed(string deviceIdentifier)` | Every eSIM wallet for that device is already deployed. This is the terminal condition of the deployment loop, not a fault |
| `TooManyESIMWallets(uint256 requested, uint256 maxPerCall)` | The batch is larger than `MAX_ESIM_WALLETS_PER_CALL`. Split it |

## DeviceWalletFactory {#devicewalletfactory-errors}

Raised by the [device wallet factory](./device-wallet-factory.md).

| Error | Meaning |
|---|---|
| `OnlyAdmin()` | The caller is not the eSIM wallet admin |
| `OnlyAdminOrRegistry()` | The caller is neither the admin nor the registry |
| `OnlyEntryPoint()` | Only the ERC-4337 EntryPoint may take the `createAccount` route |
| `InvalidDeviceWalletOwnerKey()` | The P-256 key pair is not a usable owner key |
| `VaultUnchanged(address vault)` | The vault being set is the one already stored |
| `EmptyBatch()` | A batch deployment was handed no entries |
| `DeviceWalletInfoAlreadyAdded(address deviceWallet)` | That wallet's registry record already exists. `postCreateAccount` runs once |
| `DeviceWalletMismatch(address deviceWallet, address derived)` | The address given does not match the one CREATE2 derives from the inputs |
| `DeviceWalletNotDeployed(address deviceWallet)` | There is no code at that address yet |

## ESIMWalletFactory {#esimwalletfactory-errors}

Raised by the [eSIM wallet factory](./esim-wallet-factory.md).

| Error | Meaning |
|---|---|
| `OnlyRegistryOrDeviceWalletFactoryOrDeviceWallet()` | Only those three may deploy an eSIM wallet |
| `OnlyDeployForSelf()` | A device wallet may only deploy eSIM wallets for itself |
| `SaltAlreadyUsed(address deviceWallet, uint256 salt)` | That salt has already produced a wallet for this device |

Both factories also raise these two:

| Error | Meaning |
|---|---|
| `RegistryAlreadySet(address registry)` | The registry address is set once and not replaced |
| `ImplementationUnchanged(address implementation)` | The beacon already points at that implementation. A no-op upgrade fails loudly rather than passing quietly |

## DeviceWallet {#devicewallet-errors}

Raised by a [device wallet](./device-wallet.md).

| Error | Meaning |
|---|---|
| `UnknownESIMWallet(address eSIMWallet)` | This device wallet has no record of that eSIM wallet |
| `FundsAccessRevoked(address eSIMWallet)` | That eSIM wallet may not pull funds from here. Grant it with `toggleAccessToFunds` |
| `FundsAccessNotGrantableAtBind(address eSIMWallet)` | Funds access cannot be granted in the same call that binds the wallet. It is a separate, deliberate decision |
| `ESIMWalletAlreadyAdded(address eSIMWallet)` | That eSIM wallet is already attached to this device |
| `ESIMWalletNotOwnedByThisDeviceWallet(address eSIMWallet, address eSIMWalletOwner)` | The eSIM wallet belongs to a different device wallet |
| `OnlyRegistryOrDeviceWalletFactoryOrOwner()` | The caller is none of those three |
| `OnlySelfOrAssociatedESIMWallet()` | The caller is neither this wallet nor one of its own eSIM wallets |
| `OnlyESIMWalletAdminOrRegistry()` | The caller is neither the admin nor the registry |
| `OnlyAssociatedESIMWallets()` | Only an eSIM wallet attached to this device may call |
| `OnlyESIMWalletAdmin()` | The caller is not the admin the registry currently recognises |

## ESIMWallet {#esimwallet-errors}

Raised by an [eSIM wallet](./esim-wallet.md).

| Error | Meaning |
|---|---|
| `OnlyRegistry()` | Only the registry may call |
| `OnlyDeviceWalletOrESIMWalletAdmin()` | The caller is neither the owning device wallet nor the admin |
| `DataBundlePriceAboveCap(uint64 priceUSDCents, uint64 cap)` | The bundle costs more than this wallet's ceiling. Only the owning device wallet can change the cap |
| `ESIMIdentifierAlreadySet(string eSIMUniqueIdentifier)` | The eSIM identifier is set once and not replaced |
| `EmptyDataBundleID()` | The bundle id is empty |
| `ZeroDataBundlePrice()` | A bundle cannot be recorded at a price of zero |
| `ZeroDataBundlePriceCap()` | A cap of zero means "follow the registry", so it cannot be set explicitly |
| `NotADeviceWallet(address account)` | An eSIM wallet's owner has to be a device wallet, and that address is not one |
| `OnlyRequestedOwner(address newRequestedOwner)` | Only the nominated owner may accept the handover |
| `UseAcceptOwnershipTransfer()` | Ownership moves in two steps here. The one-step call is blocked |

## Account4337 {#account4337-errors}

Raised by the [ERC-4337 base](./account-4337.md), and so by every device wallet through it.

| Error | Meaning |
|---|---|
| `OnlySelf()` | The account only accepts that call from itself |
| `OnlyEntryPointOrSelf()` | The caller is neither the EntryPoint nor the account itself |

## Moving value {#moving-value-errors}

Raised by both `ESIMWallet` and `DeviceWallet` when funds move.

| Error | Meaning |
|---|---|
| `FailedToTransfer()` | The transfer did not succeed |
| `InsufficientBalance(uint256 balance, uint256 amount)` | The wallet holds less than the call asked to move |
| `ZeroAmount()` | Nothing to move |
| `AssetNotTransferable(bytes32 asset)` | The currency has no token address, so nothing can be transferred in it. `USD` is one of these |

## PaymentAdapter {#paymentadapter-errors}

Raised by the [payment adapter](./payment-adapter.md).

| Error | Meaning |
|---|---|
| `EmptyAssetSymbol()` | The currency symbol is empty |
| `EmptyPaymentReference()` | The payment reference is empty |
| `AssetNotAllowed(bytes32 asset)` | The currency is registered but switched off, or never registered |
| `AssetAlreadyRegistered(bytes32 asset)` | Use `updateAsset` to change an existing entry. `registerAsset` is for new ones, so a typo cannot overwrite a live currency |
| `AssetNotRegistered(bytes32 asset)` | Nothing to update under that symbol |
| `AssetDecimalsTooLow(bytes32 asset, uint8 decimals)` | `quote` divides by 100, so fewer than two decimals loses the cents |
| `AssetDecimalsTooHigh(bytes32 asset, uint8 decimals)` | Past the ceiling `quote` overflows, and the currency could never be priced |
| `AssetNeedsSwap(bytes32 asset)` | The currency is not denominated in dollars, and there are no price feeds to convert it. Pay in a dollar-denominated asset |
| `PaymentReferenceAlreadyUsed(bytes32 paymentReference)` | That order id was already spent |
| `SettlementAboveMax(uint256 required, uint256 maxAmountIn)` | The price costs more of the currency than the buyer was willing to spend |
| `SettlementNotFunded(uint256 amountIn, uint256 balance)` | The caller has to send the tokens before calling `settle`, and sent less than it declared |
