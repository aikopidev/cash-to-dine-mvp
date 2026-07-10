# Cash to Dine v0.4 Deploy & Test Guide

## What is included
- PWA static app
- Owner gift-code generation
- WA-ready invite links
- New member registration with 8-char gift code
- Kasir search member by phone
- Kasir request saldo/voucher usage
- Auto QR approval link
- Customer bright approval alert + PIN
- Kasir waiting screen auto-polls local state in demo mode
- Supabase SQL schema and RPC draft for production cloud mode

## Important
This version can be previewed locally, but cross-device QR approval requires online deployment and cloud database.

Local file mode:
- Good for UI and same-browser simulation
- Not reliable for tablet ↔ customer HP because each device has separate localStorage

Online + Supabase mode:
- Required for real trial
- Tablet kasir creates approval request in Supabase
- Customer scans QR and approves
- Supabase updates request status
- Tablet kasir polls/realtime updates to success

## Quick deploy to Cloudflare Pages
1. Create GitHub repo.
2. Upload all files in this folder.
3. Cloudflare Dashboard → Workers & Pages → Create Application → Pages.
4. Connect GitHub repo.
5. Build command: leave blank.
6. Build output directory: `/`
7. Deploy.
8. Open deployed URL.

## Supabase setup
1. Create Supabase project.
2. Go to SQL Editor.
3. Run `supabase-schema.sql`.
4. Copy Project URL and anon key.
5. Developer connects frontend actions to Supabase:
   - create member + gift claim
   - create pending approval
   - approve balance use RPC
   - fetch approval status from kasir screen
   - fetch reports

## Trial test script
A. Owner generate code:
1. Login owner / owner123.
2. Open Gift Code.
3. Generate 5 codes @ Rp100.000.
4. Copy WA invite link.

B. Customer new member:
1. Open invite link in another browser/device.
2. Register name, phone, password.
3. Confirm saldo initial equals gift code value.

C. Kasir request saldo:
1. Login kasir / kasir123.
2. Search customer phone.
3. Click Gunakan Saldo.
4. Input Rp100.000.
5. Request Customer Approval.
6. QR appears.

D. Customer approval:
1. Customer scans QR.
2. Bright orange approval screen appears.
3. Customer checks amount.
4. Customer enters PIN/password.
5. Approve.

E. Kasir success:
1. Kasir screen status changes to approved.
2. Success receipt shows saldo used and remaining saldo.
3. Kasir inputs payment split manually in POS.


## Update v0.5 Balance Safety
Saldo rule locked:
- Request amount > customer balance: rejected with clear warning.
- Request amount = customer balance: allowed.
- Final balance can be Rp0.
- Final balance must never be negative.
- Approval is double-checked again when customer enters PIN.
- Supabase production must use atomic RPC / row lock for deduct balance.
