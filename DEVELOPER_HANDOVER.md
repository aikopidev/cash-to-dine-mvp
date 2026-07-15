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


## Update v1.7 CACAYO Branding + Final Top Up Package
- Small CACAYO logo added to UI.
- Brand line updated to `CACAYO CHINESE CALIFORNIAN FUSION FOOD`.
- Top up packages updated:
  - NICKEL: bayar Rp1.000.000 → saldo Rp1.050.000, valid 2 bulan
  - SILVER: bayar Rp2.000.000 → saldo Rp2.200.000, valid 2 bulan
  - GOLD: bayar Rp3.000.000 → saldo Rp3.450.000, valid 4 bulan
  - DIAMOND: bayar Rp4.000.000 → saldo Rp4.800.000, valid 4 bulan
- CUSTOM package removed.
- Registration PIN must be exactly 6 digits.
- Customer is warned: `MOHON PIN DI INGAT / DI SCREENSHOT`.
- Top up transaction metadata stores package name and valid months.


## Update v1.8 Show Register PIN
- Registration PIN input changed from password-masked to visible text.
- PIN still must be exactly 6 digits.
- UI warns customer to remember/screenshot the PIN.
- Transaction approval PIN remains separate from this registration UI change.
- No SQL change required if v1.7 SQL already ran.


## Update v1.9 Bigger CACAYO Logo
- CACAYO logo enlarged and adjusted for landscape aspect ratio.
- Topbar logo is now more visible.
- Public/register/customer logo is larger but still clean.
- No SQL change required.


## Update v2.0 Optional Gift Code + Anti Duplicate Phone
- Registration phone number cannot be registered twice in the same outlet.
- Gift Code is optional.
- If Gift Code is empty, member is created with initial balance Rp0.
- If Gift Code is filled, normal voucher lifecycle applies: Available → Terdaftar.
- PIN remains 6 digit and visible during registration for screenshot.
- Required SQL RPC patch: `mvp_claim_gift_code` updated.


## Update v2.1 Owner Reset PIN + Delete Member
- Owner can reset member PIN via QR.
- Customer scans reset QR and creates a new 6 digit PIN.
- New PIN is visible on customer reset page so it can be screenshotted.
- Owner can delete member.
- Kasir cannot reset PIN or delete member.
- Delete member is implemented as soft delete + wallet balance set to 0, so the member disappears from search/list and cannot be used.
- Required SQL:
  - `member_pin_reset_requests` table
  - `mvp_create_pin_reset_request`
  - `mvp_get_pin_reset_request`
  - `mvp_complete_pin_reset`
  - `mvp_delete_member`
  - patched member search/list/registration functions to ignore deleted members.


## Update v2.2 Reset PIN Confirmation + Home Customer
- After customer successfully resets PIN, confirmation page shows the new PIN clearly.
- Screenshot reminder remains visible.
- Added button: `Kembali ke Home Customer`.
- Added public route: `#customer-reset-home?token=...`.
- Customer reset home shows member name, phone, member ID, current balance, and top-up package info.
- Required SQL patch updates `mvp_get_pin_reset_request` to return member_code and balance.


## Update v2.3 Link Preview Title
- Browser/WhatsApp preview title changed to customer-facing copy:
  `Cash to Dine by CACAYO — Dining Credit Membership`
- Meta description added:
  `Top up saldo makan, nikmati bonus dining credit, dan pakai saldo langsung di CACAYO.`
- No SQL change required.


## Update v2.4 Customer Portal + Transaction History
- Customer web portal added:
  - Login with WhatsApp number + 6 digit PIN
  - View current balance
  - View transaction history
  - Logout
- No customer top up from website. Top up remains cashier-only.
- No email.
- Customer history shows:
  - Transaction date
  - Outlet / branch name
  - Top up amount
  - Balance used
  - Balance after transaction
- Staff member detail now shows customer transaction history for cashier and owner.
- PIN security:
  - Failed PIN attempts are counted.
  - After 10 failed PIN attempts, member status becomes blocked.
  - Blocked customer cannot login or approve balance usage.
  - Block message tells customer to visit CACAYO branch for staff reset and that balance remains safe.
- Reset PIN through staff QR clears failed attempts and unblocks member.
- SQL patch required: `cash-to-dine-v24-patch-customer-portal-history.sql`


## Update v2.4.2 Remove Demo Credentials + Fix PIN Counter
- Removed demo username/password notice from staff login page.
- SQL patch fixes failed PIN counter by incrementing attempts directly in database with `UPDATE ... RETURNING`.
- Wrong PIN messages now decrement correctly: 9, 8, 7, ... until blocked at 10 attempts.
- Customer login and customer approval PIN share the same counter.


## Update v2.4.3 Persistent PIN Counter Fix
- Root cause fixed: failed PIN attempts were rolling back because SQL raised exception after updating the counter.
- Customer login wrong PIN now returns structured response instead of exception, so the counter persists.
- Customer approval wrong PIN also returns structured response instead of exception, so the counter persists.
- Wrong attempts now correctly show: 9, 8, 7, ... and block at 10.
- App updated to display structured PIN error responses.


## v3.0.2 Staff Blank Screen Fix
- Staff portal assets are now self-contained inside `/ops-cacayo-7k2/`.
- Removed parent-relative `../app.js`, `../styles.css`, and `../qr-local.js` dependencies.
- Portal mode is loaded from an external bootstrap file.
- Added visible loading and fatal-error fallback instead of a blank page.
- Added Cloudflare exact rewrites for the staff directory.
- Added cache-busting query strings to staff assets.
- No SQL migration is required for this UI-only patch.


## v3.1.1 Single Balance Expiry
- Replaces the un-deployed v3.1.0 balance-batch model.
- Each member now has one wallet balance and one expiry date.
- Top-up extends the current future expiry:
  - NICKEL/SILVER: +2 months
  - GOLD/DIAMOND: +4 months
- Example: 2 weeks remaining + NICKEL = 2 months + 2 weeks remaining.
- If balance is empty or already expired, validity starts from the top-up date.
- Customer Portal and staff member detail show the same single expiry date.
- Top-up amounts and package validity are server-controlled and read-only in UI.
- Required SQL: `cash-to-dine-v311-single-balance-expiry.sql`.


## v3.2.1 Generic Gift
- Built directly from v3.1.2; obsolete target-member v3.2.0 application code is not included.
- VOUCHER is for new-member registration.
- GIFT is a generic one-time code for members who already existed when it was generated.
- First eligible member to claim receives the Gift.
- Gift adds wallet balance and never shortens a later expiry.
- `Kirim via WhatsApp` opens WhatsApp with prepared text; without API the status is `WA OPENED`, not `SENT`.
- SQL removes obsolete target-member database functions and columns if found.


## v3.2.2 Revisions
- GIFT uses Copy WA only; no WhatsApp deep-link or API.
- Gift claim keeps the longest expiry between current wallet expiry and Gift expiry.
- CACAYO logo returns to the correct portal login screen.
- Obsolete WhatsApp-open code was removed.
- Required SQL for a fresh v3.2.x deployment: `cash-to-dine-v322-generic-gift.sql`.


## v3.2.3 Customer PIN Disclaimer
- Customer Portal displays a formal PIN security disclaimer below the balance card.
- It explains that the PIN is the sole authorization for balance usage.
- CACAYO and cashier staff cannot view the customer's PIN.
- Loss caused by failure to protect the PIN is not CACAYO's responsibility.
- Frontend-only update; no SQL migration required.


## v3.2.4 Final PIN Disclaimer
- Replaced the previous PIN notice with the approved final wording.
- Clarifies PIN as the sole authorization for Dining balance usage.
- Clarifies customer responsibility, valid PIN transactions, staff visibility limits, and system-error exception.
- Frontend-only update; no SQL migration required.


## v4.0.1 PIN and Member Search Fix
- PIN keypad numbers are explicitly visible in dark text.
- Member search supports name, 62-prefix, local 0-prefix, and number without 62.
- Transaction search accepts 2 or more characters.
- Name searches no longer create an invalid phone prefill.
- Run `cacayo-member-system-v401-search-fix.sql` after the v4.0.0 database migration.


## v4.1.0 Gift Item
- Master Gift Item with photo and reusable item definition.
- Batch generation of unique item codes.
- Visual customer cards with ED and countdown.
- Secure QR + customer PIN redemption.
- Item claim/use included in customer, member, and daily history.
- Wallet, Gift, Voucher, and Item expiry use Jakarta date with 23:59:59 cut-off.
- Run `cacayo-member-system-v410-gift-item.sql`.
