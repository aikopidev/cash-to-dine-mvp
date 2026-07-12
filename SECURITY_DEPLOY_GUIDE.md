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
