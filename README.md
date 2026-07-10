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


## Update v0.8 Search & Approval UX
- Kasir search member now supports live suggestions after 7 digits.
- New Supabase RPC required: `mvp_search_members(uuid, text)`.
- Customer approval screen now removes PIN/buttons after successful approval.
- Customer success screen shows saldo used and remaining saldo clearly.
