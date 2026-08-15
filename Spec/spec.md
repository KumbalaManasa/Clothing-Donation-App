# Clothing Donation App — MVP Specification

Status: Draft v1
Source: derived from `idea.md`, with open questions resolved below.

## 1. Overview

A web/mobile app connecting **Donors** (people with unused clothes) to **NGOs** (government-verified collectors/distributors), who deliver the clothes to **Receivers** (people in need). Every donation is tracked through a visible status pipeline so donors see the outcome of their donation and the process stays accountable.

This spec resolves the open questions from `idea.md` and defines the MVP scope precisely enough to build against.

## 2. Roles

| Role | Capabilities |
|---|---|
| **Donor** | Create listings, view status of own listings, cancel a listing (with reason), receive in-app notifications, receive delivery confirmation note |
| **NGO** | Register with government registration details, get automatically verified, browse/filter open listings, claim a listing, update status (picked up / distributed / delivered), record receiver info |
| **Admin** | Moderate listings, monitor/release stale claims, handle verification exceptions (see §6.3) |

A Receiver does **not** have an app account (per idea doc, out of scope for MVP). Individual (non-NGO) volunteers are **not supported in MVP** — only registered NGOs can collect and distribute donations. This narrows the idea doc's "Volunteer/NGO" role to NGO-only.

## 3. Resolved Decisions (formerly Open Questions)

| Question | Decision |
|---|---|
| NGO verification | **Automatic government verification, NGO-only.** NGO submits org name, registration/approval number, and contact details. System checks this against the official government verification source. Match found & approved → auto-marked `Government Verified`. Not found / not approved → auto-marked `Not Verified`, account blocked from claiming, **no manual admin review fallback**. Individual (non-NGO) volunteers are not supported in MVP. |
| Location capture | **GPS coordinates.** Donor's device captures lat/long when creating a listing, shown as an editable pin on a map. Used for proximity-based sorting/filtering for volunteers. |
| Cancel after claim | **Yes, with reason.** Donor can cancel any time before "Picked up," must select or enter a reason. The assigned volunteer is notified immediately and the listing returns to the open pool. |
| Claimed-but-not-picked-up timeout | **Auto-timeout + reassignment.** If a claim isn't marked "Picked up" within 48 hours, it auto-expires, the listing reopens for other volunteers, and the original volunteer's on-time record is noted (internal metric, not shown publicly in MVP). |
| Listing granularity | **Multi-item bundle.** One listing = one pickup, and may contain multiple clothing items, each with its own category, condition, and photo. |
| Ratings/feedback | **None in MVP.** The donor's delivery confirmation note is the only feedback signal. Ratings/reviews are future scope. |
| Notification channel | **In-app only.** All status-change alerts appear in an in-app notification center. Push/SMS/email are future scope. |

## 4. Status Pipeline

A listing moves through exactly these statuses, in order, with no skipping:

```
Listed → Claimed → Picked up → Distributed → Delivered
                 ↳ (cancelled by donor, pre-pickup)
                 ↳ (claim expired, pre-pickup) → back to Listed
```

| Status | Set by | Trigger |
|---|---|---|
| `Listed` | Donor | Listing created (or claim cancelled/expired, returns here) |
| `Claimed` | NGO | NGO claims an open listing |
| `Picked up` | NGO | NGO confirms collection from donor |
| `Distributed` | NGO | NGO hands clothes to a receiver, records receiver info |
| `Delivered` | System (auto, on `Distributed`) | Final state; triggers donor confirmation note |
| `Cancelled` | Donor | Donor cancels before pickup (reason required) |

Note: "Distributed" and "Delivered" are effectively the same real-world event (handover to receiver) per the idea doc's 5-step flow — `Delivered` is set automatically the moment `Distributed` is recorded, since receiver info + optional photo constitute delivery confirmation. No separate action is needed from the volunteer.

## 5. Data Model (MVP)

### User
- id, name, email, phone, password/auth provider
- role: `donor` | `ngo` | `admin`
- (if ngo) org_name, registration_number
- (if ngo) verification_status: `verified` | `not_verified` (set automatically, no `pending` state — the government lookup is synchronous/near-synchronous at registration time)
- (if ngo) verification_checked_at, verification_source_ref (identifier/response reference from the government verification source, for audit)

### Listing
- id, donor_id, status
- items: array of { category, condition, photo_url }
- pickup_location: { lat, lng, address_label (reverse-geocoded, editable) }
- created_at, updated_at
- cancellation_reason (nullable)

### Claim
- id, listing_id, ngo_id
- claimed_at, expires_at (claimed_at + 48h)
- picked_up_at (nullable)

### Distribution
- id, listing_id, ngo_id
- receiver_first_name, receiver_general_area
- photo_url (nullable — optional)
- distributed_at

### Notification
- id, user_id, listing_id, type (`claimed` | `picked_up` | `distributed` | `delivered` | `cancelled` | `expired`), message, read (bool), created_at

## 6. Core Flows

### 6.1 Donor: Create Listing
1. Donor adds one or more items (photo, category, condition).
2. Donor sets pickup location via GPS pin (editable).
3. Listing is created with status `Listed`, visible to volunteers.

### 6.2 Donor: Cancel Listing
1. Available only while status is `Listed` or `Claimed`.
2. Donor selects/enters a reason.
3. Status → `Cancelled`. If it was `Claimed`, the NGO is notified.

### 6.3 NGO: Verification
1. NGO signs up, submits org name, registration/approval number, contact details.
2. System immediately queries the official government verification source with the registration number.
3. Match found & approved by the source → `verification_status = verified`, account can browse/claim listings right away.
4. No match / not approved by the source → `verification_status = not_verified`, account is blocked from claiming. There is **no manual admin review fallback**; the NGO must correct and resubmit their registration details (e.g., typo in registration number) to trigger a re-check.
5. If the government verification source is unreachable (timeout/outage), the check fails safe as `not_verified` and the NGO can retry; this does not fall back to manual review either.

### 6.4 NGO: Claim → Pickup → Distribute
1. Browse open (`Listed`) listings, filterable by distance and category (only available to `verified` NGOs).
2. Claim a listing → status `Claimed`, claim record created with 48h expiry.
3. Mark `Picked up` after physically collecting from donor.
4. Mark `Distributed`: enter receiver first name + general area, optional photo.
5. System auto-sets status `Delivered`; donor gets confirmation note.

### 6.5 Claim Expiry
1. Background job checks claims where `now > expires_at` and `picked_up_at IS NULL`.
2. Claim is expired, listing reverts to `Listed`, NGO and donor notified.

### 6.6 Admin: Moderation
1. View/remove listings that violate content guidelines (e.g., inappropriate photos).
2. View stale/expired claims (visibility only — expiry is automatic per 6.5).
3. View NGO verification records (read-only audit trail: what was checked, when, and the result) for dispute handling — admin cannot manually override `not_verified` to `verified`.

## 7. Trust & Privacy Principles (carried from idea.md)

- Donor has full visibility into status at every step.
- Receiver info captured is minimal and non-identifying: first name + general area only.
- Handover photo is optional, never mandatory.
- Only government-verified NGOs can claim or distribute donations.
- Donor's precise GPS location is visible only to the NGO that claims the listing (not to all browsing NGOs, who see approximate distance until claiming — implementation detail for engineering to confirm).

## 8. Out of Scope (MVP)

- Payments or monetary donations
- Direct receiver accounts/login
- Real-time GPS tracking of volunteers
- Multi-language support
- Ratings/reviews
- Push, SMS, email, or WhatsApp notifications
- In-app chat
- Map view of nearby listings/NGOs
- Impact dashboards
- Gamification/badges

These remain in `idea.md` §7 as future scope.

## 9. Suggested Tech Direction

Carried from `idea.md` §9, unchanged:
- Frontend: React (web) or React Native (mobile)
- Backend: Node.js/Express or Firebase
- Database: PostgreSQL or Firestore
- Storage: S3 / Firebase Storage / Cloudinary for photos
- Auth: Firebase Auth / Clerk / Auth0

## 10. Remaining Implementation Details (for engineering, not product, to decide)

- Exact radius/sort algorithm for "nearby" listings in NGO browse view.
- Whether donor's precise pin is masked to NGOs before they claim.
- Image storage/compression pipeline.
- Auto-expiry job scheduling mechanism (cron vs. queue).
- **Which official government verification source to integrate with is still open** (e.g., NGO Darpan for India, or an equivalent national/regional NGO registry API) — this determines the registration-number format to collect at signup and the lookup integration (REST API vs. scraped portal vs. bulk dataset). Needs a decision before NGO verification can be built.
- Re-check behavior: does resubmitting corrected registration details create a new verification attempt on the same account, or require a new signup?
