# Backend

Node.js/Express API server for the Clothing Donation App (per `Design/HLD.md` §3, `Design/LLD.md`).

Not yet implemented — scaffolding added in `Spec/tasks.md` task 0.1. See `Spec/plan.md` Phase 0 for setup steps.

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
