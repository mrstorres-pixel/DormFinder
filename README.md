# DormFinder

Housing discovery and inquiries for students near Technological Institute of the Philippines Manila. Laravel owns authentication and business rules; React provides the interface. More campuses are planned.

## Current implementation — October 9, 2026

**Phase 1 local slice is implemented and validated. The full release is not complete.**

Available: student/landlord registration, session login/logout, profile name/password changes, controlled administrator creation, private landlord property drafts, optimistic revision checks, private normalized photo upload/removal, database sessions, PostgreSQL migrations, error states and a responsive interface.

Pending: provision and test Vercel → Render → Supabase PostgreSQL/private Storage. Provider integrations are not connected. The approved plan requires this deployment gate before substantial feature development.

Later phases: room options, administrator review, public discovery, favorites/comparison, participant-only inquiries and notifications, reports/moderation, synthetic seed data and final demonstration. These are tracked in [implementation status](docs/status.md).

## Repository

- `frontend/`: React 19.3, Vite 8.3, Bootstrap 5.3, React Router, TanStack Query, Axios.
- `backend/`: Laravel 13.35, Sanctum 4.3, PostgreSQL, Flysystem S3.
- `scripts/`: isolated Windows setup, local database, start/stop and validation.
- `docs/`: architecture, deployment, API and test evidence.

## Local development

Codex executes these commands; no production credentials or manual code assembly are needed. Node 24 and Windows x64 are prerequisites. The scripts use an isolated PHP 8.4.26 and PostgreSQL 17.11, preserving XAMPP.

```powershell
powershell -ExecutionPolicy Bypass -File scripts/bootstrap.ps1
powershell -ExecutionPolicy Bypass -File scripts/start-local.ps1
```

Open **http://127.0.0.1:5173**. Register through the interface; there are no seeded passwords. Local database credentials are generated into ignored files. The database listens only on loopback port 54329. Images stay in private local storage during development.

To validate with local servers running:

```powershell
cd frontend
npx.cmd playwright install chromium webkit
cd ..
powershell -ExecutionPolicy Bypass -File scripts/check.ps1
```

Stop tracked application servers with `scripts/stop-local.ps1`; stop PostgreSQL with `scripts/local-database.ps1 -Stop`. Restarting preserves data. Scripts never overwrite an existing administrator or recreate an initialized database.

Administrator provisioning, performed by Codex, prompts privately for the password:

```powershell
cd backend
& '..\.tools\php\php.exe' artisan dormfinder:admin administrator-email --name='Administrator name'
```

The account owner chooses the real identity and enters the password securely. This command is not a public endpoint.

## Deployment and presentation

See [deployment runbook](docs/deployment.md), [architecture and permissions](docs/architecture.md), and [validation evidence](docs/validation.md). Cloud deployment and container execution are explicitly unverified until account access and CI are available.

DormFinder intends to support SDG 11 through centralized location information, SDG 4 through campus-oriented housing discovery, and SDG 1 through transparent housing costs. No proven safety, affordability, poverty-reduction or education outcome is claimed.

