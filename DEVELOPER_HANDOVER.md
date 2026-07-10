# Developer Handover Brief - Cash to Dine Beta

## Product Scope Locked
Role:
1. Owner
2. Kasir

Customer tidak login sebagai role internal. Customer hanya akses public pages:
- Join/register with gift code
- Approve transaction
- Check balance

## Must-have screens
1. Login Owner/Kasir
2. Kasir Home
3. Search Member by HP
4. Register Member + Gift Code
5. Member Detail
6. Top Up
7. Use Balance Request: input amount only
8. Waiting Approval
9. Customer Approve Transaction
10. Transaction Success
11. Owner Dashboard
12. Generate Gift Code
13. Gift Code Report
14. Transaction Report
15. Customer Balance Check

## Hard rules
- Gift Code is not Member ID.
- Gift Code = money balance.
- Gift Code must be random 8 chars.
- Gift Code one-time use only.
- Gift Code only used on new member registration.
- Member ID auto-generated.
- Search member by phone number 62xxxxxxxxxx.
- POS integration not needed for beta.
- Cashier does not need to input POS bill number in app for beta.
- Customer password must be input on customer phone when approving transaction.
- Cashier tablet only creates transaction request and waits for approval.
- No local tablet storage for real production.
- Cloud DB is source of truth.

## Split payment example
Bill: Rp120.000
Balance/Voucher used: Rp100.000
Remaining: Rp20.000
POS entry: Voucher Cash to Dine 100K + QRIS 20K
Cash to Dine entry:
- pos_bill_number
- total_bill 120000
- balance_used 100000
- remaining_payment 20000
- remaining_payment_method QRIS

## Recommended stack
- Frontend: PWA static/React/Next
- Hosting: Cloudflare Pages or Vercel
- Database/Auth/Realtime: Supabase PostgreSQL
- DNS: Cloudflare


## Update v0.3 Simple Redeem
Use Balance screen is simplified:
- No total bill input
- No POS invoice/bill number input
- Cashier only inputs voucher/saldo amount to use
- Customer approves the amount from their own phone
- Cashier validates bill/payment split manually in POS

Reason:
The app is not the POS. For beta, the POS remains the authority for bill amount and payment split.
Cash to Dine only records approved saldo/voucher usage.


## Update v0.4 QR Approval
- Waiting Approval screen now shows QR image.
- QR contains approval link only, not member password or full private data.
- Customer approval screen now shows bright alert before PIN/password.
- Deployed URL is required for real cross-device QR scan.


## Update v0.5 Balance Safety
Saldo rule locked:
- Request amount > customer balance: rejected with clear warning.
- Request amount = customer balance: allowed.
- Final balance can be Rp0.
- Final balance must never be negative.
- Approval is double-checked again when customer enters PIN.
- Supabase production must use atomic RPC / row lock for deduct balance.


## Update v0.6 Supabase Connected
Frontend actions now call Supabase RPC functions:
- mvp_staff_login
- mvp_generate_gift_code
- mvp_claim_gift_code
- mvp_search_member
- mvp_topup_member
- mvp_create_approval_request
- mvp_get_approval
- mvp_approve_balance_use
- mvp_reject_approval
- mvp_recent_transactions

Required base URL: https://xkxbmiwnufyfacviquza.supabase.co
RLS must remain enabled. Do not expose service_role key.


## Update v0.7 Cache Killer
- Removed service worker registration from index.html.
- Added Cloudflare `_headers` no-store rules.
- Replaced service-worker.js with no-cache/unregister behavior.
- Invite/approval links now include `?v=0.7.0` before hash to bypass stale cache.
- Public join page shows "Online Cloud Database • Supabase v0.7" marker.
- Generate new gift codes only after app header shows Supabase v0.7.


## Update v0.8.1 Search & Approval UX
- Fixed packaging issue from v0.8.
- Header must show `Cacayo • Supabase v0.8.1`.
- Kasir search member supports live suggestions after 7 digits.
- Requires SQL RPC `mvp_search_members(uuid, text)`.
- Customer approval screen removes PIN/buttons after successful approval and shows saldo tersisa.


## Update v0.9 Voucher Monitor
- Gift Code page is now Voucher Control Center.
- Owner can see previously generated vouchers.
- Available vouchers stay green/active.
- Used vouchers appear grey.
- Expired vouchers appear yellow.
- Owner can copy WA messages or registration links for all available vouchers.
- Requires SQL RPC `mvp_list_gift_codes(uuid)`.


## Update v1.0 Voucher Control
- Voucher list paginated: 10 voucher per page.
- Copy WA per voucher.
- Copy Link per voucher.
- Delete/void available voucher only.
- Used voucher remains grey and cannot be deleted for audit safety.
- Generate gift code moved to Supabase batch RPC for uniqueness.
- Codes are 9 characters.
- Code prefix counter: A, B, C ... Z, AA, AB, AC ... plus random suffix.
- Required SQL RPC:
  - `mvp_generate_gift_codes_batch`
  - `mvp_list_gift_codes_paged`
  - `mvp_delete_gift_code`


## Update v1.1 Voucher Lifecycle + Member Directory
Voucher lifecycle:
- Available: can copy/send to customer.
- Terdaftar / Registered: used for member registration; copy buttons hidden to prevent sending to another person.
- Claimed: member has used saldo in a transaction.
- Void: deleted before registration.

Member Directory:
- Owner can see all registered members.
- Includes Nama, No Telpon, Member ID, Saldo, Status.
- Export TXT.
- Export PDF via browser Print / Save as PDF.
- Required SQL RPC:
  - `mvp_list_members(uuid)`
  - updated `mvp_claim_gift_code`
  - updated `mvp_approve_balance_use`
  - updated voucher list/generate/delete functions


## Update v1.2 Owner Dashboard + Member Directory
- Owner dashboard now has clear KPI cards.
- Dashboard has big action cards for All Members, Voucher Control, Transaction Report, and Kasir Mode.
- Members page now uses a clearer table layout.
- Members page shows Nama, No Telpon, Member ID, Saldo, Status.
- Export TXT and PDF/Print remain available.
- Required SQL RPC:
  - `mvp_owner_dashboard_summary(uuid)`


## Update v1.3 Kasir Top Up Center
- Top Up member lama is restored and made clearer in Kasir flow.
- Kasir Home live search results now show direct buttons: Top Up and Gunakan.
- Top Up screen includes package buttons:
  - Bayar Rp1.000.000 → saldo Rp1.500.000
  - Bayar Rp500.000 → saldo Rp700.000
  - Bayar Rp250.000 → saldo Rp300.000
  - Custom
- Top up writes to Supabase via `mvp_topup_member`.
- Saldo member updates immediately in cloud.


## Update v1.4 Top Up Packages + POS Invoice
- Top Up packages changed:
  - DIAMOND: bayar Rp5.000.000 → saldo Rp10.000.000
  - GOLD: bayar Rp2.000.000 → saldo Rp3.500.000
  - SILVER: bayar Rp500.000 → saldo Rp700.000
  - CUSTOM: full manual
- Payment Method field removed.
- Kasir must input POS Invoice Number.
- Top up RPC now uses `p_invoice_number`.


## Update v1.5 Premium Top Up Cards
- Fixed blank top up package cards.
- Top up packages now have clear premium visual cards:
  - DIAMOND 💎 blue/purple premium
  - GOLD 🏆 gold
  - SILVER 🥈 silver
  - CUSTOM ✍️ manual neutral
- Active selected package is clearly highlighted.
- Top up transaction metadata now stores `package_name`.
- RPC now accepts `p_package_name`.


## Update v1.6 Simple Top Up + Customer Home
- Top up package UI simplified to clean cards; no overflow.
- Kasir package cards:
  - DIAMOND: bayar Rp5.000.000 → saldo Rp10.000.000
  - GOLD: bayar Rp2.000.000 → saldo Rp3.500.000
  - SILVER: bayar Rp500.000 → saldo Rp700.000
  - CUSTOM: manual
- After customer approves balance use, customer screen now shows:
  - saldo dipakai
  - sisa saldo
  - HOME Customer button
  - top up package info
  - instruction: Hubungi kasir untuk top up
- Added public `customer-home?token=...` route.
- Fixed missing `members` route in router.
