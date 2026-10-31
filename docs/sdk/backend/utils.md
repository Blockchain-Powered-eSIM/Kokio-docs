---
title: Utils (backend)
description: admin.utils checks what a mined transaction paid and how far its block has settled, and builds and reads the tags that mark coupon purchases in a payment reference.
---

# Utils (backend) {#utils-backend}

Reference for `admin.utils`: check what a mined transaction paid and how settled it is, and tag coupon payment references.

---

`admin.utils`

Helpers that no Kokio contract exposes directly. Each one does work a backend would otherwise build itself from raw contract calls and events, so it can ask one question and get one answer. Nothing is signed or sent.

| Job | Methods | Network |
|---|---|---|
| Check what a mined transaction paid and how far its block has settled | [`verifyProtocolPayment`](#verifyprotocolpayment), [`verifyERC20Transfer`](#verifyerc20transfer) | One round trip each. All reads go together |
| Build and read the tags that mark coupon purchases in a payment reference | [`tagPaymentReference`](#tagpaymentreference), [`parsePaymentReference`](#parsepaymentreference) | None |

The two checks take a transaction hash or a receipt.

:::warning
A hash is the safer input when it comes from a user. A receipt is checked against the chain's block at its height, but its logs are used as given, so take it from the backend's own node.
:::

Prices are `bigint` cents, as in the contracts: `123456n` is \$1234.56.

```ts title="Issue only once finalised"
const paid = await admin.utils.verifyProtocolPayment(txHash, "USDC", eSIMWalletAddress);
if (!paid.payments.some((p) => p.paymentReference === order.paymentReference)) return;

if (paid.finality === "finalized") issueESIM(order);
else markConfirming(order, paid.blockNumber, paid.blockHash); // check again later
```

## Finality {#finality}

A block on Base can be reorged out after it is mined, taking its payment with it. Both checks report how far the transaction's block has settled:

| `finality` | Meaning | Behind the latest block on Base mainnet (measured) |
|---|---|---|
| `"latest"` | Mined, but can still be reorged out | 0 |
| `"safe"` | Batch posted to L1. Only an L1 reorg can undo it | about 1 minute |
| `"finalized"` | Batch finalized on L1. It cannot be undone | about 19 minutes |

:::warning
Issue anything that cannot be taken back, such as an eSIM, only on `"finalized"`.
:::

`"latest"` and `"safe"` are not errors. Use them to show the user that the payment is confirming, store `blockNumber` and `blockHash`, and check again later.

A receipt from a block that has since been reorged out throws `ReceiptNotCanonicalError`. Checking again by hash shows whether the payment is gone (`UnknownTransactionError`) or landed in a new block.

## verifyProtocolPayment {#verifyprotocolpayment}

Lists every purchase an eSIM wallet paid for through the protocol in one currency, within one transaction. It works for `buyDataBundleWithToken` and `buyDataBundleWithTransfer`, including several purchases in one user operation and bundler transactions that carry other users' purchases.

The values come from the contracts' own events, the payment adapter's `PaymentSettled` and the eSIM wallet's `DataBundleBoughtWithToken`. Events from other contracts are ignored.

```ts
const result = await admin.utils.verifyProtocolPayment(txHash, "USDC", eSIMWalletAddress);
// { priceUSDCents: 500n, payments: [{ paymentReference, dataBundleId, priceUSDCents: 500n, amountSpent: 5000000n, vault }],
//   finality: "finalized", blockNumber, blockHash }
```

| Name | Type | Description |
| :--- | :--- | :--- |
| transaction | `Hash \| TransactionReceipt` | The transaction to check |
| symbol | `string` | The symbol as registered on the payment adapter, case-sensitive. Converted to the `bytes32` the contracts expect |
| eSIMWallet | `Address` | The wallet that paid, not its device wallet |

With no matching purchase, `priceUSDCents` is `0n` and `payments` is empty.

| Error | Thrown when |
|---|---|
| `InvalidAddressError` | A malformed or zero address. Checked before any read |
| `InvalidSymbolError` | An empty symbol, or one over 32 bytes. Checked before any read |
| `UnknownTransactionError` | A malformed hash, or no mined transaction yet |
| `TransactionRevertedError` | The transaction reverted |
| `ReceiptNotCanonicalError` | The receipt's block was reorged out |
| `NotAProtocolESIMWalletError` | The registry does not know the address as an eSIM wallet, for example when a device wallet is passed |
| `TokenNotAcceptedError` | `reason` is `"NOT_REGISTERED"` for a symbol the adapter never had (a typo or the wrong case), or `"NOT_ONCHAIN"` for one with no token, such as `USD`. A symbol withdrawn after the payment still verifies |
| `UnmatchedPaymentEventsError` | The two events do not pair up. The current contracts never produce this |

:::warning
The payment adapter address comes from the SDK's configuration for the chain, so moving the adapter with `registry.setPaymentAdapter` needs an SDK update.
:::

Returns `Promise<ProtocolPaymentCheck>`, `{ priceUSDCents, payments, finality, blockNumber, blockHash }`. `priceUSDCents` is the total, and each payment is `{ paymentReference, dataBundleId, priceUSDCents, amountSpent, vault }`.

## verifyERC20Transfer {#verifyerc20transfer}

Adds up what one address sent another directly in any ERC-20, within one transaction. It suits tokens the protocol does not handle, or a single leg of a purchase, such as a device wallet funding its eSIM wallet.

```ts
const { priceUSDCents, amount, finality } = await admin.utils.verifyERC20Transfer(
  txHash,
  tokenAddress,
  senderAddress,
  destinationAddress,
);
```

| Name | Type | Description |
| :--- | :--- | :--- |
| transaction | `Hash \| TransactionReceipt` | The transaction to check |
| token | `Address` | The ERC-20 |
| sender | `Address` | Who sent it |
| destination | `Address` | Who received it |

Only `Transfer` events from the token itself, from `sender` to `destination`, are counted. Several transfers are added together, and amounts sent back are not subtracted. With none, both values are `0n`.

:::warning
`priceUSDCents` treats one token as one dollar and rounds down, so `1_234_567n` of a 6-decimal token is `123n`. For a token not worth a dollar, such as WETH, use `amount` (in the token's smallest unit) instead.
:::

| Error | Thrown when |
|---|---|
| `InvalidAddressError` | A malformed or zero address, or the same sender and destination |
| `UnknownTransactionError`, `TransactionRevertedError`, `ReceiptNotCanonicalError` | As for [`verifyProtocolPayment`](#verifyprotocolpayment) |
| `NotAnERC20TokenError` | The address does not answer `decimals()` and `totalSupply()`, such as an address with no code or an NFT contract. Network failures are passed on unchanged |
| `PriceOutOfRangeError` | The cents do not fit the contracts' `uint64` |

:::note
A token that moves balances without emitting `Transfer` reads as `0n`.
:::

Returns `Promise<ERC20TransferCheck>`, `{ priceUSDCents, amount, finality, blockNumber, blockHash }`.

## Fewer requests {#fewer-requests}

Each check sends five reads at once.

:::tip
With an RPC provider that limits requests, a client created with `http(rpcUrl, { batch: true })` sends them as one HTTP request.
:::

## Payment references {#payment-references}

The contracts know three ways a bundle was paid for: `DeviceWallet`, `ExternalWallet` and `Fiat`. A coupon is recorded as `Fiat` in `USD`, and its payment reference carries a tag that says so.

The backend builds a reference from its 12-byte order id, left-padded to 32 bytes, which leaves the high 20 bytes zero. The tag goes there:

| `PaymentReferenceKind` | Tag | Used for |
|---|---|---|
| `Standard` | none | Paid in full by card, external wallet or device wallet |
| `Coupon` | `0xfee0ff` | Paid in full by a coupon |
| `CouponPart` | `0xfee0ffc0de` | The coupon's share of an order split between a coupon and another payment |
| `Remainder` | `0xfee0ffba1a5ce0` | What the user paid on top of the coupon |

Every coupon tag starts with `0xfee0ff`, so a coupon purchase stands out on a block explorer.

The two lines of a split keep the same order id in the low 12 bytes, so either one leads back to the order. They still differ, which matters because the registry spends a reference only once per eSIM wallet.

:::note
The contracts never read the tag.
:::

`PaymentReferenceKind` is exported from `kokio-sdk/admin`. To record a split order in one call, see [`registry.recordSettledPurchase`](./registry.md#recordsettledpurchase).

## tagPaymentReference {#tagpaymentreference}

Writes a kind's tag into a reference built from an order id. Tag both lines of a split from the same reference.

```ts
import { pad } from "viem";
import { PaymentReferenceKind } from "kokio-sdk/admin";

const orderRef = pad("0x65f1a2b3c4d5e6f708192a3b", { size: 32 }); // 12-byte order id, left-padded

admin.utils.tagPaymentReference(orderRef, PaymentReferenceKind.CouponPart);
// 0xfee0ffc0de00000000000000000000000000000065f1a2b3c4d5e6f708192a3b
admin.utils.tagPaymentReference(orderRef, PaymentReferenceKind.Remainder);
// 0xfee0ffba1a5ce00000000000000000000000000065f1a2b3c4d5e6f708192a3b
```

| Name | Type | Description |
| :--- | :--- | :--- |
| reference | `Hex` | A 32-byte reference built from a 12-byte order id, left-padded |
| kind | `PaymentReferenceKind` | The tag to write. `Standard` returns the reference unchanged, so every order can go through this call whatever it was paid with |

The result is lowercase hex.

Every error is an `InvalidPaymentReferenceError`, with the reason in the message:

| Message | Cause |
|---|---|
| `is not 32 bytes of hex` | The input is not a 32-byte hex string |
| `has an empty order part` | The low 12 bytes are zero. The contracts refuse a zero reference, and a tag would hide that |
| `is already tagged` | The high 20 bytes are not zero. This also catches a reference not built from a 12-byte order id |

Returns `Hex`.

## parsePaymentReference {#parsepaymentreference}

Reads the kind back from a reference, along with the untagged reference it was built from. Use it on the `_paymentReference` of a `DataBundleSettled` or `DataBundleBoughtWithToken` event to find the order.

```ts
const { kind, reference } = admin.utils.parsePaymentReference(event.args._paymentReference);
if (kind === PaymentReferenceKind.Remainder) {
  // the user's share of a split order; `reference` is the order's untagged reference
}
```

Uppercase hex is accepted, and `reference` comes back lowercase. A reference with zero high bytes reads as `Standard`, so references recorded before tags existed read back unchanged.

Every error is an `InvalidPaymentReferenceError`:

| Message | Cause |
|---|---|
| `is not 32 bytes of hex` | The input is not a 32-byte hex string |
| `has an empty order part` | The low 12 bytes are zero |
| `has an unknown tag` | The high bytes hold something other than the four tags above, such as a reference not built from a 12-byte order id |

Returns `{ kind: PaymentReferenceKind; reference: Hex }`.
