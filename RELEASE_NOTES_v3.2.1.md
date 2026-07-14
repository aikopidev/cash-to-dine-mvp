# Cash to Dine v3.2.1 — Generic Gift

## Final model

- **VOUCHER**: only for new-member registration.
- **GIFT**: only for members who already existed when the Gift was generated.
- Gift is not assigned to a particular member.
- The first eligible existing member who claims receives it.
- One code can be used only once.
- Gift adds to wallet balance.
- Gift never shortens a later wallet expiry.

## WhatsApp without API

- Voucher uses **Copy WA**.
- Gift uses **Kirim via WhatsApp**, opening WhatsApp with prepared text.
- Without a WhatsApp API the system records **WA OPENED**, not SENT.

## Clean build

The app was built directly from v3.1.2. The abandoned target-member v3.2.0
application flow is not present. The SQL removes its old functions and columns
if they were accidentally installed.
