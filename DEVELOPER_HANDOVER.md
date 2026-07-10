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
