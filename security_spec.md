# Firestore Security Specification

## 1. Data Invariants
1. **Strict Workspace Isolation**: Every user document (`/users/{userId}`) and all workspace collections (`businesses`, `reviews`, `posts`, `analyses`) can only be read or written by the verified authenticated user whose `request.auth.uid == userId`.
2. **Identity Integrity**: Every document created or updated must have `ownerId == request.auth.uid` (or `uid == request.auth.uid` on `/users/{userId}`), and `ownerId`/`uid`/`createdAt` are immutable once created.
3. **Referential Integrity**: A `review`, `post`, or `analysis` document cannot be created unless the referenced parent business (`/users/{userId}/businesses/{businessId}`) exists (or is created atomically in the same batch via `existsAfter`).
4. **Temporal Integrity**: All `createdAt` and `updatedAt` fields must equal `request.time` (`serverTimestamp()`).
5. **Bounded Payloads & Strict Allowlists**: All document IDs match `^[a-zA-Z0-9_\-]+$` (`<= 128` chars), all strings have explicit max `.size()` bounds, all arrays (`loves`, `unhappy`, `actions`) are capped at `<= 6` entries, and `keys().hasOnly(...)` blocks shadow fields.

## 2. The "Dirty Dozen" Adversarial Payloads (Must All Return `PERMISSION_DENIED`)
1. **Unauthenticated Read/Write**: Reading or writing `/users/alice/businesses/biz-1` with `auth == null`.
2. **Unverified Email Write**: Writing `/users/alice/businesses/biz-1` with `auth.uid == 'alice'` and `auth.token.email_verified == false`.
3. **Cross-User Read/List**: Listing `/users/alice/businesses` while authenticated as `bob`.
4. **Identity Spoofing on Create**: Creating `/users/alice/businesses/biz-1` as `alice` with `ownerId: 'bob'`.
5. **Shadow Field Injection**: Creating `/users/alice/businesses/biz-1` with an extra `isAdmin: true` or `verified: true` field.
6. **ID Poisoning**: Creating `/users/alice/businesses/invalid id with spaces and $$$` or a 500-character ID.
7. **Denial-of-Wallet Oversized String**: Creating a review with a 50,000-character `comment`.
8. **Orphaned Review Write**: Creating `/users/alice/reviews/rev-1` referencing `businessId: 'non-existent-biz'`.
9. **Rating Boundary Bypass**: Creating a review with `rating: 99` or `rating: 0` or `rating: 'five'`.
10. **Invalid Post Type Enum**: Creating a post with `type: 'admin_banner'` instead of `'specials' | 'events' | 'jobs'`.
11. **Timestamp Tampering**: Creating a business with `createdAt: new Date('2020-01-01')` instead of `request.time`.
12. **Immutable Field Mutation**: Updating a review or business to change `ownerId` or `createdAt`, or adding an unapproved field in `affectedKeys()`.
