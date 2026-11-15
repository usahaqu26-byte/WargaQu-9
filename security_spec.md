# WargaQu Hybrid Firebase Security Specification

## 1. Data Invariants
1. **Owner-Isolated Account Metadata**: A citizen can only read (`get`), create, and update their own `/accountRegistry/{uid}` document where `uid == request.auth.uid` and `email == request.auth.token.email`. Only verified Admins can `list` all `/accountRegistry` documents.
2. **Email-Verified Identity**: Every standard write and policy lookup requires `request.auth.token.email_verified == true`.
3. **Admin-Only Policy Mutation**: Only verified Admins (`usahaqu26@gmail.com`, `usahaqu2026@gmail.com`, or UID present in `/admins/{uid}`) may `create`, `update`, or `delete` `/accountPolicies/{policyId}`, `/appConfig/governance`, and `/appConfig/monetization`.
4. **No PII Blanket Reads**: Non-admins cannot `list` `/accountRegistry` or `/accountPolicies` without matching `targetEmail == request.auth.token.email`.
5. **Server Timestamp Integrity**: `createdAt`, `updatedAt`, and `lastSeenAt` must equal `request.time`, and `createdAt` / `uid` / `email` / `targetEmail` are immutable after creation.
6. **Bounded Payloads**: Every string has strict length limits and every array is capped (`activeModules <= 8`, `trahNames <= 15`, `communityNames <= 15`, `freeModules <= 6`, `communityFreeRules <= 50`, `rules <= 10`, `officerEmails <= 10`, `recentTransactions <= 25`, `handoverHistory <= 15`).
7. **RTQu Tenure Lock (`request.time < termEndTimestamp`)**: Routine RTQu community updates and new kas transactions are rejected by the server once `request.time >= termEndTimestamp`. During the post-term grace window (`request.time < graceEndTimestamp`), only quorum-approved Sertijab handover actions are permitted; after `graceEndTimestamp`, all officer mutations are locked read-only.
8. **RTQu Multi-Officer Quorum (`>= 2` Distinct Officers)**: Once a community has 2 or more officers, modifying `officerEmails`, `officers`, `termEndTimestamp`, or executing `sertijab` requires an approved `/governanceActions/{actionId}` signed by at least 2 distinct current officers (`approverEmails.size() >= 2`). Single-officer self-extension or unilateral officer removal is rejected.
9. **Append-Only Treasury & Handovers**: `/rtCommunities/{communityId}/transactions/{txId}` and `/handovers/{handoverId}` forbid `update` and `delete` (`allow update, delete: if false;`), enforcing correction entries rather than silent deletion.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Unauthenticated Write**: `create /accountRegistry/user1` with `auth == null` -> `PERMISSION_DENIED`.
2. **Unverified Admin Email Spoof**: `list /accountRegistry` with `auth.token.email == 'usahaqu26@gmail.com'` and `email_verified == false` -> `PERMISSION_DENIED`.
3. **Cross-User PII Read**: `get /accountRegistry/other_uid` as non-admin `user1` -> `PERMISSION_DENIED`.
4. **Blanket User List Scraping**: `list /accountRegistry` as non-admin `user1` -> `PERMISSION_DENIED`.
5. **UID Spoofing on Create**: `create /accountRegistry/user1` with payload `{ uid: 'victim_uid', ... }` -> `PERMISSION_DENIED`.
6. **Email Spoofing on Create**: `create /accountRegistry/user1` with `email: 'usahaqu26@gmail.com'` while signed in as `'attacker@gmail.com'` -> `PERMISSION_DENIED`.
7. **Shadow Field Injection**: `update /accountRegistry/user1` adding `{ isAdmin: true }` -> `PERMISSION_DENIED`.
8. **Expired Officer Write**: `create /rtCommunities/c1/transactions/tx1` or routine `update /rtCommunities/c1` when `request.time >= termEndTimestamp` -> `PERMISSION_DENIED`.
9. **Unilateral Term Self-Extension**: Single officer updates `/rtCommunities/c1` changing `termEndTimestamp` without a `>= 2` officer quorum `governanceAction` -> `PERMISSION_DENIED`.
10. **Duplicate Self-Approval on Quorum**: Same officer attempts to approve their own `/rtCommunities/c1/governanceActions/act1` twice (`request.auth.token.email in existing().approverEmails`) -> `PERMISSION_DENIED`.
11. **Silent Kas Deletion / Tampering**: Officer attempts `update` or `delete` on `/rtCommunities/c1/transactions/tx1` -> `PERMISSION_DENIED`.
12. **Unauthorized Community Join / Scrape**: User attempts `create /rtCommunities/c1/uidMembers/u1` with wrong `inviteCode` or `list /rtCommunities` without `officerEmails` filter -> `PERMISSION_DENIED`.
