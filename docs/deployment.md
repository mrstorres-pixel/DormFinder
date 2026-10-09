# Deployment runbook — Codex execution

Phases 1–4 are live at [DormFinder](https://dormfinder-pink.vercel.app), using [Render API](https://dormfinder-api.onrender.com) and private Supabase PostgreSQL/Storage. Deployed browser and redeploy-persistence checks pass. Confirmed sleep/cold wake-up returned ready through Vercel in 24.3 seconds and preserved session/draft/photo data; GitHub CI remains blocked by the account restriction described in validation.md.

## October 9 continuation checkpoint

Use these existing resources; do not recreate them:

- Supabase project `zujrpipjkgwqwlipgpwe`, organization `aathhjqtgfhrcrhmmgqp`, Free/Singapore. Keep BodegaWebsite untouched.
- Render service `srv-db44ecrbc2fs73aj14q0`, workspace `tea-d7ip6vu7r5hc73ccjjng`, Free/Singapore. Keep websys2 untouched. [Service dashboard](https://dashboard.render.com/web/srv-db44ecrbc2fs73aj14q0).
- Vercel project `prj_Qb4KB7USZuY9HmzezIdVfrpRXiB1`, team `team_lakGFdG84Dlw3s6qfEG8IKQc` / mrstorres-pixels-projects, Hobby. [Project dashboard](https://vercel.com/mrstorres-pixels-projects/dormfinder).

Released application source is `da0f30d6c9490fbee1ec199921a60c25bd547463`. Vercel production `dpl_6a3vc6AUdf2n3TmScgakC67tEiEG` was deployed from a clean archive of that commit. Verified Render deployment is `dep-db4d47rncjis73ck7m8g`, with the same source commit. Readiness returns phase 4; all six deployed checks pass in one Chromium/WebKit run (4.0 minutes). Render auto-deploy is off and Vercel Git auto-deployment is not connected; later releases require explicit deployment.

Supabase now has nine applied Laravel migrations, twenty-one application tables, owner/runtime logins and private bucket `property-photos`. A private application-schema export preceded migration. Preserve applied migrations and stable APP_KEY/passwords. Never migrate or seed during container startup.

Render Docker context is `backend`, Dockerfile `backend/Dockerfile`, Docker Command **`/var/www/html/docker/entrypoint.sh`**. The user corrected the command after the original compound command failed. Successful deployments now pass startup/readiness. Health-check path is currently unset in the provider; `/api/v1/health` was manually verified.

The Vercel connector rejects writes and its listing may be stale; authenticated CLI readback is authoritative for this project. Use explicit team/project scope. Preserve root `frontend`, Node 24, `npm ci`, `npm run build:vercel`, disabled previews and disabled external rewrite caching.

## Credentials and approved account actions

The user approved this organization/workspace and sending APP_KEY, runtime database password and S3 keys to the DormFinder Render service after automatic review initially rejected the transfer. Migration/administrator passwords were excluded from Render; Vercel received only BACKEND_ORIGIN, not private backend credentials.

Ignored files `.secrets/supabase.production.env`, `.secrets/cloud-state.json` and `.secrets/render.production.json` hold supplied pooler/S3 settings and persisted production keys. Do not display, commit, overwrite or regenerate them during a resume. The local Laravel environment/database remain separate. The public project CA is supplied by `prod-ca-2021.crt`; Render materializes its base64 environment value at `/tmp/database-ca.pem` for verified TLS.

Codex performs configuration, migrations, tests and documentation. The account owner must resolve the GitHub billing lock and choose the eventual real administrator identity; no paid upgrade is authorized. Enter credentials only through secure provider/local interfaces.

## Supabase

Codex records the actual PostgreSQL version and limits, provisions schema `dormfinder`, a migration owner and restricted runtime login. Application tables are outside exposed schemas. Disable Data API access to this schema and remove anonymous/authenticated grants. Supabase Auth is unused.

Use dashboard-provided IPv4 session-pooler connection parameters, port 5432, TLS `verify-full`. Obtain the project CA if needed; do not fall back to disabled certificate verification. The runtime role gets schema usage, table CRUD and sequence usage, with default privileges from the migration owner covering new tables; it gets no schema creation privileges. Phase 4 revokes UPDATE/DELETE on moderation_actions, preserving SELECT/INSERT for append-only application history. Keep migration credentials separate.

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

Build Output routing follows [Vercel's configuration reference](https://vercel.com/docs/build-output-api/configuration). Cookie forwarding and no-store API responses passed deployed tests. Confirmed idle sleep, cold recovery and persistence evidence are recorded in validation.md.

## CI and controlled migrations

`.github/workflows/ci.yml` runs Composer validation, PHP 8.4/Pint/PHPUnit against PostgreSQL 17, clean npm install/lint/component tests/build, Chromium/WebKit tests and Docker build. It uses an isolated disposable CI database. Untrusted PR jobs receive no production secrets.

`release-database.yml` is manual, main-branch only, serialized and protected by GitHub's production environment. It reruns CI before migration. Codex first takes a private database export, verifies the target and records it. Populate protected migration secrets and CA as documented in that workflow. Run additive migrations only; no truncation or automatic destructive demo seed.

Provider access exists and this release was deployed explicitly by Codex. CI must be rerun after the GitHub account restriction is resolved; the database-release workflow has not been used and its production secrets have not been configured.

## Live acceptance gates

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

Record outcomes and provider URLs in validation.md. Phases 1–4 passed deployed acceptance with the user-approved temporary GitHub CI exception. Until CI is restored, complete local checks before every release and keep migrations backed up and controlled.

## Recovery and later release

Free Render sleeps after 15 minutes idle and has ephemeral disks; Supabase free projects may pause after a week inactive. See the dated limits and measurements in validation.md. Pre-demo checks and a tested local fallback are required. Keep small assets and track quotas. Restore the prior compatible application deployment for rollback; additive migrations must remain compatible. Never run destructive rollback against production without a reviewed backup/restore plan. Cleanup command: `artisan dormfinder:photos-cleanup --dry-run`, then controlled execution.

Demo seeds are not implemented yet; no current seeder creates users or resets passwords. Final release requires explicit safe demo seeding, release tag, two rehearsals and a privately stored database export.


## Phase 2 controlled release

A fresh private application-schema export preceded the additive five-table migration. Keep the existing owner/runtime passwords, APP_KEY, S3 settings and provider projects. No migrations or seeds run at container startup. A synthetic cloud review administrator has credentials in ignored .secrets/phase2-cloud-admin.json; use E2E_ADMIN_FILE to point deployed browser checks at that fixture, never at a real administrator or chat-supplied password. Local/CI fixture setup is node frontend/scripts/e2e-admin.mjs with E2E_PHP_BINARY set to the isolated PHP path when needed. No fixture command truncates or overwrites accounts.

The existing GitHub CI restriction is explicitly deferred by the user; local checks must pass before this release. Both provider deployments use the reviewed committed source and the full deployed browser story passed on October 9. Prior drafts/photos are intact; the older Phase 1 session had exceeded its normal two-hour lifetime and was renewed through login. Preserve existing records and credentials in future releases.

## Phase 3 controlled release

The eighth additive migration creates campuses and favorites and adds discovery indexes. Take a fresh private application-schema export and verify its catalog first. Existing source tables/records, keys and grants are preserved. The fixed Casal reference is inserted once by the migration; no startup seed or data reset is used. Confirm runtime reads both new tables without schema CREATE and inspect security advisors. Deploy the reviewed source to the same Render/Vercel targets, then run the extended three-role browser story with the existing private synthetic administrator file. Registration remains limited to 10/hour per IP; respect that limit when repeating suites.

Leaflet is already locked in the existing frontend dependencies. No API key or paid map service is required. Map tiles are requested only after Show map; the browser uses normal caching and Referer headers, with visible OpenStreetMap attribution. VITE_MAP_TILE_URL is optional; changing providers requires compatible attribution/terms.

Reusable synthetic landlord/student fixtures are private .secrets/discovery-browser-{local|cloud}-{chromium|webkit}.json files. Codex provisions these only in the verified local database or confirmed DormFinder cloud project, preserving existing accounts/passwords. Browser tests sign in with them when present; fresh CI falls back to UI registration and records its generated fixtures privately. The original Phase 1 registration checks still run. The release archive must exclude every .secrets/.local file.

Phase 3 deployment completed October 9: the backup catalog, additive migration, restricted runtime reads, security advisors and original draft/photo readback passed. The Phase 3 application release was the exact tested eae862f source. Its separate evidence checkpoint includes an opt-in CampusSeeder for reference recovery; it uses insertOrIgnore, never overwrites an existing campus, is not wired into startup/default seeding, and was not run against production. No demo dataset or automatic destructive seed was introduced.

## Phase 4 controlled release

The ninth additive migration creates listing_reports, moderation_actions and user_notifications, adds users.moderation_revision, copies existing listing reviews into audit history and revokes audit UPDATE/DELETE from the existing restricted runtime. A fresh private application-schema export and pg_restore catalog inspection passed first. No existing users, passwords, listings, photos, role assignments or source migrations were overwritten; no new fixtures or provider resources were needed.

The reviewed commit above was deployed explicitly to the existing Render/Vercel projects. Render became live at 11:39:01 UTC / 19:39:01 Singapore on October 9. Vercel production is READY with the existing pink alias; local CLI 58.11.0 and cloud build CLI 62.1.0 were used. Runtime read/insert and revoked privileges, security advisors, readiness, original private data, public assets and the complete deployed browser flow passed.

Use the existing private synthetic browser fixtures for acceptance. The extended check temporarily suspends only its verified Synthetic/example.test landlord, reactivates through the administrator endpoint, signs in again, and verifies drafts stay unpublished. Recovery reactivates that fixture if interrupted after suspension. Archive/suspension preserves photos and inquiry history. No cleanup resets a database or deletes real users/listings. The public demo fixtures are withdrawn through normal owner edits.

Notifications require no queue, email provider, keys or paid service. Keep them inside the existing database transaction and retain recipient scoping. No audit mutation API exists. Existing migration credentials remain separately privileged and are never transferred to the application host.

GitHub validation run 37924843463 / job 113801198599 was blocked before all steps by the existing account billing restriction. The approved exception remains; Phase 5 still needs hardening, safe synthetic seed tooling, rollback/local fallback and two deployed rehearsals.
