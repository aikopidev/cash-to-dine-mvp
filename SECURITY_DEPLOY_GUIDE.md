# CTD v3.0 Security Deployment

1. Backup Supabase database.
2. Run `cash-to-dine-v30-security-foundation.sql` in Supabase SQL Editor.
3. Push this ZIP to GitHub/Cloudflare Pages.
4. Customer portal: `https://cash-to-dine-mvp.pages.dev/`
5. Staff portal: `https://cash-to-dine-mvp.pages.dev/ops-cacayo-7k2/`
6. Do not share the staff URL publicly.
7. Before pilot, enable Cloudflare Access for `/ops-cacayo-7k2/*`.
8. Test owner login, kasir login, top up, approval QR, reset PIN, customer login/history.

## Important
- Existing owner/kasir passwords remain the same, but are migrated to bcrypt hashes.
- Existing customer PINs remain the same, but are migrated to bcrypt hashes.
- Staff sessions expire after 8 hours and are stored only in browser sessionStorage.
- Customer sessions expire after 24 hours.
- Approval QR expires after 5 minutes; reset PIN QR expires after 30 minutes.
- Top-up invoice numbers are unique per outlet.
- Archive member requires Rp0 balance and preserves history.


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


## v4.1.1 Reward Control Fix
- Three large reward choices replace reward-type dropdowns.
- Gift Item selection uses visual item cards.
- Voucher, Gift Saldo, and Gift Item controls are separated.
- Generated codes automatically open their matching control.
- Lightweight code-list RPC removes repeated Base64 image payload.
- Run `cacayo-member-system-v411-reward-control-fix.sql` after v4.1.0.
