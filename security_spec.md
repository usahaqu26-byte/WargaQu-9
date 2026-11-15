# WargaQu Hybrid Firebase Security Specification

## 1. Data Invariants
1. **Owner-Isolated Account Metadata**: A citizen can only read (`get`), create, and update their own `/accountRegistry/{uid}` document where `uid == request.auth.uid` and `email == request.auth.token.email`. Only verified Admins can `list` all `/accountRegistry` documents.
2. **Email-Verified Identity**: Every standard write and policy lookup requires `request.auth.token.email_verified == true`.
3. **Admin-Only Policy Mutation**: Only verified Admins (`usahaqu26@gmail.com`, `usahaqu2026@gmail.com`, or UID present in `/admins/{uid}`) may `create`, `update`, or `delete` `/accountPolicies/{policyId}`, `/appConfig/governance`, and `/appConfig/monetization`.
4. **No PII Blanket Reads**: Non-admins cannot `list` `/accountRegistry` or `/accountPolicies` without matching `targetEmail == request.auth.token.email`.
5. **Server Timestamp Integrity**: `createdAt`, `updatedAt`, and `lastSeenAt` must equal `request.time`, and `createdAt` / `uid` / `email` / `targetEmail` are immutable after creation.
6. **Bounded Payloads**: Every string has strict length limits (`<= 300` max) and every array is capped (`activeModules <= 8`, `trahNames <= 15`, `communityNames <= 15`, `freeModules <= 6`, `communityFreeRules <= 50`, `rules <= 10`).

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Unauthenticated Write**: `create /accountRegistry/user1` with `auth == null` -> `PERMISSION_DENIED`.
2. **Unverified Admin Email Spoof**: `list /accountRegistry` with `auth.token.email == 'usahaqu26@gmail.com'` and `email_verified == false` -> `PERMISSION_DENIED`.
3. **Cross-User PII Read**: `get /accountRegistry/other_uid` as non-admin `user1` -> `PERMISSION_DENIED`.
4. **Blanket User List Scraping**: `list /accountRegistry` as non-admin `user1` -> `PERMISSION_DENIED`.
5. **UID Spoofing on Create**: `create /accountRegistry/user1` with payload `{ uid: 'victim_uid', ... }` -> `PERMISSION_DENIED`.
6. **Email Spoofing on Create**: `create /accountRegistry/user1` with `email: 'usahaqu26@gmail.com'` while signed in as `'attacker@gmail.com'` -> `PERMISSION_DENIED`.
7. **Shadow Field Injection**: `update /accountRegistry/user1` adding `{ isAdmin: true }` -> `PERMISSION_DENIED`.
8. **Immutable Field Tampering**: `update /accountRegistry/user1` modifying `createdAt` or `email` -> `PERMISSION_DENIED`.
9. **Client Timestamp Forgery**: `create /accountRegistry/user1` with `lastSeenAt` set to past/future client timestamp (`!= request.time`) -> `PERMISSION_DENIED`.
10. **Non-Admin Policy Self-Upgrade**: `create /accountPolicies/em_123` setting `{ status: 'free', allModulesFree: true }` as non-admin -> `PERMISSION_DENIED`.
11. **Non-Admin Policy List Scraping**: `list /accountPolicies` without filtering to own verified `targetEmail` as non-admin -> `PERMISSION_DENIED`.
12. **Resource Exhaustion / ID Poisoning**: `create /accountRegistry/bad$id` or oversized `note` (>300 chars) or `activeModules` (>8 items) -> `PERMISSION_DENIED`.
