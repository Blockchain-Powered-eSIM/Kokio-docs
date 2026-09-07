---
title: PaymentAdapter
description: The one place in Kokio where a price in US cents becomes an amount of a token, holding the accepted currencies, paying the vault, and spending each payment reference once.
---

# Payment adapter {#payment-adapter}

`PaymentAdapter` holds the currencies Kokio accepts, converts a price into one of them, moves the tokens to the vault, and spends each payment reference once. It is the money path of the [wallet suite](./overview.md), and it is the only contract in it that touches a token amount.

That last part is the design. Prices cross every other contract boundary in US cents and nothing else, so a decimals mismatch is not something to be checked for anywhere; there is one place a cent figure becomes a token amount, and it is here. Tokens pass through in a single call and never rest in this contract.

## Prices are whole US cents {#prices-are-whole-us-cents}

Every price in the protocol is a `uint64` of whole US cents. \$4.99 is `499`. There are no fractional cents and no floating point anywhere in the suite.

`quote(symbol, priceUSDCents)` turns that figure into an amount of one currency's smallest unit, reading the decimals from the stored asset entry rather than being told them. For a six decimal token like USDC, `499` becomes `4990000`. A currency that is not already denominated in dollars would need an exchange rate, and there are no price feeds here, so `quote` reverts rather than guessing.

`resolveAsset(symbol)` reads back a currency entry and reverts if it is not allowed, which is how a caller checks a symbol is accepted before building a transaction around it.

## Currencies {#currencies}

An asset is registered under a `bytes32` symbol, not an address, so a currency can be a token or an offchain rail. An entry is 23 bytes and fits one storage slot with nine to spare; new fields have to stay inside those nine bytes, because a second slot would move every entry in a live table.

The Base Sepolia deployment registers two. `USDC` is an ERC-20 with six decimals and settles onchain. `USD` has no token address and two decimals, and stands for a card or bank payment taken outside the contracts, recorded so the purchase history is complete either way. Both are listed on the [deployed addresses](./deployments.md) page.

`registerAsset` and `updateAsset` are owner-only, which means they run through the [`ProtocolAdmin`](./protocol-admin.md) timelock.

## Settling a purchase {#settling-a-purchase}

`settle` pays the vault out of tokens the caller has already sent to this contract in the same transaction. It takes the currency, the price in cents, the amount the caller funded, and where to send anything left over. It returns what reached the vault and what came back.

The caller funding the contract first, rather than the contract pulling from the caller, is what leaves room for a swap step to be added later without changing this signature.

One thing to know if you are extending this. `_amountIn` is the caller's word for what it sent, checked only against the balance. What stops a caller from naming more than it sent and carrying off a token somebody left here by mistake is that there is exactly one path in: an [eSIM wallet](./esim-wallet.md) going through `quote`, with no way to supply a figure of its own choosing. That property is worth keeping.

## Payment references {#payment-references}

A payment reference is an offchain order id, spent once. Retrying a purchase call that already landed cannot charge a user twice, because the second attempt finds the reference already spent.

The record of which references are spent lives on the [Registry](./registry.md), in `usedPaymentReferences`, not here. Two reasons, and both are worth knowing before you build against it. It survives an adapter rotation through `setPaymentAdapter`, where a mapping held here would reset with the contract. And it is keyed by the wallet and the reference together rather than by the reference alone, so one wallet spending a reference cannot burn it for another wallet's pending settlement.

This contract's own `usedReferences` mapping and its `consumePaymentReference` are retired. Nothing in the protocol calls them any more. They stay declared because the storage layout behind the proxy is pinned by a test and removing the slot would shift every variable below it. The contract's own header comment still describes `usedReferences` as the live replay protection; it is out of date, and the field's own comment is the accurate one.

<!-- docgen:start source=smart-contract-suite/docs/payments/PaymentAdapter.md -->
## Asset {#asset}

One currency the protocol will price a data bundle in

_23 bytes, so it fits one slot with nine to spare. New fields have to stay inside those nine bytes: a second slot moves every entry in the mapping, and a live table cannot be moved._

```solidity
struct Asset {
  bool allowed;
  bool isDollarUnit;
  uint8 decimals;
  address token;
}
```

## PaymentAdapter {#paymentadapter}

Holds the accepted currencies, converts prices, moves tokens to the vault, and spends payment references

_Prices cross contract boundaries in USD cents only, and this is the one place a cent figure becomes a token amount, so a decimals mismatch cannot happen rather than having to be checked for. There are no price feeds, so a currency not already in dollars has no conversion here. UUPS and not swappable: `usedReferences` is replay protection, and a fresh copy would re-open every reference already spent.

Tokens pass through in one call and never rest here._

### registry {#paymentadapter-registry}

```solidity
address registry
```

Registry contract address, the only caller allowed to spend a payment reference

### settlementToken {#paymentadapter-settlementtoken}

```solidity
address settlementToken
```

Currency the vault is meant to end up holding

_Nothing reads it yet. Set at initialisation anyway, so adding the swap path later needs no migration transaction on every chain._

### assets {#paymentadapter-assets}

```solidity
mapping(bytes32 => struct Asset) assets
```

Every currency the protocol will accept or record a payment in

### usedReferences {#paymentadapter-usedreferences}

```solidity
mapping(bytes32 => bool) usedReferences
```

Payment references already spent, protocol-wide

_Retired: `Registry.usedPaymentReferences` is now the live replay-protection store, kept there instead of here so it survives `setPaymentAdapter` rotating this contract out, and scoped per wallet there so one wallet cannot burn a reference for another. Left declared at this slot, unread and unwritten by the live purchase paths, because `StorageLayout.t.sol` pins it here behind the proxy and removing it would shift every variable below._

### PaymentAdapterInitialized {#paymentadapter-paymentadapterinitialized}

```solidity
event PaymentAdapterInitialized(address _registry, address _settlementToken)
```

Emitted when this contract is wired up

### AssetUpdated {#paymentadapter-assetupdated}

```solidity
event AssetUpdated(bytes32 _symbol, bool _allowed, bool _isDollarUnit, uint8 _decimals, address _token)
```

Emitted when a currency enters the vocabulary or its entry changes

### PaymentReferenceConsumed {#paymentadapter-paymentreferenceconsumed}

```solidity
event PaymentReferenceConsumed(bytes32 _paymentReference)
```

Emitted when a payment reference is spent

### PaymentSettled {#paymentadapter-paymentsettled}

```solidity
event PaymentSettled(bytes32 _symbol, address _eSIMWallet, address _vault, uint64 _priceUSDCents, uint256 _spent, uint256 _refunded)
```

Emitted when a data bundle is paid for in tokens through this contract

_One address for an indexer to watch instead of every eSIM wallet. The vault is recorded because it can be rotated, and reconciliation needs the one that was paid._

### onlyRegistry {#paymentadapter-onlyregistry}

```solidity
modifier onlyRegistry()
```

Restricts a call to the registry

### onlyProtocolESIMWallet {#paymentadapter-onlyprotocolesimwallet}

```solidity
modifier onlyProtocolESIMWallet()
```

Restricts a call to an eSIM wallet the registry has a record of

_Read from the registry on every call rather than held here, so a wallet the registry has let go cannot keep paying through this contract._

### constructor {#paymentadapter-constructor}

```solidity
constructor() public
```

Disables initializers on the implementation contract

_Locks the implementation contract itself, so nobody can initialise and own it directly._

### initialize {#paymentadapter-initialize}

```solidity
function initialize(address _registry, address _settlementToken, address _upgradeManager) external
```

Wires the adapter to the registry and names the currency the vault should hold

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| _registry | address | Registry contract address |
| _settlementToken | address | Token the vault is meant to end up holding, normally USDC |
| _upgradeManager | address | Address that owns this contract and authorises its upgrades |

### registerAsset {#paymentadapter-registerasset}

```solidity
function registerAsset(bytes32 _symbol, struct Asset _asset) external
```

Adds a currency the protocol will accept or record a payment in

_Owner and not admin. The admin names the price on every purchase, so letting it add currencies too would let it invent a token address to be paid into._

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| _symbol | bytes32 | Short ASCII symbol, "USDC" or "USD" or "TON" |
| _asset | struct Asset | The entry to write |

### updateAsset {#paymentadapter-updateasset}

```solidity
function updateAsset(bytes32 _symbol, struct Asset _asset) external
```

Changes an existing currency entry, including withdrawing it

_Separate from `registerAsset` so a typo in a new symbol cannot silently overwrite a currency already in use. Set `allowed` to false to withdraw one._

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| _symbol | bytes32 | Symbol of the currency being changed |
| _asset | struct Asset | The entry to write in its place |

### quote {#paymentadapter-quote}

```solidity
function quote(bytes32 _symbol, uint64 _priceUSDCents) external view returns (uint256 amountIn)
```

Turns a price in USD cents into an amount of one currency's smallest unit

_The only place in the protocol that does this, so there is never a second figure to check this one against. A currency not already in dollars needs a rate, and there are no price feeds here, so it reverts instead of guessing._

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| _symbol | bytes32 | Currency the price is being expressed in |
| _priceUSDCents | uint64 | Price in USD cents |

**Return Values**

| Name | Type | Description |
| ---- | ---- | ----------- |
| amountIn | uint256 | Amount in that currency's own smallest unit |

### resolveAsset {#paymentadapter-resolveasset}

```solidity
function resolveAsset(bytes32 _symbol) external view returns (struct Asset)
```

Reads back a currency entry, reverting if it is not allowed

_Callers read the token address and decimals from here rather than passing them in, so they stay the same across every record._

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| _symbol | bytes32 | Currency to read |

**Return Values**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | struct Asset | The stored entry |

### settle {#paymentadapter-settle}

```solidity
function settle(bytes32 _symbol, uint64 _priceUSDCents, uint256 _amountIn, address _refundTo) external returns (uint256 spent, uint256 refunded)
```

Pays the vault for one data bundle out of tokens the caller has already sent here

_The caller funds this contract and calls settle in the same transaction, which leaves the tokens here for a swap to be added later without changing this signature.

`_amountIn` is the caller's word for what it sent, checked only against the balance, so a caller naming more than it sent would carry off a token somebody left here by mistake. What stops that is the caller: the one path into here passes `quote`, and an eSIM wallet has no way to call this with a figure of its own choosing. Keep it that way.

A fee-on-transfer token delivers less than declared and fails the funding check.

`spent` is recomputed here from `_symbol` and `_priceUSDCents` rather than taken from the caller's own `quote()` call, so the two agree only because nothing mutates `assets[_symbol]` between the two calls in the same transaction today. Nothing structurally enforces that: a swap path or any other step that can change an asset's entry mid-transaction would need `settle` to check a value the caller's own `quote()` call committed to, not one recomputed fresh here._

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| _symbol | bytes32 | Currency being paid in |
| _priceUSDCents | uint64 | Price of the data bundle, in USD cents |
| _amountIn | uint256 | Amount the caller has funded, and the most it is willing to spend |
| _refundTo | address | Address anything unspent goes back to |

**Return Values**

| Name | Type | Description |
| ---- | ---- | ----------- |
| spent | uint256 | Amount that reached the vault |
| refunded | uint256 | What `_amountIn` came to over the price, sent back to `_refundTo` |

### consumePaymentReference {#paymentadapter-consumepaymentreference}

```solidity
function consumePaymentReference(bytes32 _paymentReference) external
```

Spends a payment reference against this adapter's own record, refusing one already spent through it

_Retired from the registry's live purchase paths; see `usedReferences`. Left callable so an adapter instance's own record still means what it says, but nothing in the protocol calls this any more._

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| _paymentReference | bytes32 | Hash tying this purchase to the offchain payment behind it |

### renounceOwnership {#paymentadapter-renounceownership}

```solidity
function renounceOwnership() public pure
```

Ownership of this contract is never renounced

_The owner is the only caller `_authorizeUpgrade` accepts and the only one that can change the list of currencies. Renouncing would freeze both for good._

### _authorizeUpgrade {#paymentadapter-_authorizeupgrade}

```solidity
function _authorizeUpgrade(address newImplementation) internal
```

Restricts UUPS upgrades to the owner

**Parameters**

| Name | Type | Description |
| ---- | ---- | ----------- |
| newImplementation | address | Address of the implementation being moved to |

### upgradeManager {#paymentadapter-upgrademanager}

```solidity
function upgradeManager() public view returns (address)
```

Address that can upgrade this contract

_Reads through to the owner rather than holding a second copy that could disagree._

**Return Values**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | The address that may upgrade this contract |
<!-- docgen:end -->
