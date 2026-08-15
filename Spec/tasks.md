# Clothing Donation App — Task Checklist

Status: Draft v1
Source: derived strictly from `spec.md`, `HLD.md`, `LLD.md`, and `plan.md`. Each phase below matches the corresponding phase in `plan.md` 1:1; this document breaks every plan item into small, independently completable, independently testable tasks. Work top-to-bottom — later phases assume earlier ones are done.

Format: each task has a **Verify** line — the concrete check that proves the task is actually done, not just written.

---

## Phase 0 — Project Setup & Tooling

- [x] 0.1 Create monorepo folders: `/backend`, `/frontend` (alongside existing `/Spec`).
  **Verify:** folders exist, empty or with placeholder README.
- [x] 0.2 `backend`: `npm init`, install `express`, `cors`, `dotenv`.
  **Verify:** `npm ls` shows the three packages.
- [x] 0.3 `backend`: create `.env.example` listing `DATABASE_URL`, `FIREBASE_*`, `CLOUDINARY_*`, `GOV_VERIFICATION_*` placeholders.
  **Verify:** file committed, no real secrets in it.
- [x] 0.4 `backend`: implement `GET /health` returning `200 { status: "ok" }`.
  **Verify:** `curl localhost:PORT/health` returns 200 with expected body.
- [x] 0.5 `frontend`: scaffold React app (e.g. Vite), base router with empty Donor/NGO/Admin route placeholders.
  **Verify:** `npm run dev` serves the app; navigating to each route renders a placeholder page.
- [x] 0.6 `frontend`: build a thin API client wrapper (base URL from env, JSON handling, auth header injection point).
  **Verify:** unit test calling the wrapper against a mocked fetch confirms correct URL/headers.
- [x] 0.7 `frontend`: call `GET /health` on app load, show status in UI.
  **Verify:** manual check — app shows "backend: ok" when backend is running, an error state when it's stopped.
- [x] 0.8 Provision a local PostgreSQL instance for dev.
  **Verify:** `psql` connects successfully using `DATABASE_URL`.
- [x] 0.9 Choose and install a migration tool (e.g. `node-pg-migrate`), wire its config to `DATABASE_URL`.
  **Verify:** running the tool's "list migrations" command succeeds with zero migrations.
- [ ] 0.10 Configure Cloudinary account + API keys; write a one-off script that uploads a test image.
  **Verify:** script prints a valid Cloudinary URL; URL loads the image in a browser.
- [ ] 0.11 Configure Firebase Auth project for email/password; write a one-off script that creates a test user.
  **Verify:** script succeeds; user visible in Firebase console.
- [ ] 0.12 Set up CI pipeline (lint + typecheck + test on push), initially against a trivial passing test.
  **Verify:** CI run is green on a fresh push.

---

## Phase 1 — Database Schema (LLD §1)

- [ ] 1.1 Migration: `users` table with columns per LLD §1.1 (id, name, email, phone, password_hash, role, org_name, registration_number, verification_status, verification_checked_at, verification_source_ref, created_at).
  **Verify:** migration runs; `\d users` shows all columns with correct types.
- [ ] 1.2 Migration: add check constraint — `role='ngo'` ⇒ org_name/registration_number/verification_status NOT NULL; `role!='ngo'` ⇒ all NULL.
  **Verify:** attempt to insert an `ngo` row with `org_name=NULL` fails; attempt to insert a `donor` row with `org_name` set fails.
- [ ] 1.3 Migration: `listings` table with status enum (`listed`,`claimed`,`picked_up`,`distributed`,`delivered`,`cancelled`) and GPS/address columns per LLD §1.2.
  **Verify:** migration runs; inserting an invalid status value is rejected by the enum.
- [ ] 1.4 Migration: index `(status, pickup_lat, pickup_lng)` on `listings`.
  **Verify:** `\d listings` shows the index; `EXPLAIN` on a status+proximity query uses it.
- [ ] 1.5 Migration: `listing_items` table, FK to `listings.id` with `ON DELETE CASCADE`, per LLD §1.3.
  **Verify:** deleting a `listings` row deletes its `listing_items` rows automatically.
- [ ] 1.6 Migration: `claims` table per LLD §1.4 (claimed_at, expires_at, picked_up_at, status enum).
  **Verify:** migration runs; default `status='active'` confirmed on insert.
- [ ] 1.7 Migration: partial unique index `UNIQUE(listing_id) WHERE status='active'` on `claims`.
  **Verify:** inserting a second `active` claim for the same `listing_id` fails; inserting one after the first is marked `expired` succeeds.
- [ ] 1.8 Migration: `distributions` table per LLD §1.5, `UNIQUE(listing_id)`.
  **Verify:** inserting a second distribution for the same listing fails.
- [ ] 1.9 Migration: `notifications` table per LLD §1.6, index `(user_id, read, created_at)`.
  **Verify:** migration runs; index present via `\d notifications`.
- [ ] 1.10 Write a dev seed script: one donor, one `verified` NGO, one `not_verified` NGO, one admin.
  **Verify:** running the script twice is idempotent (no duplicate-key errors); querying `users` shows all four rows with correct roles/statuses.

---

## Phase 2 — Auth & NGO Government Verification (spec.md §6.3; LLD §3.1–3.2)

- [ ] 2.1 Integrate Firebase Admin SDK in backend; middleware to verify bearer tokens on protected routes.
  **Verify:** unit test — valid token passes, missing/invalid token returns 401.
- [ ] 2.2 Implement `POST /auth/signup/donor`.
  **Verify:** integration test — request creates a `users` row with `role='donor'`; response excludes password hash.
- [ ] 2.3 Implement `POST /auth/signup/ngo`, validating `org_name` + `registration_number` are present.
  **Verify:** request missing `org_name` returns 400; request missing `registration_number` returns 400.
- [ ] 2.4 Implement `verifyNgo(registration_number)` as a stub/mock: configurable to return `verified`, `not_verified` (not found), or simulate a timeout — per LLD §3.2's integration seam.
  **Verify:** unit tests cover all three stub behaviors independently.
- [ ] 2.5 Wire `verifyNgo` synchronously into NGO signup; persist `verification_status`, `verification_checked_at`, `verification_source_ref` before responding.
  **Verify:** integration test — signup with a "known good" registration number in the stub returns `verified` in the response and in the DB row.
- [ ] 2.6 Confirm not-found path.
  **Verify:** integration test — signup with an unrecognized registration number returns `not_verified`, never `pending`.
- [ ] 2.7 Confirm fail-safe timeout path (spec.md §6.3 step 5).
  **Verify:** integration test — simulated `verifyNgo` timeout/error still completes signup with `verification_status='not_verified'` (never throws an unhandled error, never leaves status null).
- [ ] 2.8 Implement `POST /ngo/:id/reverify` — re-runs `verifyNgo` against the NGO's current `registration_number`.
  **Verify:** integration test — a `not_verified` NGO updates its registration number to a "known good" value, calls reverify, and its `verification_status` flips to `verified`.
- [ ] 2.9 Implement `POST /auth/login`.
  **Verify:** integration test — valid credentials return a usable session/token; invalid credentials return 401.
- [ ] 2.10 Implement `requireRole(role)` middleware.
  **Verify:** unit test — donor token hitting an NGO-only stub route gets 403; correct role passes.
- [ ] 2.11 Implement `requireVerifiedNgo` middleware (role=`ngo` AND `verification_status='verified'`).
  **Verify:** unit test — `not_verified` NGO token hitting a verified-only stub route gets 403; `verified` NGO passes.
- [ ] 2.12 Code-review checklist item: confirm no admin approve/reject-NGO endpoint exists anywhere in the router (spec.md §3/§6.6 deliberate omission).
  **Verify:** grep the route table for any NGO-status-mutating admin route; none found.

---

## Phase 3 — Listings (Donor Flow) (spec.md §6.1, §6.2; LLD §3.3)

- [ ] 3.1 Implement a Cloudinary upload helper (accepts file, returns URL).
  **Verify:** unit/integration test — uploading a test image returns a resolvable URL.
- [ ] 3.2 Implement `POST /listings`: accept `items[]` + `pickup_lat`/`pickup_lng`, require donor role.
  **Verify:** non-donor role gets 403.
- [ ] 3.3 Add ≥1-item validation on listing create.
  **Verify:** request with empty `items[]` returns 400.
- [ ] 3.4 Persist listing + each item row (category, condition, photo_url) transactionally, status=`listed`.
  **Verify:** integration test — create with 3 items results in 1 `listings` row + 3 `listing_items` rows, all committed together (simulate a mid-insert failure and confirm rollback).
- [ ] 3.5 Implement reverse-geocoding of `pickup_lat`/`pickup_lng` into `pickup_address_label`, editable before submit.
  **Verify:** given known coordinates, returned label matches expected area; donor-supplied override is persisted instead of the auto value when provided.
- [ ] 3.6 Implement `GET /listings/mine`.
  **Verify:** integration test — donor A never sees donor B's listings in the response.
- [ ] 3.7 Implement `POST /listings/:id/cancel`, require `reason` in body.
  **Verify:** request without `reason` returns 400.
- [ ] 3.8 Enforce cancel only allowed when status ∈ {`listed`,`claimed`}.
  **Verify:** cancel attempt on a `picked_up`/`distributed`/`delivered` listing returns 409.
- [ ] 3.9 On cancel from `claimed`, notify the assigned NGO.
  **Verify:** integration test — cancelling a claimed listing creates a `notifications` row with `type='cancelled'` for the NGO.
- [ ] 3.10 On cancel, set `cancellation_reason` and status=`cancelled`.
  **Verify:** DB row reflects both fields after the call.

---

## Phase 4 — Status Pipeline Engine & Claims (spec.md §4, §6.4 steps 1–3; LLD §2, §3.4)

- [ ] 4.1 Implement one central status-transition function that all status writes must go through (no direct `UPDATE listings SET status` elsewhere in the codebase).
  **Verify:** code-review/grep check — no raw status-setting SQL outside this function.
- [ ] 4.2 Unit test every valid transition row in LLD §2's table (listed→claimed, listed→cancelled, claimed→picked_up, claimed→cancelled, claimed→listed [system], picked_up→distributed, distributed→delivered [system]).
  **Verify:** 7 passing unit tests, one per row.
- [ ] 4.3 Unit test illegal transitions are rejected (e.g. `listed→picked_up` skip, `picked_up→cancelled`, `delivered→` anything).
  **Verify:** each attempted illegal transition throws/returns a typed error, not a silent no-op.
- [ ] 4.4 Implement `GET /listings/open`, require `requireVerifiedNgo`.
  **Verify:** `not_verified` NGO gets 403; `verified` NGO gets 200.
- [ ] 4.5 Add distance filter/sort by `lat`/`lng`/optional `radius` query param, with a sane default radius.
  **Verify:** integration test — listing outside the radius is excluded; listing inside is included and sorted nearest-first.
- [ ] 4.6 Add optional `category` filter.
  **Verify:** filtering by category excludes listings whose items don't match.
- [ ] 4.7 Mask precise coordinates in the open-listings response — return approximate distance only, not `pickup_lat`/`pickup_lng` (spec.md §7).
  **Verify:** response schema/contract test asserts `pickup_lat`/`pickup_lng` are absent from `GET /listings/open` payloads.
- [ ] 4.8 Implement `POST /listings/:id/claim`.
  **Verify:** claiming a `listed` listing returns 201, creates a `claims` row with `expires_at = claimed_at + 48h`, and transitions listing to `claimed`.
- [ ] 4.9 Enforce the partial-unique-index race condition at the API layer with a clean error.
  **Verify:** two concurrent claim attempts on the same listing — exactly one succeeds (201), the other gets 409, not a raw DB error leaking through.
- [ ] 4.10 On claim, notify the donor (`type='claimed'`).
  **Verify:** integration test confirms the notification row.
- [ ] 4.11 Implement `POST /claims/:id/pickup`, require caller = claim's `ngo_id`.
  **Verify:** a different NGO calling this on someone else's claim gets 403.
- [ ] 4.12 On pickup, set `picked_up_at`, transition listing `claimed→picked_up`.
  **Verify:** DB reflects both changes atomically.
- [ ] 4.13 On pickup, notify the donor (`type='picked_up'`).
  **Verify:** integration test confirms the notification row.
- [ ] 4.14 Implement `GET /ngo/claims/mine`.
  **Verify:** NGO A never sees NGO B's claims in the response.

---

## Phase 5 — Distribution & Auto-Delivery (spec.md §4 note, §6.4 steps 4–5; LLD §1.5, §2)

- [ ] 5.1 Implement `POST /claims/:id/distribute`, require caller = claim's `ngo_id` and listing status = `picked_up`.
  **Verify:** wrong owner gets 403; wrong listing status gets 409.
- [ ] 5.2 Require `receiver_first_name` + `receiver_general_area` in body; `photo` optional.
  **Verify:** missing `receiver_first_name` returns 400; missing `receiver_general_area` returns 400; omitting photo entirely still succeeds.
- [ ] 5.3 If photo provided, upload via the Cloudinary helper from Phase 3.
  **Verify:** distribution row's `photo_url` matches the uploaded asset URL.
- [ ] 5.4 Wrap distribution-insert + status-transition (`distributed`→`delivered`, both in one step) in a single DB transaction.
  **Verify:** simulate a failure between the two writes and confirm full rollback (no listing stuck at `distributed` with no distribution row, or vice versa).
- [ ] 5.5 Confirm the listing lands on `delivered`, never stops at `distributed`.
  **Verify:** integration test — after a successful distribute call, `listings.status === 'delivered'`.
- [ ] 5.6 On distribute/auto-deliver, write both `distributed` and `delivered` notifications to the donor.
  **Verify:** integration test — donor's notification list contains both types after one distribute call.
- [ ] 5.7 Surface a delivery confirmation note/field for delivered listings via the donor-facing API.
  **Verify:** `GET /listings/mine` for a delivered listing includes a non-empty confirmation note.

---

## Phase 6 — Claim Expiry Background Job (spec.md §6.5; LLD §4)

- [ ] 6.1 Implement a scheduled job runner (cron-based, interval configurable via env, default 5–10 min).
  **Verify:** job fires on schedule in a local test harness (e.g. mocked clock).
- [ ] 6.2 Implement the stale-claim query: `active` claims where `picked_up_at IS NULL AND expires_at < now()`, using `FOR UPDATE SKIP LOCKED`.
  **Verify:** unit test against fixture data returns exactly the expected stale claims, excluding non-expired and already-picked-up ones.
- [ ] 6.3 Implement per-claim expiry transaction: claim→`expired`, listing→`listed` (only if still `claimed`), two notifications (NGO + donor, `type='expired'`).
  **Verify:** integration test — a manually backdated claim gets swept in one job run; listing status flips to `listed`; both notification rows exist.
- [ ] 6.4 Confirm listing reappears in browse results after expiry.
  **Verify:** `GET /listings/open` includes the reverted listing post-sweep.
- [ ] 6.5 Confirm idempotency — running the job twice back-to-back does not double-process or double-notify.
  **Verify:** integration test — run job, then run again immediately; notification count for the affected listing stays at 2 (one per party), not 4.
- [ ] 6.6 Confirm a claim that got picked up between job runs is correctly excluded.
  **Verify:** integration test — mark `picked_up_at` on a claim just before the job would sweep it; it must not be expired.

---

## Phase 7 — Notifications (In-App) (spec.md §3, §5; LLD §1.6, §3.5)

- [ ] 7.1 Implement `GET /notifications`, unread-first ordering.
  **Verify:** integration test — unread rows precede read rows regardless of `created_at`.
- [ ] 7.2 Implement `POST /notifications/:id/read`, owner-only.
  **Verify:** non-owner attempting to mark another user's notification read gets 403; owner succeeds and `read=true` persists.
- [ ] 7.3 End-to-end notification audit: run the full donor journey (list→claimed→picked up→distributed/delivered) and assert exactly the 4 expected notification types exist, in order.
  **Verify:** one integration test asserting the ordered type sequence `[claimed, picked_up, distributed, delivered]`.
- [ ] 7.4 Code-review checklist item: confirm no push/SMS/email/WhatsApp sending code exists anywhere (spec.md §3, §8).
  **Verify:** grep for any external notification SDK/API usage; none found.

---

## Phase 8 — Admin Module (spec.md §6.6; LLD §3.6)

- [ ] 8.1 Implement `GET /admin/listings` (list/filter), require admin role.
  **Verify:** non-admin gets 403.
- [ ] 8.2 Implement `DELETE /admin/listings/:id`.
  **Verify:** integration test — deleted listing no longer appears in donor's or NGO's views.
- [ ] 8.3 Implement `GET /admin/claims/stale`, read-only.
  **Verify:** expired claims (from Phase 6 tests) appear here; active claims do not.
- [ ] 8.4 Implement `GET /admin/ngo-verifications` audit log (org_name, registration_number, status, checked_at, source_ref).
  **Verify:** integration test — both a `verified` and a `not_verified` NGO's records appear with correct fields.
- [ ] 8.5 Negative test: confirm no PATCH/PUT/approve endpoint exists to mutate `verification_status` from the admin surface.
  **Verify:** route-table grep; attempt a hypothetical mutating call and confirm 404 (route doesn't exist).

---

## Phase 9 — Frontend: Donor Experience (spec.md §6.1, §6.2, §2)

- [ ] 9.1 Build create-listing form: add/remove item rows (category, condition, photo picker).
  **Verify:** manual test — adding 3 items and removing 1 leaves 2 in the form state.
- [ ] 9.2 Wire per-item photo upload to the backend upload path.
  **Verify:** manual test — selecting a photo shows a preview and the URL is included in the submit payload.
- [ ] 9.3 Wire browser geolocation capture for pickup location, with an editable address field pre-filled from reverse geocoding.
  **Verify:** manual test — location permission granted shows a pin; address field is editable and the edit is what gets submitted.
- [ ] 9.4 Wire form submit to `POST /listings`; redirect to "My Listings" on success.
  **Verify:** manual test — full form submit creates a listing visible immediately in "My Listings".
- [ ] 9.5 Build "My Listings" view with a status badge per listing.
  **Verify:** manual test — badge text matches each of the six possible statuses correctly.
- [ ] 9.6 Add refetch/poll so status badge updates after an NGO claims (no page reload required).
  **Verify:** manual two-browser test — NGO claims in one tab, donor's badge updates in the other within the poll interval.
- [ ] 9.7 Build cancel action with a required-reason modal.
  **Verify:** manual test — submitting the modal with an empty reason is blocked client-side (and server rejects if bypassed).
- [ ] 9.8 Disable/hide the cancel action once status is `picked_up` or later.
  **Verify:** manual test — no cancel control visible on a `picked_up`/`distributed`/`delivered` listing.
- [ ] 9.9 Display the delivery confirmation note once a listing is `delivered`.
  **Verify:** manual test — note text visible on the listing detail view.
- [ ] 9.10 Build notification center component (bell icon + list + mark-as-read).
  **Verify:** manual test — unread badge count matches `GET /notifications` unread count; clicking a notification marks it read.

---

## Phase 10 — Frontend: NGO Experience (spec.md §6.3, §6.4, §2)

- [ ] 10.1 Build NGO signup form (org_name, registration_number, contact details).
  **Verify:** manual test — submitting shows the verified/not_verified result immediately after signup completes.
- [ ] 10.2 Build "not verified" account state screen with clear messaging and an edit-registration-number-and-resubmit action wired to `/ngo/:id/reverify`.
  **Verify:** manual test — correcting the number and resubmitting flips the UI to "verified" without a fresh signup.
- [ ] 10.3 Build browse/filter listings view (distance, category controls).
  **Verify:** manual test — changing the radius/category filter updates the visible list accordingly.
- [ ] 10.4 Hide/disable the claim action entirely in the UI for `not_verified` accounts (not just server-side).
  **Verify:** manual test — logging in as a `not_verified` NGO shows no claim button anywhere in the browse view.
- [ ] 10.5 Wire the claim action to `POST /listings/:id/claim`.
  **Verify:** manual test — claiming moves the listing out of the open browse list and into "My Claims".
- [ ] 10.6 Build "My Claims" view with pickup and distribute actions per claim.
  **Verify:** manual test — actions available match claim state (pickup only before pickup, distribute only after).
- [ ] 10.7 Build distribute form (receiver first name, general area, optional photo).
  **Verify:** manual test — submitting without receiver fields is blocked client-side; optional photo can be skipped.
- [ ] 10.8 Full-flow manual test: claim → pickup → distribute completed entirely in the browser.
  **Verify:** listing status visibly reaches "Delivered" in the NGO's own claim view.
- [ ] 10.9 Reuse the notification center component from Phase 9.
  **Verify:** manual test — NGO sees its own notifications (claimed listings expiring, cancellations), not the donor's.

---

## Phase 11 — Frontend: Admin Panel (spec.md §6.6)

- [ ] 11.1 Build listings moderation table with a delete action.
  **Verify:** manual test — deleting a listing from the table removes it and it's gone from donor/NGO views.
- [ ] 11.2 Build stale-claims read-only table.
  **Verify:** manual test — table shows the same rows as `GET /admin/claims/stale`.
- [ ] 11.3 Build NGO verification audit log view, searchable by org_name/registration_number.
  **Verify:** manual test — search narrows results correctly for both fields.
- [ ] 11.4 Confirm no UI control anywhere in the admin panel can mutate an NGO's verification status.
  **Verify:** manual UI walkthrough; cross-check against Phase 8.5's route-level confirmation.

---

## Phase 12 — Cross-Cutting Testing (spec.md §6 full coverage)

- [ ] 12.1 Assemble the full state-machine unit test suite into one file, covering every row of LLD §2 plus all illegal transitions (consolidates Phase 4.2/4.3).
  **Verify:** suite runs standalone and passes.
- [ ] 12.2 Assemble the full validation-rule suite per LLD §5 (item requirements, cancellation reason, NGO signup fields, receiver fields) into one file.
  **Verify:** suite runs standalone and passes.
- [ ] 12.3 Build an integration test harness with isolated test-DB setup/teardown per test run.
  **Verify:** two tests run back-to-back don't leak state (e.g. duplicate-key failures from a prior run).
- [ ] 12.4 Write one integration test per core flow: 6.1 create, 6.2 cancel, 6.3 verification, 6.4 claim→pickup→distribute, 6.5 expiry, 6.6 admin moderation.
  **Verify:** 6 integration tests, each traceable to its spec.md subsection, all passing.
- [ ] 12.5 Set up an E2E framework (e.g. Playwright).
  **Verify:** a trivial "app loads" E2E test passes in CI.
- [ ] 12.6 Write E2E test: full donor journey (create listing → see status progress → receive delivered confirmation).
  **Verify:** test passes headless in CI.
- [ ] 12.7 Write E2E test: full NGO journey (signup → verified → claim → pickup → distribute).
  **Verify:** test passes headless in CI.
- [ ] 12.8 Write a security spot-check script iterating every role-gated endpoint with the wrong role/ownership (donor on NGO routes, NGO A on NGO B's claim, non-admin on admin routes).
  **Verify:** script asserts 403/404 on every case; any endpoint that doesn't reject correctly fails the script.
- [ ] 12.9 Wire unit, integration, E2E, and the security script into CI as required checks.
  **Verify:** CI is green end-to-end on a clean branch; a deliberately broken transition rule fails CI (sanity-check the sanity-check).

---

## Phase 13 — Deployment

- [ ] 13.1 Provision production PostgreSQL, run all migrations from Phase 1 against it.
  **Verify:** schema in prod matches schema in dev (`\dt` / migration status check).
- [ ] 13.2 Provision production Cloudinary account/credentials.
  **Verify:** a real upload from the deployed backend returns a working URL.
- [ ] 13.3 Provision production Firebase Auth project.
  **Verify:** a real signup against prod creates a user resolvable via the Firebase console.
- [ ] 13.4 Deploy backend (API server + the Phase 6 background job) to chosen hosting.
  **Verify:** `GET /health` on the prod URL returns 200; job logs show it firing on schedule.
- [ ] 13.5 Deploy frontend to chosen hosting, pointed at the prod API.
  **Verify:** prod frontend URL loads and successfully calls prod `/health`.
- [ ] 13.6 **[BLOCKED on open item]** Configure the real government verification source integration behind the `verifyNgo` seam, replacing the Phase 2 stub.
  **Verify:** cannot be completed until spec.md §10's "which government verification source" is decided; staging continues on the stub in the meantime. Track as a blocked task, not skipped silently.
- [ ] 13.7 Run a full production smoke test of the five-step core flow (spec.md §4) with a real donor account and a test NGO account.
  **Verify:** listing goes `Listed → Claimed → Picked up → Delivered` in prod, with correct notifications at each step.

---

## Blocked / Open-Item Tasks

These cannot reach a final "done" state until the corresponding open item in `spec.md` §10 / `plan.md` is resolved. They are tracked here rather than silently deferred:

- [ ] Replace `verifyNgo` stub with the real government verification source integration (blocks 13.6).
- [ ] Finalize `/ngo/:id/reverify` resubmission semantics (in-place mutation vs. new signup) once product confirms (affects 2.8).
- [ ] Tune the default "nearby" radius and sort algorithm post-launch with real usage data (affects 4.5).
- [ ] Confirm with product that precise-location masking (task 4.7) is the intended behavior, not just the safer engineering default.
- [ ] Revisit cron vs. queue for the expiry job (task 6.1) only if scale ever requires it.

## Explicit Non-Goals (carried from spec.md §8 / plan.md)

Do not create tasks for: payments, receiver accounts/login, real-time NGO GPS tracking, multi-language support, ratings/reviews, push/SMS/email/WhatsApp notifications, in-app chat, map view, impact dashboards, gamification/badges. If a task like this appears mid-build, it belongs in a future-scope backlog, not here.
