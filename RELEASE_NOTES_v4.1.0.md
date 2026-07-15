# CACAYO Member System v4.1.0 — Gift Item

## Gift Item
- Owner creates a reusable Master Gift Item with item name, description, and photo.
- Photos are cropped to 800 × 800 px for consistent customer cards.
- Owner can generate 1–500 unique Gift Item codes from one master item.
- One code grants one item to the first eligible existing member who claims it.
- A customer may hold multiple Gift Items at the same time.
- Customer Gift Items appear as visual image cards with expiry date and day countdown.

## Secure item usage
- Cashier selects an available Gift Item from the member account.
- System creates a QR approval link.
- Customer scans the QR and approves with their own six-digit PIN.
- The item becomes REDEEMED and cannot be used again.
- Claim and redemption appear in customer, member, and daily transaction history.

## Expiry cut-off
- Existing wallet expiry timestamps are normalized to 23:59:59 Asia/Jakarta.
- New top-ups expire at 23:59:59 on the calculated date.
- Gift balance, Voucher, and Gift Item date checks use the Jakarta calendar date.
- Gift Item entitlements expire at 23:59:59 on the selected ED.
