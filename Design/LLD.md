# Clothing Donation App — Low-Level Design (LLD)

Status: Draft v1
Source: derived strictly from `spec.md` (MVP Specification v1) and `HLD.md`. This document turns the entities, flows, and rules in `spec.md` §4–§6 into concrete schema, API contracts, and validation logic. It introduces no behavior beyond what `spec.md` defines; where `spec.md` leaves an implementation detail open (§10), that is called out inline rather than silently decided.

## 1. Database Schema (PostgreSQL)

Field names follow `spec.md` §5 directly. `Listing.items` is normalized into its own table (`listing_items`) since it is described as "array of {category, condition, photo_url}" and each item needs its own row for querying/editing.

### 1.1 `users`

| Column | Type | Constraints | Notes (spec.md ref) |
|---|---|---|---|
| id | UUID | PK | |
| name | text | NOT NULL | |
| email | text | UNIQUE, NOT NULL | |
| phone | text | NOT NULL | |
| password_hash | text | NULL (nullable if using Firebase Auth federated identity) | §9 auth |
| role | enum(`donor`,`ngo`,`admin`) | NOT NULL | §5 |
| org_name | text | NOT NULL if role=`ngo`, else NULL | §5, §6.3 step 1 |
| registration_number | text | NOT NULL if role=`ngo`, else NULL; UNIQUE where not null | §5, §6.3 step 1 |
| verification_status | enum(`verified`,`not_verified`) | NOT NULL if role=`ngo`, else NULL; default `not_verified` until first check completes | §5 — no `pending` state |
| verification_checked_at | timestamptz | NULL until first check | §5 |
| verification_source_ref | text | NULL | audit reference returned by government source, §5, §6.6 |
| created_at | timestamptz | NOT NULL default now() | |

Check constraint: `role = 'ngo'` implies `org_name`, `registration_number`, `verification_status` are all NOT NULL. `role != 'ngo'` implies they are all NULL (individual volunteers not supported, spec.md §2).

### 1.2 `listings`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK | |
| donor_id | UUID | FK → users.id, NOT NULL | must reference role=`donor` |
| status | enum(`listed`,`claimed`,`picked_up`,`distributed`,`delivered`,`cancelled`) | NOT NULL default `listed` | §4 |
| pickup_lat | numeric(9,6) | NOT NULL | §5, §6.1 |
| pickup_lng | numeric(9,6) | NOT NULL | §5, §6.1 |
| pickup_address_label | text | NOT NULL (reverse-geocoded, editable) | §5 |
| cancellation_reason | text | NULL | §5, §6.2 |
| created_at | timestamptz | NOT NULL default now() | |
| updated_at | timestamptz | NOT NULL default now(), updated on every status change | |

Index: `(status, pickup_lat, pickup_lng)` to support NGO browse/filter by open listings + proximity (§6.4 step 1).

### 1.3 `listing_items`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK | |
| listing_id | UUID | FK → listings.id, NOT NULL, ON DELETE CASCADE | |
| category | text | NOT NULL | §5 |
| condition | text | NOT NULL | §5 |
| photo_url | text | NOT NULL | §5 (item photo is part of listing creation, not optional — distinct from the optional handover photo in Distribution) |

Constraint: a listing must have at least 1 row in `listing_items` (enforced at application layer on create, since "multi-item bundle" per §3 implies ≥1 item).

### 1.4 `claims`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK | |
| listing_id | UUID | FK → listings.id, NOT NULL, UNIQUE for active claim (see below) | §5 |
| ngo_id | UUID | FK → users.id, NOT NULL | must reference role=`ngo` AND verification_status=`verified` at claim time |
| claimed_at | timestamptz | NOT NULL default now() | §5 |
| expires_at | timestamptz | NOT NULL, = claimed_at + interval '48 hours' | §3, §5 |
| picked_up_at | timestamptz | NULL | §5 |
| status | enum(`active`,`fulfilled`,`expired`,`cancelled`) | NOT NULL default `active` | derived bookkeeping for the expiry job (§6.5) and cancellation (§6.2) |

Partial unique index: `UNIQUE (listing_id) WHERE status = 'active'` — a listing can have at most one active claim at a time, consistent with the single-path status pipeline in §4.

### 1.5 `distributions`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK | |
| listing_id | UUID | FK → listings.id, NOT NULL, UNIQUE | one distribution per listing |
| ngo_id | UUID | FK → users.id, NOT NULL | |
| receiver_first_name | text | NOT NULL | §5, §6.4 step 4 — mandatory per idea/spec |
| receiver_general_area | text | NOT NULL | §5, §6.4 step 4 |
| photo_url | text | NULL | §5 — explicitly optional |
| distributed_at | timestamptz | NOT NULL default now() | |

### 1.6 `notifications`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK | |
| user_id | UUID | FK → users.id, NOT NULL | recipient |
| listing_id | UUID | FK → listings.id, NOT NULL | |
| type | enum(`claimed`,`picked_up`,`distributed`,`delivered`,`cancelled`,`expired`) | NOT NULL | §5 |
| message | text | NOT NULL | |
| read | boolean | NOT NULL default false | §5 |
| created_at | timestamptz | NOT NULL default now() | |

Index: `(user_id, read, created_at)` for the in-app notification center's unread-first list view.

## 2. Listing Status State Machine

Enforced server-side in the Status Pipeline Engine (HLD §5), not just in the client. Illegal transitions return `409 Conflict`.

| From | To | Allowed actor | Guard condition (spec.md ref) |
|---|---|---|---|
| `listed` | `claimed` | NGO | actor.role=`ngo` AND actor.verification_status=`verified` (§6.4 step 1, §7) |
| `listed` | `cancelled` | Donor | actor.id = listing.donor_id (§6.2) |
| `claimed` | `picked_up` | NGO | actor.id = claim.ngo_id (§6.4 step 3) |
| `claimed` | `cancelled` | Donor | actor.id = listing.donor_id; reason required (§6.2) |
| `claimed` | `listed` | System (Claim Expiry Job) | now > claim.expires_at AND claim.picked_up_at IS NULL (§6.5) |
| `picked_up` | `distributed` | NGO | actor.id = claim.ngo_id; receiver_first_name + receiver_general_area required (§6.4 step 4) |
| `distributed` | `delivered` | System (auto, same transaction as above) | always, immediately (§4 note) |

No other transition is valid. Notably: once `picked_up`, a listing can **not** be cancelled or expired (spec.md §6.2 restricts cancellation to `Listed`/`Claimed`; §6.5 expiry only applies pre-pickup) — this must be enforced, not just assumed by the client.

## 3. API Contract (REST, Node.js/Express per HLD §3)

All endpoints require an authenticated session (Firebase Auth bearer token) except signup/login. Role checks are enforced server-side per the guard conditions in §2 above.

### 3.1 Auth / NGO Verification

| Method | Path | Role | Body | Behavior |
|---|---|---|---|---|
| POST | `/auth/signup/donor` | public | name, email, phone, password | Creates `users` row, role=`donor` |
| POST | `/auth/signup/ngo` | public | name, email, phone, password, org_name, registration_number | Creates `users` row, role=`ngo`; synchronously triggers §3.2 verification before returning |
| POST | `/ngo/:id/reverify` | ngo (self) | — | Re-runs government lookup for a `not_verified` NGO after they update `registration_number` (§6.3 step 4). Implementation note: exact resubmission semantics are an open item, spec.md §10 |
| POST | `/auth/login` | public | email, password | Standard session issuance |

### 3.2 Government Verification Integration (internal, called by signup/reverify)

```
verifyNgo(registration_number) -> { status: 'verified' | 'not_verified', source_ref: string | null }
```
- On success match+approved: `verified`.
- On no-match, not-approved, or timeout/error from the government source: `not_verified` (fail-safe per §6.3 step 5).
- No retry-with-backoff-to-manual-review path exists — spec.md §3/§6.3 explicitly rules out a manual admin fallback.
- Which concrete external source/API this calls is an open item (spec.md §10) — this function signature is the integration seam engineering will implement against once that's decided.

### 3.3 Listings

| Method | Path | Role | Body / Query | Behavior |
|---|---|---|---|---|
| POST | `/listings` | donor | items[] {category, condition, photo}, pickup_lat, pickup_lng | Create listing, status=`listed` (§6.1) |
| GET | `/listings/mine` | donor | — | Donor's own listings with current status (§2 Donor capability) |
| GET | `/listings/open` | ngo (verified only) | lat, lng, radius?, category? | Browse/filter open (`listed`) listings by proximity (§6.4 step 1); returns approximate distance, not precise pickup coords, until claimed (§7) |
| POST | `/listings/:id/cancel` | donor (owner) | reason | Cancel; only if status in {`listed`,`claimed`} (§6.2) |

### 3.4 Claims

| Method | Path | Role | Body | Behavior |
|---|---|---|---|---|
| POST | `/listings/:id/claim` | ngo (verified) | — | Creates `claims` row, expires_at=now+48h, listing→`claimed` (§6.4 step 2) |
| POST | `/claims/:id/pickup` | ngo (claim owner) | — | Sets picked_up_at, listing→`picked_up` (§6.4 step 3) |
| POST | `/claims/:id/distribute` | ngo (claim owner) | receiver_first_name, receiver_general_area, photo? | Creates `distributions` row, listing→`distributed`→`delivered` in one transaction (§6.4 steps 4–5) |
| GET | `/ngo/claims/mine` | ngo | — | NGO's active/past claims |

### 3.5 Notifications

| Method | Path | Role | Behavior |
|---|---|---|---|
| GET | `/notifications` | any authenticated user | Own notifications, unread-first (§5, §3 in-app only) |
| POST | `/notifications/:id/read` | owner | Marks read=true |

### 3.6 Admin

| Method | Path | Role | Behavior |
|---|---|---|---|
| GET | `/admin/listings` | admin | List/filter listings for moderation (§6.6 step 1) |
| DELETE | `/admin/listings/:id` | admin | Remove listing that violates guidelines (§6.6 step 1) |
| GET | `/admin/claims/stale` | admin | View expired/stale claims, read-only (§6.6 step 2) |
| GET | `/admin/ngo-verifications` | admin | Read-only audit log of verification attempts (§6.6 step 3) — **no PATCH/approve endpoint exists**, by design |

## 4. Background Job: Claim Expiry (spec.md §6.5)

```
every N minutes:
  SELECT id, listing_id, ngo_id FROM claims
  WHERE status = 'active' AND picked_up_at IS NULL AND expires_at < now()
  FOR UPDATE SKIP LOCKED

  for each stale claim (in one transaction per claim, idempotent):
    UPDATE claims SET status = 'expired' WHERE id = claim.id
    UPDATE listings SET status = 'listed' WHERE id = claim.listing_id AND status = 'claimed'
    INSERT INTO notifications (user_id=claim.ngo_id, listing_id, type='expired', ...)
    INSERT INTO notifications (user_id=listing.donor_id, listing_id, type='expired', ...)
```

`FOR UPDATE SKIP LOCKED` prevents double-processing if the job is ever scaled to multiple workers. Polling interval is an open engineering choice (spec.md §10 — "cron vs. queue"); a 5–10 minute cron interval is sufficient given the 48-hour expiry window and does not need queue-based precision.

## 5. Validation Rules Summary

Extracted directly from `spec.md` — implemented as request validation, not just DB constraints, so failures return clear `400` errors before hitting the DB:

- Listing creation: ≥1 item, each item requires category + condition + photo; pickup_lat/pickup_lng required (§6.1, §5).
- NGO signup: org_name + registration_number required; individual signup with role=`ngo` and no org_name is rejected (§2, §6.3).
- Cancellation: reason required (non-empty string); only allowed when listing.status ∈ {`listed`,`claimed`} (§6.2).
- Claim: only allowed when listing.status = `listed` AND actor.verification_status = `verified` (§6.4, §7).
- Distribute: receiver_first_name + receiver_general_area required; photo optional; only allowed when listing.status = `picked_up` AND actor is the claim owner (§6.4 step 4).
- Notifications: never sent via push/SMS/email — in-app row insert only (§3).

## 6. Explicit Non-Goals (carried from spec.md §8, restated for implementers)

Do not build: payment/transaction handling, receiver login, live GPS tracking of NGOs en route, i18n/l10n, rating/review tables or endpoints, push/SMS/email/WhatsApp senders, chat, map UI, donor impact dashboards, badges/gamification tables. Any of these appearing in a PR against this LLD is out of MVP scope per `spec.md` §8.

## 7. Open Items Requiring a Decision Before Full Build (from spec.md §10)

1. **Government verification source** — concrete API/registry (e.g., NGO Darpan for India) must be chosen; determines `registration_number` format validation and the real implementation of `verifyNgo()` in §3.2.
2. **Re-verification semantics** — whether `/ngo/:id/reverify` mutates the existing account or requires new signup, once an NGO corrects a `not_verified` registration number.
3. **Nearby radius/sort algorithm** — exact distance formula/default radius for `GET /listings/open`.
4. **Precise-location masking** — confirm `GET /listings/open` truly withholds exact `pickup_lat`/`pickup_lng` pre-claim (currently assumed in §3.3, per HLD §8).
5. **Job scheduling mechanism** — cron vs. queue for §4's claim expiry job.
