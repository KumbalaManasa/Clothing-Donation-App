# Clothing Donation App — Implementation Plan

Status: Draft v1
Source: derived strictly from `spec.md`, `HLD.md`, and `LLD.md`. Each phase below cites the section(s) it implements so the plan stays traceable back to the requirements. Phases are ordered by dependency (schema before services, auth before role-gated endpoints, backend before frontend consumes it) and each ends with concrete exit criteria, not vibes.

Stack per HLD §3: React (web) + Node.js/Express + PostgreSQL + Cloudinary + Firebase Auth.

## Phase 0 — Project Setup & Tooling

Goal: a running skeleton with nothing product-specific yet.

- [ ] Initialize monorepo structure: `/backend` (Node.js/Express), `/frontend` (React), shared `/Spec` (already exists).
- [ ] Backend: Express app skeleton, environment config (`.env` for DB URL, Firebase Auth keys, Cloudinary keys, gov verification source config placeholder), health-check endpoint.
- [ ] Frontend: React app skeleton (routing, empty pages for Donor/NGO/Admin areas), API client wrapper.
- [ ] PostgreSQL instance provisioned (local + dev environment); migration tool chosen (e.g., node-pg-migrate/Prisma/Knex — pick one, consistent with Node.js/Express per HLD §3).
- [ ] Cloudinary account/bucket configured for photo uploads.
- [ ] Firebase Auth project configured for email/password signup+login.
- [ ] CI pipeline: lint + typecheck + test on push.

Exit criteria: backend boots, connects to Postgres, health-check returns 200; frontend boots and calls the health-check successfully; CI green on an empty test.

## Phase 1 — Database Schema

Implements: LLD §1 (all six tables), state machine enum (LLD §2).

- [ ] Migration: `users` table with role/org_name/registration_number/verification_status columns and the `role='ngo' ⇒ org fields NOT NULL` check constraint (LLD §1.1).
- [ ] Migration: `listings` table with status enum, GPS columns, index on `(status, pickup_lat, pickup_lng)` (LLD §1.2).
- [ ] Migration: `listing_items` table, FK cascade delete, ≥1-item rule documented for app-layer enforcement (LLD §1.3).
- [ ] Migration: `claims` table with partial unique index `UNIQUE(listing_id) WHERE status='active'` (LLD §1.4).
- [ ] Migration: `distributions` table, one-per-listing UNIQUE constraint (LLD §1.5).
- [ ] Migration: `notifications` table with `(user_id, read, created_at)` index (LLD §1.6).
- [ ] Seed script for local dev: sample donor, sample NGO (both verified and not_verified), sample admin.

Exit criteria: all migrations run clean up/down; constraints verified with a quick script that attempts each documented invalid insert (e.g., NGO row missing org_name) and confirms it's rejected.

## Phase 2 — Auth & NGO Government Verification

Implements: spec.md §6.3, §2, §3 (verification decision); LLD §3.1, §3.2; HLD §6.1.

- [ ] Firebase Auth integration: signup/login endpoints issue/validate sessions.
- [ ] `POST /auth/signup/donor` — creates `users` row, role=`donor` (LLD §3.1).
- [ ] `POST /auth/signup/ngo` — creates `users` row, role=`ngo`, requires org_name + registration_number (LLD §5 validation rule).
- [ ] Implement `verifyNgo(registration_number)` integration seam per LLD §3.2, with a **stub/mock implementation** until the government verification source is chosen (open item, spec.md §10 / LLD §7.1) — stub must support both "approved" and "not found" responses for downstream testing, and must fail-safe to `not_verified` on error/timeout (spec.md §6.3 step 5).
- [ ] Wire `verifyNgo` synchronously into NGO signup: sets `verification_status`, `verification_checked_at`, `verification_source_ref` before the signup response returns (spec.md §6.3 steps 2–4).
- [ ] `POST /ngo/:id/reverify` — re-triggers verification after the NGO edits `registration_number` (LLD §3.1; exact resubmission semantics flagged as open item, LLD §7.2 — implement the simplest version first: mutate existing account, revisit if product decides otherwise).
- [ ] Role/permission middleware: gate endpoints by `role` and, for NGO-only actions, by `verification_status = verified` (spec.md §7, LLD §2).
- [ ] **Explicitly do not build**: any admin approve/reject endpoint for NGOs (spec.md §3, §6.6 — no manual fallback by design).

Exit criteria: signing up an NGO against the stub source with a "known good" registration number yields `verified`; an unknown number yields `not_verified`; a simulated source timeout yields `not_verified` (never `pending`, never silently retried into manual review). Donor/NGO/Admin roles are each blocked from the other roles' endpoints.

## Phase 3 — Listings (Donor Flow)

Implements: spec.md §6.1, §5 (Listing/listing_items); LLD §3.3, §5.

- [ ] `POST /listings` — accepts `items[]` (category, condition, photo) + `pickup_lat`/`pickup_lng`; uploads photos to Cloudinary; requires ≥1 item (LLD §1.3, §5).
- [ ] Reverse-geocode `pickup_lat`/`pickup_lng` into `pickup_address_label`, editable by donor before submit (spec.md §5, §6.1 step 2).
- [ ] `GET /listings/mine` — donor's own listings with current status (spec.md §2).
- [ ] `POST /listings/:id/cancel` — reason required, only allowed when status ∈ {listed, claimed}; notifies NGO if it was claimed (spec.md §6.2, LLD §2, §5).

Exit criteria: donor can create a multi-item listing end-to-end (photos land in Cloudinary, row + item rows in Postgres, status=`listed`); cancellation is rejected with a clear error once status is `picked_up` or later; cancellation without a reason is rejected.

## Phase 4 — Status Pipeline Engine & Claims (NGO Flow, part 1)

Implements: spec.md §4, §6.4 steps 1–3; LLD §2, §3.4.

- [ ] Central status-transition function implementing the full table in LLD §2 (single source of truth — no status write happens outside it).
- [ ] `GET /listings/open` — verified-NGO-only; filter by distance/category; returns **approximate distance, not precise coordinates** (spec.md §7, LLD §3.3 — flagged open item on exact masking behavior, LLD §7.4, implement masking now as the safer default).
- [ ] `POST /listings/:id/claim` — verified-NGO-only, listing must be `listed`; creates `claims` row with `expires_at = now()+48h`; transitions listing to `claimed`; writes `claimed` notification to donor (spec.md §6.4 step 2, LLD §1.4, §4).
- [ ] `POST /claims/:id/pickup` — claim owner only, transitions `claimed → picked_up`; writes `picked_up` notification to donor (spec.md §6.4 step 3).
- [ ] `GET /ngo/claims/mine` — NGO's active/past claims (LLD §3.4).

Exit criteria: an unverified NGO gets `403` on claim; claiming an already-claimed listing gets `409` (partial unique index enforced); pickup by a non-owning NGO gets `403`; every transition writes the correct notification row.

## Phase 5 — Distribution & Auto-Delivery (NGO Flow, part 2)

Implements: spec.md §4 note, §6.4 steps 4–5; LLD §1.5, §2, §3.4.

- [ ] `POST /claims/:id/distribute` — claim owner only, listing must be `picked_up`; requires `receiver_first_name` + `receiver_general_area`, optional photo upload to Cloudinary (spec.md §6.4 step 4, LLD §5).
- [ ] Single transaction: insert `distributions` row, transition listing `distributed → delivered` automatically (no separate NGO action — spec.md §4 note), write `distributed` and `delivered` notifications to donor (HLD §6.2).
- [ ] Delivery confirmation note surfaced to donor (spec.md §6.4 step 5, §1 core flow step 5).

Exit criteria: distributing without receiver_first_name/general_area is rejected; a successful distribute call leaves the listing at `delivered` (never stuck at `distributed`) in one atomic operation; donor sees both notifications and the confirmation note.

## Phase 6 — Claim Expiry Background Job

Implements: spec.md §6.5; LLD §4.

- [ ] Scheduled job (cron, interval per LLD §4 — 5–10 min default) selecting stale active claims with `FOR UPDATE SKIP LOCKED`.
- [ ] Per stale claim: mark claim `expired`, revert listing to `listed`, write `expired` notifications to both NGO and donor — all in one transaction per claim, idempotent on retry.
- [ ] Job scheduling mechanism finalized (cron vs. queue — open item, spec.md §10/LLD §7.5; start with cron, it satisfies the 48h-window precision requirement).

Exit criteria: a claim manually backdated past `expires_at` in a test gets swept within one job interval, listing reappears in `GET /listings/open`, both parties get an `expired` notification, and running the job twice in a row does not double-notify or error.

## Phase 7 — Notifications (In-App)

Implements: spec.md §3, §5; LLD §1.6, §3.5.

- [ ] `GET /notifications` — own notifications, unread-first, per the `(user_id, read, created_at)` index.
- [ ] `POST /notifications/:id/read` — owner-only, sets `read=true`.
- [ ] Confirm every write path in Phases 3–6 that should notify actually does (cross-check against spec.md §5's type enum: `claimed`, `picked_up`, `distributed`, `delivered`, `cancelled`, `expired`).
- [ ] **Explicitly do not build**: push/SMS/email/WhatsApp senders (spec.md §3, §8).

Exit criteria: a donor who performs the full flow (list → get claimed → picked up → distributed/delivered) sees exactly the 4 corresponding notifications in order, all unread until marked.

## Phase 8 — Admin Module

Implements: spec.md §6.6; LLD §3.6.

- [ ] `GET /admin/listings` + `DELETE /admin/listings/:id` — moderation (spec.md §6.6 step 1).
- [ ] `GET /admin/claims/stale` — read-only visibility into expired/stale claims (spec.md §6.6 step 2).
- [ ] `GET /admin/ngo-verifications` — read-only audit log (org_name, registration_number, status, checked_at, source_ref) for dispute handling (spec.md §6.6 step 3).
- [ ] **Explicitly do not build**: any approve/reject/override endpoint for NGO verification (spec.md §3, §6.6 — deliberate absence, not an oversight).

Exit criteria: admin can view and delete a listing; admin can see a `not_verified` NGO's audit trail but the API surface has no way to flip it to `verified`.

## Phase 9 — Frontend: Donor Experience

Implements: spec.md §6.1, §6.2, §2 (Donor capabilities); consumes Phases 3, 5, 7.

- [ ] Create-listing form: multi-item add/remove, photo upload, GPS pin capture + editable address label.
- [ ] "My listings" view with live status per listing (Listed/Claimed/Picked up/Delivered/Cancelled).
- [ ] Cancel-listing action with required reason field, disabled once status is `picked_up`+.
- [ ] Delivery confirmation note display once `delivered`.
- [ ] In-app notification center (unread badge, mark-as-read).

Exit criteria: a donor can complete the entire donor-side journey in the browser without touching the API directly, mirroring HLD §6.2's sequence.

## Phase 10 — Frontend: NGO Experience

Implements: spec.md §6.3, §6.4, §2 (NGO capabilities); consumes Phases 2, 4, 5, 7.

- [ ] NGO signup form (org_name, registration_number, contact) with immediate verified/not_verified result shown post-submit (spec.md §6.3).
- [ ] "Not verified" state UI: clear messaging that account is blocked from claiming, with an edit-and-resubmit path calling `/ngo/:id/reverify`.
- [ ] Browse/filter open listings (distance, category), claim action.
- [ ] "My claims" view with pickup and distribute actions; distribute form captures receiver first name + general area + optional photo.
- [ ] In-app notification center (shared component with Phase 9).

Exit criteria: a `not_verified` NGO cannot see a claim button anywhere in the UI (not just blocked server-side); a `verified` NGO can complete claim → pickup → distribute end-to-end in the browser.

## Phase 11 — Frontend: Admin Panel

Implements: spec.md §6.6; consumes Phase 8.

- [ ] Listings moderation table with delete action.
- [ ] Stale claims read-only view.
- [ ] NGO verification audit log view (searchable by org_name/registration_number).

Exit criteria: admin can moderate listings and inspect verification history without any control that mutates verification status.

## Phase 12 — Testing

Cross-cutting; validates every phase against its cited spec/LLD sections.

- [ ] Unit tests: status-transition function against the full LLD §2 table, including every illegal-transition case (e.g., cancel after pickup, claim an already-claimed listing).
- [ ] Unit tests: validation rules from LLD §5 (missing item photo, missing cancellation reason, missing receiver fields, NGO signup without org fields).
- [ ] Integration tests: each flow in spec.md §6.1–§6.6 end-to-end against a test DB.
- [ ] Integration test: claim-expiry job idempotency (run twice, assert single notification set).
- [ ] Integration test: `verifyNgo` fail-safe behavior on simulated timeout.
- [ ] E2E tests (frontend): donor journey (Phase 9 exit criteria) and NGO journey (Phase 10 exit criteria) via browser automation.
- [ ] Security check: attempt every role-gated endpoint with the wrong role/ownership and confirm `403`/`404` as appropriate (donor hitting NGO endpoints, one NGO acting on another's claim, etc.), consistent with spec.md §7 trust principles.

Exit criteria: CI green across unit, integration, and E2E suites; no role-gated endpoint reachable by the wrong actor in manual spot-check.

## Phase 13 — Deployment

- [ ] Provision production Postgres, Cloudinary, Firebase Auth project.
- [ ] Deploy backend (API + background job) and frontend to chosen hosting.
- [ ] Configure the real government verification source integration behind the `verifyNgo` seam (blocks full production readiness until spec.md §10's open item is resolved — staging can continue running the stub).
- [ ] Smoke test the five-step core flow (spec.md §4 "Core User Flow") in production.

Exit criteria: a real donor and a real (test) NGO account can complete the full pipeline in production, with notifications and status tracking visible end-to-end.

## Blocking Open Items (must be resolved before the phases that depend on them can ship to production)

| Open item (spec.md §10 / LLD §7) | Blocks | Interim approach |
|---|---|---|
| Which government verification source/API | Phase 2 production readiness, Phase 13 | Stub `verifyNgo` with mock approved/not-found responses (Phase 2) |
| Re-verification resubmission semantics | Phase 2 `/ngo/:id/reverify` final behavior | Implement as in-place mutation; revisit if product specifies otherwise |
| Nearby radius/sort algorithm | Phase 4 `GET /listings/open` tuning | Ship a reasonable default radius (e.g., 15km) + simple distance sort; tune post-launch |
| Precise-location masking confirmation | Phase 4 `GET /listings/open` response shape | Implemented masked by default (safer per spec.md §7); confirm with product |
| Job scheduling mechanism (cron vs. queue) | Phase 6 | Cron, 5–10 min interval, revisit only if scale requires a queue |

## Explicit Non-Goals for This Plan (carried from spec.md §8)

No phase above builds: payments, receiver accounts/login, real-time NGO GPS tracking, multi-language support, ratings/reviews, push/SMS/email/WhatsApp notifications, in-app chat, map view, impact dashboards, or gamification/badges. If any of these show up mid-implementation as a "quick add," they are out of MVP scope per `spec.md` §8 and belong in a future-scope backlog, not this plan.
