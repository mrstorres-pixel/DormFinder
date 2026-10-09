# DormFinder

Housing discovery and inquiries for students near Technological Institute of the Philippines Manila. Laravel owns authentication and business rules; React provides the interface. More campuses are planned.

## Current implementation — October 9, 2026

**Phases 1–4 are deployed and verified at [DormFinder](https://dormfinder-pink.vercel.app), with the user-approved temporary GitHub CI exception. Later phases remain outstanding.**

The live and local databases now include 16 clearly labeled fictional sample listings, each with two room options and two illustrative layout images. [Browse the samples](https://dormfinder-pink.vercel.app/listings?q=DEMO). Prices, addresses and map pins are synthetic. Three additional samples demonstrate draft, pending-review and rejected states and remain private. Student accounts can save favorites, compare options and send inquiries; sample-owner replies are for demonstration only.

Available: student/landlord registration, session login/logout, profile name/password changes, controlled administrator creation, private landlord property drafts, optimistic revision checks, private normalized photo upload/removal, database sessions, PostgreSQL migrations, error states and a responsive interface.

Deployed Vercel → Render → Supabase PostgreSQL/private Storage checks pass: four Chromium/WebKit browser tests, secure sessions/CSRF, private drafts/photos, certificate-verified pooler TLS and persistence after redeployment. Confirmed Render sleep/cold wake-up passes: readiness returned through Vercel in 24.3 seconds, and the existing session, draft and private photo survived. Phase 1 is accepted with the user-approved temporary GitHub CI exception. CI is blocked by an account billing lock; local checks and controlled deployments remain required before each release. Existing local work and unrelated provider resources were preserved.

Phase 2 adds room options with inventory and PHP charges, submission/administrator review, public listing details, selected-option comparison and participant-only inquiries/replies. Local acceptance and all six deployed Chromium/WebKit tests pass, including the complete landlord, administrator and student workflow. Phase 3 adds same-option rent/availability search, property type and price-basis filters, stable sorting/pagination, private favorites, full comparison, photo gallery and maps/campus distance. Local and deployed acceptance pass in Chromium/WebKit. Phase 4 adds private listing reports, listing/account suspension, archival/restoration, audit history, in-app notifications and role-scoped counts. All 79 backend tests, 15 frontend tests, lint/build and six local plus six deployed Chromium/WebKit checks pass. Later phases add hardening, safe demo seeds and final rehearsal. These are tracked in [implementation status](docs/status.md).

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

Open **http://127.0.0.1:5173**. Register through the interface; there are no shared default passwords. Generated credentials for synthetic demonstration accounts stay in ignored private files. Local database credentials are generated into ignored files. The database listens only on loopback port 54329. Images stay in private local storage during development.

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

The account owner chooses the real identity and enters the password securely. Controlled automation can pass --password-file with a private file instead of putting a password in command arguments. Existing accounts are never overwritten. This command is not a public endpoint. Synthetic test administrators use separate ignored credential files.

## Deployment and presentation

See [deployment runbook](docs/deployment.md), [architecture and permissions](docs/architecture.md), and [validation evidence](docs/validation.md). Cloud Docker build/startup and deployed integration are verified; the separate Linux CI run remains blocked by the GitHub account restriction.

DormFinder intends to support SDG 11 through centralized location information, SDG 4 through campus-oriented housing discovery, and SDG 1 through transparent housing costs. No proven safety, affordability, poverty-reduction or education outcome is claimed.

