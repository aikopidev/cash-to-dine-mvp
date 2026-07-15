# CACAYO Member System v4.2.0 — Unified Transaction

## Staff flow
- Find one member.
- Select balance, Gift Item, or both.
- Enter one mandatory POS Bill / Invoice.
- Create one QR.
- Customer enters one PIN.
- All selected benefits are approved together.

## Atomic processing
Balance and Gift Items are processed in one PostgreSQL transaction. If the
PIN is wrong, balance is insufficient, or any selected item is no longer
available, no partial redemption occurs.

## Multiple Gift Items
The cashier selects quantities. When the member owns multiple copies of an
item, the frontend chooses the entitlements with the earliest expiry first.

## History
The approved transaction creates:
- one `use_balance` row when balance is used
- one `gift_item_redeem` row for every redeemed entitlement

All rows share the same unified reference and POS invoice.

## Cleanup
Separate balance approval and separate Gift Item approval screens are removed.
Their legacy executable RPC endpoints are dropped by the migration.
