# Cash to Dine v3.2.2

## Revisions

- GIFT uses **Copy WA**, identical to the Voucher copy behavior.
- The app does not open WhatsApp and contains no `wa.me` flow.
- Owner manually pastes the copied message into WhatsApp.
- On Gift claim, total wallet expiry follows the longest date:
  - later existing wallet expiry, or
  - Gift expiry.
- Clicking the CACAYO logo/brand returns:
  - Customer portal → customer login
  - Staff portal → staff login

## Base model

- VOUCHER: new-member registration.
- GIFT: existing members who already existed when the Gift was generated.
- First eligible existing member to claim receives the Gift.
- One code can be used only once.
