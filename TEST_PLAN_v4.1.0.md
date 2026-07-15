# v4.1.0 Test Plan

1. Run the v4.1.0 SQL and confirm every installation check is OK.
2. Create Master Gift Item “Mie Ayam” and upload a photo.
3. Generate 10 Gift Item codes with an ED seven days from today.
4. Copy one WA message and open its claim link.
5. Login using a member that existed before the Gift Item was generated.
6. Claim the code and confirm the item appears as an image card.
7. Confirm the countdown and ED show the expected Jakarta date.
8. Attempt to claim the same code from another member; it must fail.
9. On Staff → Transaction → Gunakan Gift Item, search the member.
10. Select the item, create the QR, and approve using the customer PIN.
11. Confirm the item changes to “Sudah digunakan”.
12. Attempt to redeem the same item again; it must fail.
13. Top up a zero-balance member and confirm the resulting ED time is 23:59:59 Jakarta.
14. Run the post-check SQL.
