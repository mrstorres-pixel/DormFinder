# Deployment runbook — Codex execution

This is prepared infrastructure, not evidence of a deployed service. Docker execution and provider integration remain pending.

## User account actions

Create or sign in to free Supabase, Render, Vercel and later MapTiler. Connect the available integrations to these accounts and authorize the confirmed GitHub repository. Choose the administrator identity; enter credentials/passwords through secure provider, CI or local secret interfaces. Do not paste secrets into chat.

Codex performs provisioning, configuration, commands, migrations, testing and documentation. No manual coding is assigned to the user.

## Supabase

Codex records the actual PostgreSQL version and limits, provisions schema `dormfinder`, a migration owner and restricted runtime login. Application tables are outside exposed schemas. Disable Data API access to this schema and remove anonymous/authenticated grants. Supabase Auth is unused.

Use dashboard-provided IPv4 session-pooler connection parameters, port 5432, TLS `verify-full`. Obtain the project CA if needed; do not fall back to disabled certificate verification. The runtime role gets schema usage, table CRUD and sequence usage, with default privileges from the migration owner covering new tables; it gets no schema creation privileges. Keep migration credentials separate.

Create private bucket `property-photos`. No anonymous read/upload policies. Generate server-only S3 credentials and copy endpoint/region from Supabase. S3 credentials bypass RLS, so Laravel ownership/visibility checks are mandatory. Uploaded images never use Render disk.

## Render Free

Use `render.yaml` and Docker context `backend/`. Singapore is requested, subject to account availability. The container uses PHP 8.4 FPM + nginx, four ondemand PHP workers and port 10000. Readiness path `/api/v1/health` checks database/migrations.

Populate `backend/.env.production.example` setting names securely. Persist APP_KEY across restarts; never regenerate at startup. Set final API/frontend HTTPS URLs, exact Sanctum stateful frontend hostname, explicit CORS origin. Host-only session domain is unset. Production requires debug disabled, secure database sessions, private S3 storage and verified database TLS.

Render terminates HTTPS; trusted proxy configuration must pass live tests. Inspect and restrict actual provider proxy boundaries when available. Standard CA roots are configured; optional DB_SSL_CA_BASE64 supplies the project CA to an ephemeral certificate file, not uploaded media.

Startup validates required settings and caches config. It **does not migrate or seed**. Migrations run separately before deployment with controlled credentials. Render Free lacks shell/one-off jobs, so administrator provisioning/cleanup run through Codex's controlled local environment.

## Vercel Hobby

Project root `frontend/`, Node 24. `vercel.json` runs `npm run build:vercel`. Set **BACKEND_ORIGIN** to the provisioned HTTPS Render origin (no path). VITE_API_BASE_URL is `/api/v1`. VITE_MAPTILER_KEY is a restricted public key only when maps are implemented.

The build creates Vercel Build Output API v3 routing:
1. /api/* → actual Render API
2. /sanctum/* → actual Render CSRF endpoint
3. static files
4. React history fallback

No hardcoded invented deployment host. Missing/invalid origin fails the deployment build. Preview builds are deliberately rejected until a separate nonproduction database/backend is configured. Production secrets never enter VITE_* or frontend artifacts.

Build Output routing follows [Vercel's configuration reference](https://vercel.com/docs/build-output-api/configuration). Actual cookie forwarding, response cache behavior and cold-start handling still require deployed tests.

## CI and controlled migrations

`.github/workflows/ci.yml` runs Composer validation, PHP 8.4/Pint/PHPUnit against PostgreSQL 17, clean npm install/lint/component tests/build, Chromium/WebKit tests and Docker build. It uses an isolated disposable CI database. Untrusted PR jobs receive no production secrets.

`release-database.yml` is manual, main-branch only, serialized and protected by GitHub's production environment. It reruns CI before migration. Codex first takes a private database export, verifies the target and records it. Populate protected migration secrets and CA as documented in that workflow. Run additive migrations only; no truncation or automatic destructive demo seed.

Until provider access exists, deployment is orchestrated by Codex after these checks; no workflow pretends to provision accounts or deploy with absent credentials.

## Live Phase 1 acceptance gate

Run frontend Playwright with E2E_BASE_URL equal to the provisioned frontend URL. Tests register clearly synthetic test accounts and create test drafts, so use the designated demo environment with explicit test authorization.

Verify:
- Secure/HttpOnly/SameSite=Lax host-only cookies, CSRF required on writes.
- Chromium and WebKit register/login/logout/password revocation through the proxy.
- Other users and guests cannot retrieve drafts/photos through protected endpoints.
- PostgreSQL pooler TLS, restricted runtime grants and connection count.
- Private S3 upload/read/delete, metadata removal and signed expiry.
- Rows, sessions and images survive Render restart/redeploy.
- API responses are no-store; no debug/secrets in responses, bundles or logs.
- Render idle wake-up and retry state; no paid upgrades.
- Actual free limits and Supabase inactivity behavior.

Record outcomes and provider URLs in validation.md. No substantial Phase 2 expansion until this gate passes.

## Recovery and later release

Free Render sleeps after idle time and has ephemeral disks; Supabase free projects may pause. Pre-demo checks and a tested local fallback are required. Keep small assets and track quotas. Restore the prior compatible application deployment for rollback; additive migrations must remain compatible. Never run destructive rollback against production without a reviewed backup/restore plan. Cleanup command: `artisan dormfinder:photos-cleanup --dry-run`, then controlled execution.

Demo seeds are not implemented yet; no current seeder creates users or resets passwords. Final release requires explicit safe demo seeding, release tag, two rehearsals and a privately stored database export.

