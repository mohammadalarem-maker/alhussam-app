# Security Specification for Sahab ERP

## Data Invariants
1. **Authenticated Access:** Only users with verified email addresses can access any resource.
2. **Role-Based Access Control:** 
   - `admin`: Full access to everything.
   - `accountant`: Access to `accounts`, `journalEntries`, `items`, `invoices`.
   - `sales`: Access to `items`, `invoices`, `pos`.
3. **Immutable Fields:** `createdAt`, `userId`, `projectId`.
4. **Strict Schema:** Use `isValid[Entity]` for every write.

## The Dirty Dozen (Attack Payloads)
1. **Role Escalation:** `auth_user` tries to set `users/{uid}.role = 'admin'`.
2. **Resource Poisoning:** `auth_user` tries to set `items/{long_junk_string}`.
3. **Identity Spoofing:** `auth_user` tries to set `invoices/{id}.ownerId = 'other_uid'`.
4. **Denial of Wallet:** `auth_user` tries to write a 1MB string to `account.name`.
5. **Shadow Update:** `auth_user` tries to add `isVerified: true` to a profile.
6. **State Shortcut:** `auth_user` tries to move invoice status from `draft` to `paid` without admin role.
7. **Array Bloat:** `auth_user` tries to add 10,000 items to an invoice list.
8. **Immutability Breach:** `auth_user` tries to change `createdAt` timestamp.
9. **Unverified Leak:** `unverified_user` tries to read `admins/` collection.
10. **Orphaned Write:** `auth_user` tries to create an invoice for a non-existent `partnerId`.
11. **Type Poisoning:** `auth_user` tries to set `account.code = 123` (instead of string).
12. **Terminal State Tampering:** `auth_user` tries to edit a `paid` invoice total.

## Test Runner Plan
I will create `firestore.rules.test.ts` to simulate these attacks using the Firebase emulator or unit test logic where applicable.
