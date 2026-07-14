# Cash to Dine MVP Starter

Ini starter Web App/PWA untuk trial Cash to Dine.

## Status
- Bisa langsung dibuka sebagai static web app.
- Saat ini data tersimpan di `localStorage` browser untuk demo/prototype.
- Untuk trial multi-device real, hubungkan ke Supabase dengan SQL schema yang tersedia di `supabase-schema.sql`.

## Demo Login
- Owner: `owner` / `owner123`
- Kasir: `kasir` / `kasir123`

## Flow Utama
1. Owner login.
2. Generate Gift Code 8 digit.
3. Customer daftar via Join Page dan input Gift Code.
4. Gift Code menjadi `used`, saldo awal masuk ke member.
5. Kasir search member by no HP.
6. Kasir top up atau request transaksi penggunaan saldo.
7. Customer approve transaksi dari HP sendiri.
8. Kasir screen update menjadi success.

## Deploy cepat ke Cloudflare Pages
1. Zip/folder ini upload ke GitHub.
2. Cloudflare Pages → Create Project → Connect GitHub.
3. Build command kosong.
4. Output directory `/`.
5. Deploy.

## Catatan penting untuk production
Jangan pakai localStorage untuk saldo real. Untuk saldo/voucher yang bernilai uang, semua data harus di cloud database:
- Supabase PostgreSQL
- Row Level Security
- RPC/function atomic untuk deduct balance
- audit log immutable
- backup rutin

## Next integration
Gunakan `supabase-schema.sql` sebagai database awal.
Frontend action di `app.js` bisa diganti dari localStorage menjadi Supabase query/RPC.


## Update v0.2 WA Invite
Setelah Owner generate Gift Code, app akan menampilkan:
- WA-ready invite messages
- Registration links per code
- Codes only
- Download CSV

Format registration link:
`https://domain-kamu/#join?code=GIFT8DIGIT`


## Update v0.3 Simple Redeem
Gunakan Saldo sekarang lebih simple:
- Kasir hanya input nominal saldo/voucher yang dipakai
- Tidak perlu input total bill
- Tidak perlu input nomor invoice/nota POS
- Customer approve nominal dari HP sendiri
- Kasir validasi dan input payment split di POS manual


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


## v3.0 Security Foundation
- Separate customer and staff URLs
- Bcrypt credential migration
- Server-validated staff sessions
- Legacy staff RPCs revoked from anon
- Local QR generation
- Hashed approval/reset/session tokens
- Expiry, audit log, invoice idempotency
- Security headers and noindex staff portal


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


## v3.2.0 Existing Member Gift Voucher
- Owner can select an existing member, event, custom value, and expiry date.
- Voucher is bound to the selected member.
- Owner copies the voucher through the existing one-time Copy WA / Copy Link control.
- Customer opens the link, logs in, previews the gift, and claims it.
- Gift value is added directly to existing wallet balance.
- Gift expiry never shortens an existing later expiry.
- Another member cannot claim a forwarded link.
- New-member registration rejects existing-member gift codes.
- Required SQL: `cash-to-dine-v320-existing-member-gift.sql`.
