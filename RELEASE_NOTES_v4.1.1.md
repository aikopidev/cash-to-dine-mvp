# CACAYO Member System v4.1.1

## UI revision
- Removed reward-type dropdowns.
- Added three large visual choices:
  - VOUCHER
  - GIFT SALDO
  - GIFT ITEM
- Gift Item is selected using image cards, not a dropdown.
- Master Gift Item is opened only when needed.
- Voucher, Gift Saldo, and Gift Item controls are separated.
- Status filters use touch-friendly buttons instead of a dropdown.

## Gift Item code-list fix
The old list RPC repeated the full Base64 item image for every generated code.
A batch of 10 item codes could create a very large response and stop the list
from rendering.

v4.1.1 uses a lightweight list RPC that returns only the item name. After
generating Gift Item codes, the page automatically opens Gift Item Control and
scrolls to the new codes.

## Dead-code cleanup
- Removed old reward admin tab/dropdown logic.
- Removed old frontend handlers `shareCampaignCode` and related list logic.
- Removed old heavy database list/copy RPCs.
- Root and staff application code remain identical.
