# Firestore Security Specification (Shared Directory & Staff Portal)

## 1. Data Invariants
1. **Public Directory Without PII**: Publicly listable collections (`/businesses`, `/businesses/{businessId}/reviews`, `/businesses/{businessId}/posts`, `/businesses/{businessId}/analyses`) never contain email addresses, phone numbers, or private user data, and `allow list` explicitly requires `resource.data.isPublic == true`.
2. **Verified Community Submissions**: Creating a community review requires a verified Google user (`request.auth.token.email_verified == true`), `authorUid == request.auth.uid`, valid rating (`1..5`), bounded fields, and forbids setting `ownerReply` during initial creation unless the caller is authorized staff/owner.
3. **Owner & Staff Reply Authorization**: Updating a review is strictly restricted to the business owner, authorized staff in `/businesses/{businessId}/staffMembers/{staffKey}`, or the bootstrapped admin (`xolilemalele@gmail.com` with `email_verified == true`), and `affectedKeys().hasOnly(['ownerReply', 'updatedAt'])` keeps all customer review fields immutable.
4. **PII Isolation on Staff Members**: `/businesses/{businessId}/staffMembers/{memberId}` stores staff emails and is strictly unreadable by the public or unrelated users—only the business owner, admin, or the matching verified staff member can read it.
5. **Temporal & Referential Integrity**: Subcollection writes verify parent business existence via `existsAfter`, and `createdAt`/`updatedAt`/`repliedAt` must match `request.time`.

## 2. The "Dirty Dozen" Adversarial Payloads (Must All Return `PERMISSION_DENIED`)
1. **Unauthenticated Review Creation**: Posting to `/businesses/thubelihlee/reviews/rev-1` with `auth == null`.
2. **Unverified Email Staff Spoof**: Trying to reply as `xolilemalele@gmail.com` when `email_verified == false`.
3. **Non-Staff Owner Reply**: A regular community member updating `/businesses/thubelihlee/reviews/rev-1` to inject `ownerReply`.
4. **Customer Comment Tampering on Reply**: An owner/staff member updating `comment` or `rating` alongside `ownerReply` on a customer's review.
5. **Shadow Field Injection on Review**: Creating a review with an extra `isVerifiedOwner: true` or `ownerReply` field as a non-staff community member.
6. **Unauthorized Staff Escalation**: A non-owner user creating `/businesses/thubelihlee/staffMembers/me` to grant themselves staff access.
7. **Cross-User Staff PII Read**: Reading `/businesses/thubelihlee/staffMembers/other_user` as an unrelated community member.
8. **Blanket Unconstrained List Query**: Listing `staffMembers` without matching ownership, admin, or matching verified email.
9. **Orphaned Review/Post**: Creating a review under `/businesses/missing-biz/reviews/rev-1`.
10. **ID Poisoning**: Creating a business or review with spaces/symbols or >128 char IDs.
11. **Oversized Denial-of-Wallet Payload**: Sending a 50KB `ownerReply.message` or review `comment`.
12. **Timestamp Forgery**: Setting `ownerReply.repliedAt` or `createdAt` to a client-chosen past/future date instead of `request.time`.
