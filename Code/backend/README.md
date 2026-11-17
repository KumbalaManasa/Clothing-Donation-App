# Backend

Node.js/Express API server for the Clothing Donation App (per `Design/HLD.md` §3, `Design/LLD.md`).

## Running the full app locally (Task 13A)

No Cloudinary or Firebase account is required for local development. Image
uploads are saved to `backend/uploads/` and auth uses a self-issued JWT
(`JWT_SECRET`). See `Spec/tasks.md` Phase 13A for what's in/out of scope.

For AWS production, set `IMAGE_STORAGE_DRIVER=s3` and configure a private S3
bucket with CloudFront Origin Access Control. The ECS task role needs
`s3:PutObject` permission for the bucket's `uploads/*` prefix; do not configure
long-lived AWS access keys. See [`AWS_DEPLOYMENT.md`](../../AWS_DEPLOYMENT.md).

1. **PostgreSQL** — start the local instance (see "Local dev PostgreSQL" below), then from `Code/backend`:
   ```
   npm install
   npm run migrate:up
   npm run seed
   ```
2. **Backend** — from `Code/backend`:
   ```
   copy .env.example .env      # fill in DATABASE_URL and JWT_SECRET; leave
                                # CLOUDINARY_*/FIREBASE_* blank and
                                # IMAGE_STORAGE_DRIVER=local (the default)
   npm start
   ```
   Confirm it's up: `curl http://localhost:4000/health` → `{"status":"ok"}`.
3. **Frontend** — from `Code/frontend`:
   ```
   npm install
   npm run dev
   ```
   Open the printed local URL (default `http://localhost:5173`).
4. **Test the full flow**: sign up as a donor, create a listing with a photo,
   and check "My Listings" — the photo you uploaded should render inline. The
   file itself lands under `Code/backend/uploads/<generated-name>.<ext>` and is
   served back at `http://localhost:4000/uploads/<generated-name>.<ext>`.
   Sign up as an NGO with a registration number starting with `APPROVED-`
   (passes the verification stub — see `src/services/verifyNgo.js`) to claim,
   pick up, and distribute it.
5. **Admin panel**: there's no admin signup form (deliberate — spec.md §3/§6.6,
   admin accounts aren't self-service). Log in at `/admin` with the seeded dev
   admin account instead (`npm run seed` creates it): email
   `dev.admin@example.com`, password `devpassword123`. The same password
   works for the seeded donor (`dev.donor@example.com`) and NGO accounts
   (`dev.ngo.verified@example.com` / `dev.ngo.notverified@example.com`) if
   you'd rather not sign up fresh ones through the UI.

Run the backend test suite with `npm test` (from `Code/backend`) — this needs
`TEST_DATABASE_URL` set (see `.env.example`) pointed at a real Postgres
instance. `npm test` (`scripts/run-tests.js`, task 12.3) creates that database
if it doesn't exist yet, migrates it, and truncates every app table to a clean
slate before each run — the suite never touches `DATABASE_URL`'s dev data, and
two runs in a row never leak state into each other.

## Local dev PostgreSQL (task 0.8)

PostgreSQL 17 is installed system-wide (`winget install PostgreSQL.PostgreSQL.17`), but the dev
database runs as a **separate, self-managed instance** owned by the local user, not the Windows
service — the Windows service (`postgresql-x64-17`, port 5432) requires admin rights to
administer and was left untouched.

- Data directory: `%USERPROFILE%\.donation-app-pgdata`
- Port: `5433` (5432 is taken by the untouched Windows service)
- Auth: `trust` (local dev only, no password)
- Database: `donation_app_dev`

Start it:
```
"C:\Program Files\PostgreSQL\17\bin\pg_ctl.exe" -D "%USERPROFILE%\.donation-app-pgdata" -l "%USERPROFILE%\.donation-app-pgdata-log.txt" -o "-p 5433" start
```

Stop it:
```
"C:\Program Files\PostgreSQL\17\bin\pg_ctl.exe" -D "%USERPROFILE%\.donation-app-pgdata" stop
```

`DATABASE_URL` for this instance is already set in `.env` (not committed):
`postgres://postgres@127.0.0.1:5433/donation_app_dev`.
