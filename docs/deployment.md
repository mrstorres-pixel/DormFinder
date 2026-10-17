# Deployment runbook — Codex execution

Phases 1–4 are live at [DormFinder](https://dormfinder-pink.vercel.app), using [Render API](https://dormfinder-api.onrender.com) and private Supabase PostgreSQL/Storage. Deployed browser and redeploy-persistence checks pass. Confirmed sleep/cold wake-up returned ready through Vercel in 24.3 seconds and preserved session/draft/photo data. The historical GitHub CI account restriction described in validation.md has not been reverified in this frontend release.

## Guided landlord editor, map previews and mobile navigation — October 17, 2026

Frontend application 2c75af25e0f1f78909972156091197187ab6f3c7 is READY in Vercel dpl_4iKwTM2rDZmftSHnoV5Ls1GG34eB at https://dormfinder-5l3lgpt88-mrstorres-pixels-projects.vercel.app and promoted to https://dormfinder-pink.vercel.app. The staged build was created October 17, 2026 at 21:24:18 Singapore time. Ten staged JS/CSS assets match SHA256 values from the tested local build, including entry index-CXn15Usc.js, LandlordWorkspace-CSN8Q0jI.js/CUMLn43e.css, ListingPages-KU9101vF.js/l1GskP3z.css, Discovery-QLE16wY7.js/EQccwdXz.css, ListingInformation-_JVlbi_U.js, index-Dgi_xlPk.css and unchanged dormRoom-By6Gg0dT.js.

Existing team team_lakGFdG84Dlw3s6qfEG8IKQc / project prj_Qb4KB7USZuY9HmzezIdVfrpRXiB1, frontend root, Node 24, npm ci and npm run build:vercel were verified. A clean git archive of committed source supplied the release; secrets, local runtime artifacts and the user certificate were excluded. The first staged candidate eb8324a was superseded by the room-draft correction and was never promoted to the pink public alias. The corrected production build was staged with --skip-domain, accessed with existing authenticated vercel curl, verified byte for byte, then promoted. No deployment-protection, provider, environment, free-plan or dependency setting changed.

Final acceptance: 81 frontend tests across 23 files, ESLint and production build pass. All 92 scoped local production-build Chromium/WebKit cases pass in one final run (3.5 minutes). Both complete three-role Phase 2 workflows pass again after the final room-form change (3.8 minutes); the six Phase 1 cases retain their earlier passing evidence. All 96 live Chromium/WebKit cases pass in one final run, including actual-account draft protection and real pedestrian routing. Both engines exercise actual WebGL, reduced-motion changes, failed loading, context loss, reverse scroll and campus/preference search. No failures or skips remain in these final acceptance runs.

Additional public acceptance passes built JS/CSS credential scanning, self-hosted font/demo-image readiness, actual 3D/API readiness, 15 campuses, 16 map matches and 16 real map tiles with zero failures. A read-only journey using existing synthetic owner/student accounts passes signed-image preview, mobile navigation and composer placement with zero page errors and no application-record writes. Its initial five-second login assertion expired while the service was still responding; the check now allows the existing 90-second request window and passes. Synthetic test credentials and filled-login screenshots are excluded from release artifacts. Live browser cases use controlled fixtures where appropriate; actual-account draft, signed-image, API and pedestrian-route checks are additional real-service evidence.

Backend stays cef1f6dbc99b822330fda02e45cad26b08d9a64f / Render dep-db8v1urrjlhs73dl7njg, service srv-db44ecrbc2fs73aj14q0. No backend deployment, migration, private-schema or storage-policy change was required. Immediate frontend recovery reference is 693d2a2a8e21835fd93f02e374da3dfac0500c77 / dpl_Gy5zFCM7gtwvautn6jyPh8hn2TZp at https://dormfinder-6fckjrh0q-mrstorres-pixels-projects.vercel.app using the same backend. Reinspect aliases/artifact availability before recovery. Preserve all existing Saved places metadata/private notes; do not reverse its additive migration for an application rollback. Live backend rollback remains explicitly deferred; the historical unverified GitHub CI exception retains its prior status. The certificate remains untracked with unchanged SHA256 700723581420DD1AC98FD7E9AC529F0EF210EADCAF87FC868A3AD7D114C2F3B7.

## Cards, visible room choices and comparison — October 16, 2026

Current frontend application source: 693d2a2a8e21835fd93f02e374da3dfac0500c77. Vercel production deployment dpl_Gy5zFCM7gtwvautn6jyPh8hn2TZp is READY at https://dormfinder-6fckjrh0q-mrstorres-pixels-projects.vercel.app and promoted to https://dormfinder-pink.vercel.app. Created October 16 at 23:17:45 Singapore time. Existing team team_lakGFdG84Dlw3s6qfEG8IKQc / project prj_Qb4KB7USZuY9HmzezIdVfrpRXiB1, frontend root, Node 24, npm ci and npm run build:vercel were inspected before release. A clean git archive containing only committed files supplied the deployment; the existing project link was verified. No provider configuration, dependency, paid resource or environment credential changed.

The staged entry index-Ba3qtUef.js, ListingPages-B-E6QqqE.js, Discovery-BUxUAH9K.js, Discovery-CNSKDJ_P.css and unchanged deferred engine dormRoom-By6Gg0dT.js match SHA256 values from the tested local build. Existing authenticated vercel curl accessed the protected stage without changing deployment protection. Public asset credential scan, Inter/demo assets, actual 3D/API readiness, 15 campuses, 16 map matches and 16 real map tiles with zero failures pass. An additional read-only journey uses the real public API/signed images and confirms chosen-room price/card/comparison/details continuity, radio switching, mobile overflow and gallery behavior.

Backend remains cef1f6d / Render dep-db8v1urrjlhs73dl7njg; no backend deploy, data/schema/storage/permission change was required. Immediate frontend recovery reference: 4519e3f / dpl_6vXx2SipD91faPUoW2TFf2ghyZTm at https://dormfinder-awq6l9wgw-mrstorres-pixels-projects.vercel.app, using that same backend. Re-inspect aliases and artifact availability before recovery. The existing Saved places metadata/private notes must remain; do not roll back its additive migration for an application rollback. Live backend rollback rehearsal stays deferred, and the historical unverified GitHub CI exception retains its previous status. All 50 scoped live Chromium/WebKit cases pass in one run, including both actual-account draft-protection cases; no skips or failures. Full acceptance and screenshot references are recorded in validation.md. The certificate remains untracked with its verified unchanged SHA256.

## Gallery and hero polish — October 16, 2026

Current frontend source is 4519e3f7a71f94e3f2673f04cc8e955a6591eafc, READY in Vercel dpl_6vXx2SipD91faPUoW2TFf2ghyZTm at https://dormfinder-awq6l9wgw-mrstorres-pixels-projects.vercel.app and https://dormfinder-pink.vercel.app. Entry index-mUnqElb9.js, gallery/map Discovery-Cda3eZec.js, photo CSS Discovery-Bek4b5c9.css and deferred engine dormRoom-By6Gg0dT.js match the tested build; main CSS remains index-DA_MsN22.css. The original wall/camera journey is retained with an extended facade/baseboards, and the photo viewer uses existing native dialog infrastructure with no added dependencies.

The clean committed archive .local/gallery-hero-source-4519e3f was linked after verifying project prj_Qb4KB7USZuY9HmzezIdVfrpRXiB1 / team team_lakGFdG84Dlw3s6qfEG8IKQc. Project inspection confirmed frontend root, Node24 and existing npm ci/build:vercel settings. The production deployment was staged with --skip-domain, checked using authenticated Vercel CLI access, then promoted after backend readiness. The gallery/map and 3D assets were SHA256-identical to local tested assets. Deployment protection and all environment values were retained. Thirteen staged source/test/documentation files passed credential/excluded-file scanning.

All 52 scoped live Chromium/WebKit checks pass in a single final run, including actual WebGL, gallery/modal behavior, university/room search, saved-place/viewing drafts, map/comparison synchronization and actual walking routes. Additional real signed demo-image desktop/mobile checks pass. Public JS/CSS credential scanning, fonts/demo assets, 3D/API readiness, 15 campuses, 16 map matches and 16 real tiles with zero failures pass. The user certificate stays untracked and its SHA256 is unchanged. Final evidence and initial validation failures are recorded in validation.md.

Backend remains cef1f6d / Render dep-db8v1urrjlhs73dl7njg on the same free service; no backend deploy, schema/data/storage/permission change or paid resource was needed. The immediately preceding frontend recovery reference is cef1f6d / dpl_83tf9nAnRWs3PBjvzdv6BeDvbR9y with that same backend. Re-inspect current aliases and artifact availability before recovery; no rollback rehearsal occurred. Keep the existing additive Saved places metadata and private notes. The deferred backend rollback rehearsal, historical unverified GitHub CI exception and other roadmap items retain their earlier status.

## Walking routes and campus label separation — October 16, 2026

Current application source is cef1f6dbc99b822330fda02e45cad26b08d9a64f. The existing free Render service srv-db44ecrbc2fs73aj14q0, in the user-confirmed workspace tea-d7ip6vu7r5hc73ccjjng, is live on dep-db8v1urrjlhs73dl7njg since 09:41:10 UTC. Auto-deploy remains off and the established Docker entrypoint is retained. No schema migration, environment/permission change, dependency or paid resource was required.

Vercel dpl_83tf9nAnRWs3PBjvzdv6BeDvbR9y is READY at https://dormfinder-kv81repgh-mrstorres-pixels-projects.vercel.app and the existing public alias https://dormfinder-pink.vercel.app. The clean committed archive .local/walking-source-cef1f6d was linked only after verifying project prj_Qb4KB7USZuY9HmzezIdVfrpRXiB1 / team team_lakGFdG84Dlw3s6qfEG8IKQc and frontend root/Node24/build settings. Staging used --skip-domain; authenticated CLI checks verified entry index-YxYBzQNQ.js and a byte-identical Discovery-CG0RwRVN.js before promotion. CSS is index-DA_MsN22.css. Backend readiness and a real foot route passed before promoting. Deployment protection was retained.

All 42 scoped live Chromium/WebKit acceptance cases pass in one final run. Public assets/credential scanning, fonts/demo images/deferred 3D, readiness, 15 campuses, 16 map matches and 16 real tiles with zero tile failures pass. A real production route returned 620 m / 498 seconds and 30 geometry points. Desktop/mobile screenshots confirm the full path and campus caption stay above the preview. Bounded Render app-error queries from 09:41:10 through 09:45:06 UTC returned no entries. Twenty-two staged source/test/documentation files passed credential/excluded-file scanning. The user certificate remains untracked with its previous SHA256 unchanged.

The immediately preceding compatible recovery pair is frontend da8c94d / dpl_EgfHPFuuJGja43i7m1yx7A4gLczE and backend da8c94d / dep-db8ug8favr4c73cdeofg. Re-inspect artifact availability and current routing before recovery; do not roll back the earlier additive Saved places migration or remove private notes. No new rollback rehearsal occurred. Live backend rollback remains explicitly deferred; the historical GitHub CI billing exception was not reverified. Public-gate verification and walking-based ranking remain planned; current walking estimates terminate at labeled approximate campus references.

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

The explicit sample command described below creates a dedicated fictional owner and preserves existing accounts and passwords. It is never run by the default database seeder or container startup. Final release still requires a release tag, two rehearsals and a privately stored database export.


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

GitHub validation run 37924843463 / job 113801198599 was blocked before all steps by the existing account billing restriction. The approved exception remains; Phase 5 still needs hardening, rollback/local fallback and two deployed rehearsals.

## Explicit fictional sample dataset

`php artisan dormfinder:demo-listings` shows a plan without writing records or images. Controlled execution adds 19 labeled fictional samples: 16 approved, one draft, one pending review and one rejected. Each has two separate inventory options, deposit/advance/fixed fees, coordinates and two generated layout illustrations uploaded through normal private photo storage. Sold-out, mixed-availability, stale-confirmation and exact-centavo examples exercise discovery behavior. The dedicated sample landlord is separate from the lifecycle acceptance fixtures, whose suspension tests must not hide this dataset.

To apply locally, provide `--apply --administrator=existing-admin-email --password-file=private-file`. The password file must contain a strong generated password; never put its contents in chat, source or command arguments. Existing reserved accounts must match their identity and password, otherwise execution stops without resetting them. Preserve the private password file for repeat runs. Complete/edited samples are skipped, not republished or refreshed. Unknown or conflicting sample identities stop execution. Untouched incomplete drafts can resume after an image-generation interruption.

Production additionally requires `--production-project=zujrpipjkgwqwlipgpwe`, the existing restricted runtime login, private schema and S3 bucket. Use the existing runtime environment through a private child-process environment, certificate-verified TLS and a freshly verified private schema backup. Migration-owner credentials remain local and are used only for the backup. No migration, paid service, startup command, provider setting, key or existing record needs replacement. The tested console code was run from the workspace against the confirmed live runtime; the previously accepted Phase 4 web deployments remain in place.

On October 9 the local and live sets were added explicitly. The live run preserved snapshots of all prior property, room, fee, photo, inquiry, message and user rows; all 24 prior properties remained unchanged. A second live run skipped all 19 samples with zero new listings or uploads. Credentials, backup archives and ID manifests remain ignored under `.secrets/`. The sample browser test runs only when `E2E_DEMO_MANIFEST` points to that private manifest; it uses existing synthetic student fixtures and the dedicated sample owner's private credentials.

## October 11 improvement release

The existing projects now run application source 605085b1063f7d86cbf47531d88e83cb8b3428e2. The tenth additive migration adds nullable campus/preference/amenity fields and widens the report snapshot title; it does not reset records. A fresh verified private backup and preserved-row fingerprint check preceded rollout. The directory is applied explicitly with artisan dormfinder:campuses --apply, never from startup.

Restore a prior compatible application deployment for recovery while retaining the additive schema. Do not run destructive down migrations or database resets. Keep backups and provider credentials in ignored private files. The two latest provider IDs and acceptance evidence are in validation.md; the delivery plan and remaining refinements are in improvement-plan.md.

## Map continuity frontend release — October 11

Vercel deployment dpl_DonovPo2yh2iVtdnQJes9KrKKBrP serves frontend source 916df82f2e10ecb7e35615631330e3d17365fec3 on the existing DormFinder alias. Render remains on the preceding 605085b source; no backend deployment, migration or provider environment change was needed. Per-search map/room context is public UI state in bounded browser tab storage. Keep the preceding Vercel deployment available for application rollback. Acceptance outcomes and the existing CI exception are recorded in validation.md.

## Verified recovery rehearsal - October 12, 2026

The production frontend rollback-and-return, isolated production-schema restore and local fallback were rehearsed. Current frontend remains source `cc807b4`, deployment `dpl_DeEfSzGkFZ81VFycqeT5K16Z9SDv`; backend remains source `5b76e53`, Render deployment `dep-db5nucm7bikc73dfm4eg`. See validation.md for results and limitations.

For frontend recovery, first inspect the correct team/project and the current/previous deployments. On the free Hobby plan use only the immediately previous compatible production build; Vercel documents this restriction in [Instant Rollback](https://vercel.com/docs/instant-rollback). The rehearsed previous build is `dpl_8ggzj12syEfJE6dSSynTm2ZCX7jH`. Use the already linked project and caller's existing CLI login; never paste a token into these commands:

```powershell
vercel.cmd rollback dpl_8ggzj12syEfJE6dSSynTm2ZCX7jH --yes --scope team_lakGFdG84Dlw3s6qfEG8IKQc
vercel.cmd rollback status dormfinder --scope team_lakGFdG84Dlw3s6qfEG8IKQc
```

Verify the public alias serves the expected build, readiness returns ready, campus/listing reads succeed and authenticated role screens work. Restore the current tested production build with:

```powershell
vercel.cmd promote dpl_DeEfSzGkFZ81VFycqeT5K16Z9SDv --yes --scope team_lakGFdG84Dlw3s6qfEG8IKQc
vercel.cmd promote status dormfinder --scope team_lakGFdG84Dlw3s6qfEG8IKQc
```

These IDs are dated recovery references, not permanent defaults: re-inspect them after another release. Promotion restored automatic domain assignment in the rehearsal. Allow a bounded propagation recheck of the public build marker; command success alone is insufficient. The tested round trip used a finally block to restore the original current build even if the rollback smoke check failed. No database downgrade accompanied either routing change.

The fresh private schema archive was actually restored into a new isolated loopback database. All 21 table row fingerprints matched the exported read-only snapshot, with ten campuses, ten migrations and validated constraints. The normal local database was preserved. The private backup and restore metadata remain in ignored files. This archive includes application-schema rows/definitions; it does not contain S3 object bytes, provider configuration or production role credentials/grants. Do not point the normal app at the private restore copy or reuse it as public demo data.

For a local presentation fallback, preinstall dependencies and prepare the existing fictional dataset while internet is available. Confirm backend/.env uses local PostgreSQL on 127.0.0.1:54329 and local private storage. Open http://127.0.0.1:5173. If servers are stopped, run:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/start-local.ps1
npm.cmd --prefix frontend run test:fallback
```

The fallback test launcher refuses cloud URLs, checks local database/storage settings and uses existing private synthetic fixtures. It runs the sample and complete role workflows in Chromium/WebKit while blocking nonloopback browser requests. It performs normal synthetic test writes in the local database. Map base tiles need internet and are unavailable in this mode; listing addresses, campus reference coordinates, costs, private local photos and conversations remain usable. This is a browser-external-network rehearsal, not a physical disconnect of the whole computer.

Stop tracked application servers with scripts/stop-local.ps1; database stop is a separate explicit scripts/local-database.ps1 -Stop action. Startup checks occupied ports before setup, keeps existing environment files, requires both processes to become ready and refuses Laravel port hopping. Shutdown reports failure and retains tracking if a process cannot be stopped. A restricted automation runner may require its normal authorized execution path for process start/stop; global Windows execution policy was not changed.

Render's rollback control and a full S3 bucket restore were not exercised here. For backend recovery, use the service's Deploys page and an available successful artifact, checking the target command/environment snapshot and schema compatibility first. [Render's rollback documentation](https://render.com/docs/rollbacks) explains retained artifacts and configuration behavior. Keep this service free and its existing auto-deploy-off setting. The prior compatible backend reference is `dep-db5mlkdckfvc73anver0`; verify retention before relying on it. A production database/media restore requires a separately reviewed recovery procedure rather than an application rollback.

## Private media recovery verified — October 12, 2026

A database archive does not include Storage object bytes. A separate backup of all 96 objects in DormFinder's private property-photos bucket is retained under ignored .secrets/photo-recovery-20261012-032402-a4d06db8, with its private object-to-file manifest and SHA-256 checksums. The matching isolated local restore is under .local/photo-restore-20261012-032402-a4d06db8. Metadata is in .local/photo-recovery-record.json; no secret or media artifact is committed.

The rehearsal restored every object into a unique recovery-rehearsal prefix in the same private bucket, downloaded each restored object, compared all checksums, then removed only the 96 keys created by that rehearsal. Source object inventory/ETags and sizes remained unchanged. All 96 ready S3 references from the previously isolated application-schema restore resolve to valid local image bytes with matching checksums. This verifies byte backup and isolated restoration; it does not perform an in-place production overwrite, restore provider accounts/settings/grants, or establish a zero-loss snapshot spanning concurrent database and media writes.

For an actual outage, first preserve the current schema/media, stop application writes and use a reviewed matching database/media snapshot. Keep object keys and the bucket private, validate every ready database photo reference before restoring traffic, and recheck access controls and signed URLs. Never use the private restore as public sample data. The operational helper .local/photo-recovery.php is retained locally and bounds the rehearsal to 500 objects/25 MB; inspect its fresh target checks before reuse.

The user explicitly deferred live Render rollback on October 12. The connected tools verify the service and deploy history but do not expose rollback, and no Render API credential was supplied. Preserve the existing free service, auto-deploy-off setting and the dated recovery references above; re-inspect artifact retention before a later dashboard/API rehearsal.

Current frontend recovery reference after this release: source ce04614, deployment dpl_6sSpHbjn5RhJGMor9qUta5zREbNq, production entry index-_fjnyzAS.js. Previous compatible frontend is cc807b4 / dpl_DeEfSzGkFZ81VFycqeT5K16Z9SDv. The backend remains 5b76e53 / dep-db5nucm7bikc73dfm4eg, with 15 campus rows synchronized explicitly. Older rollback-script constants and deployment IDs are historical references; re-inspect and update them before another rehearsal. Do not accidentally promote an earlier build when following a dated command example.

## Practical-feature release — October 12, 2026

Application source 5d48f44723b45d0dc99cf617c876b8943d69975b is deployed to the existing free services. Render dep-db674a0473hc73dcs7lg is live; Vercel dpl_CzQKZupB69QJfip2BkLDiKBuMogp is READY and aliased to https://dormfinder-pink.vercel.app, with entry index-DbHGpMLc.js. The frontend uses a clean archive of committed source and the verified existing project/team link. Secrets and the user certificate were excluded. Render retains autoDeploy=no and its established entrypoint/environment.

Only the additive practical-feature migration was applied, after a fresh private custom-format schema backup and verified catalog. Eleven migrations are recorded. New shortlists, shortlist_items and viewing_requests tables have runtime access; viewing DELETE, audit UPDATE/DELETE and runtime schema CREATE remain denied. Preserve these tables when reverting application code. Thirteen existing application-table row fingerprints were unchanged by migration. No migration downgrade, seed/reset or credential change accompanied deployment.

The immediately prior frontend recovery reference is ce04614 / dpl_6sSpHbjn5RhJGMor9qUta5zREbNq; prior backend is 5b76e53 / dep-db5nucm7bikc73dfm4eg. Re-inspect artifact retention and schema/configuration compatibility before use. Live Render rollback remains deferred at the user's request. Six real live Chromium/WebKit scenarios and separate asset/map/readiness checks pass; details and the historical GitHub CI exception are recorded in validation.md.

## Appearance/flow frontend release — October 12, 2026

Frontend source 3db30dc is READY in existing Vercel deployment dpl_FcvdkSKzN1NaMFgyBdXpFT9UWxyY, with production alias https://dormfinder-pink.vercel.app and entry index-CzDrnQay.js. A clean committed-source archive used the verified existing project/team link, frontend root and build settings. There were no backend, migration, dependency or provider environment changes. Render remains source 5d48f44 / dep-db674a0473hc73dcs7lg with its existing free plan and auto-deploy-off setting.

The prior compatible frontend recovery reference is 5d48f44 / dpl_CzQKZupB69QJfip2BkLDiKBuMogp. Re-inspect current/prior artifact state before any rollback; do not use older dated IDs as defaults. Eighteen live browser checks and separate readiness/asset/map checks pass; details and coverage limits are in validation.md. The broader visual redesign remains staged in improvement-plan.md, and live Render rollback stays deferred.

## Second appearance/flow frontend release — October 12, 2026

Current frontend application source is 6c2da4eb24b4ccf6b672556b9694b56b26786034, READY in dpl_H92dnpEHJbxQK7dSY4vADJFyaLDL, with production alias https://dormfinder-pink.vercel.app and entry index-V9l_CNZo.js. The source was archived from its committed revision into a new ignored release directory and deployed through the verified existing project/team link. Eighteen live Chromium/WebKit scenarios pass in one 2.9-minute run, together with readiness, asset, credential and real map checks. Detailed evidence is in validation.md.

The immediately previous compatible frontend reference is 3db30dc / dpl_FcvdkSKzN1NaMFgyBdXpFT9UWxyY. Re-inspect retention and the actual current/prior artifacts before any rollback; older dated commands above are historical examples. Render remains 5d48f44 / dep-db674a0473hc73dcs7lg, free and auto-deploy off. No backend deployment, migration, dependency or environment change accompanied this frontend release. Live Render rollback remains deliberately deferred.

## Persistent-map frontend release — October 12, 2026

Current frontend application source is 1dc03d4908316c0a653567cd9481457dfae66969, READY in dpl_A1ca9LxXCVnmHZ87npvp3374sWn3, aliased to https://dormfinder-pink.vercel.app. Its production entry index-TaqKo4Zo.js matches the tested build. Deployment used a clean committed-source archive and the verified existing team/project. All sixteen live browser scenarios have passing evidence across the main run and a corrected test-only heading rerun; readiness, public asset/credential checks and real map tiles pass.

The immediately previous compatible frontend reference is 6c2da4e / dpl_H92dnpEHJbxQK7dSY4vADJFyaLDL. Inspect current deployment state and artifact retention before rollback. Backend remains 5d48f44 / dep-db674a0473hc73dcs7lg, with its free plan, environment and auto-deploy-off setting. No backend deployment or migration occurred. Live Render rollback remains deferred.

## Filter drawer frontend release — October 12, 2026

Current frontend application source is 163ad43fb1d1957d05e6beb20346f188fbe56a1c, READY in dpl_413BQYzMg1nU7HvuqbutsB5cp4yf and aliased to https://dormfinder-pink.vercel.app. Its entry index-DDAqzBxA.js matches the locally tested build. Deployment used a clean committed-source archive, the verified existing project prj_Qb4KB7USZuY9HmzezIdVfrpRXiB1 and team team_lakGFdG84Dlw3s6qfEG8IKQc, with the frontend root and established build configuration. Fourteen staged application/test/documentation files passed the private-credential scan; private artifacts and the user's certificate were excluded.

The immediately previous compatible frontend recovery reference is 1dc03d4 / dpl_A1ca9LxXCVnmHZ87npvp3374sWn3. Re-inspect actual current/prior deployments and artifact retention before any rollback. Backend remains 5d48f44 / dep-db674a0473hc73dcs7lg with its existing free plan and auto-deploy disabled. This refinement did not deploy the backend, alter its environment, migrate data or add dependencies. Live Render rollback stays deliberately deferred. Acceptance evidence is in validation.md.

## Scroll-driven room entrance — October 15, 2026

Source 8969af5 is READY in dpl_5BGPDTspNBPb7BvQtRAovpDrocok, with entry index-euggagAF.js and deferred engine dormRoom-BUSbS0bB.js. It introduced the approved Three.js 0.186.1 scene, without backend deployment, database migration or provider changes. Its immediately preceding frontend was 163ad43 / dpl_413BQYzMg1nU7HvuqbutsB5cp4yf. Local and live acceptance evidence, including the graphics fallback and WebKit rerun, is in validation.md. This appearance was superseded by the following user-approved refresh.

## White, navy and cobalt refresh — October 15, 2026

Current frontend application source is 93021f3ab57e2e6d7490deab1ee68df56f5c51d3, READY in dpl_936fS3U5iUKgnVUzukNyNAePGMoR, aliased to https://dormfinder-pink.vercel.app. Entry index-DOjbuBQ2.js and engine dormRoom-DCOi7KyE.js match the tested build. A clean committed-source archive used the verified existing project prj_Qb4KB7USZuY9HmzezIdVfrpRXiB1 / team team_lakGFdG84Dlw3s6qfEG8IKQc, with the existing frontend root and build configuration. The private-credential scan passed all twenty-three staged files; private artifacts and the user certificate were excluded.

The immediately previous compatible frontend recovery reference is 8969af5 / dpl_5BGPDTspNBPb7BvQtRAovpDrocok. Re-inspect deployment state, retention and configuration compatibility before rollback. Self-hosted Inter, its license and three optimized generated demo covers are versioned with source; prompts and provenance are in design-assets.md. Backend remains 5d48f44 / dep-db674a0473hc73dcs7lg on its existing free plan, with auto-deploy disabled. No migration, backend deployment, environment change or paid provider resource was introduced. Live Render rollback remains deferred; the historical GitHub CI exception was not reverified. Final acceptance is recorded in validation.md.

## Visible campus search and compact facts — October 15, 2026

Current frontend application source is 462036889e670132476741d91b6c57d5fad92bdb, READY in dpl_ERxMRJUXEaGbDjWqFeDJctXvpq6g and aliased to https://dormfinder-pink.vercel.app. Entry index-DPpLPtCv.js and unchanged engine dormRoom-DCOi7KyE.js match the tested build. A clean committed-source archive used existing project prj_Qb4KB7USZuY9HmzezIdVfrpRXiB1 / team team_lakGFdG84Dlw3s6qfEG8IKQc and its established frontend build settings. The staged credential/excluded-file scan passed sixteen files. All twenty scoped live Chromium/WebKit cases pass in one 1.8-minute run; independent readiness, public assets and real map checks pass.

The immediately previous compatible frontend recovery reference is 93021f3 / dpl_936fS3U5iUKgnVUzukNyNAePGMoR. Re-inspect current/prior artifacts, retention and configuration compatibility before any rollback; no new rollback rehearsal was performed. Backend remains 5d48f44 / dep-db674a0473hc73dcs7lg, free with auto-deploy disabled. No backend deployment, migration, dependency, environment, production record or paid-resource change accompanied this refinement. Private artifacts and the user's certificate remain excluded. Live Render rollback and the unverified historical GitHub CI exception retain their prior status. Detailed evidence is in validation.md.

## Student space and personal settings — October 15, 2026

Current frontend application source is b51af8d37b567c8ee05cf5d8984ac1064e551ca8, READY in dpl_GTWSyUZJD7RjkjrJpCtwfRCRYPUW, with production alias https://dormfinder-pink.vercel.app. Entry index-DrO_XNpt.js matches the tested build, alongside deferred StudentHome-DdGqfJLy.js, ProfileSettings-CM3zH8Tj.js and unchanged dormRoom-DCOi7KyE.js. A clean committed-source archive used verified existing project prj_Qb4KB7USZuY9HmzezIdVfrpRXiB1 / team team_lakGFdG84Dlw3s6qfEG8IKQc, frontend root, Node 24 and established build settings. Eighteen staged files passed the credential/excluded-file scan. Forty deployed Chromium/WebKit checks pass in one 2.6-minute run; separate actual-account/private API, public assets, readiness and map checks pass. Detailed evidence and controlled-fixture scope are in validation.md.

The immediately previous compatible frontend recovery reference is 4620368 / dpl_ERxMRJUXEaGbDjWqFeDJctXvpq6g. Re-inspect actual current/prior artifacts, retention and configuration compatibility before any rollback; no rollback rehearsal was performed for this release. Backend remains 5d48f44 / dep-db674a0473hc73dcs7lg on its existing free plan, with auto-deploy disabled. No backend deployment, database migration, dependency, provider configuration or paid-resource change accompanied this frontend release. Private artifacts and the user's certificate remain excluded. Live Render rollback remains deferred and the historical GitHub CI exception was not reverified.

## Conversation-first messages and private profile photos — October 16, 2026

Current frontend application source is 3e808ed7aaaa8a1777bf690036e1b766db062452, READY in dpl_CxJG68NdCiNoigtV9bjF9VVZhLEE and aliased to https://dormfinder-pink.vercel.app. A clean committed-source archive used the verified existing project/team and established frontend root/build configuration. The entry is index-CEGTcJoL.js; InquiryPages-BcRQDwHo.js and its CSS load separately. The unchanged decorative room engine remains dormRoom-DCOi7KyE.js. This frontend follow-up adds keyboard focus to message history after the main messaging redesign source 0263525 / dpl_3hzTJWeVdMxYL1rL7j6n8QK9eeBL.

Backend source 026352510267d404f61dc3096e0cbd30128d1993 is live in existing Render deployment dep-db8f5ie89jmc73d96900. The existing free service, private storage credentials, environment and auto-deploy-off setting are retained. Profile images reuse the private disk under avatars/{user_id}/profile.jpg; no schema migration, bucket policy, grants, dependency or provider configuration change was required. This backend is intentionally not redeployed for the frontend-only keyboard follow-up.

The immediately preceding frontend recovery reference is 0263525 / dpl_3hzTJWeVdMxYL1rL7j6n8QK9eeBL with the same backend. The pre-messaging frontend/backend pair is b51af8d / dpl_GTWSyUZJD7RjkjrJpCtwfRCRYPUW and 5d48f44 / dep-db674a0473hc73dcs7lg. Re-inspect actual artifacts, retention and compatibility before recovery; these are recorded references, not a new rollback rehearsal. Live Render rollback remains deferred by the user. The historical GitHub CI billing exception remains unverified. Current acceptance evidence is recorded in validation.md. Private artifacts and the user's certificate remain excluded.

## Viewing workspace and visible listing actions — October 16, 2026

Application source 26b00adffba0a127c8b0d8cb01697ff35d479ff7 is live on both existing free services. Render deployment dep-db8oudff3r2c73esvfn0 finished live at 02:43:57 UTC. Vercel deployment dpl_8vegZ6n7bEd557W3UWTYgFUXsV3j is READY, with production alias https://dormfinder-pink.vercel.app and deployment URL https://dormfinder-g42nhzen0-mrstorres-pixels-projects.vercel.app. Entry index-B7XfU7Cy.js matches the tested build. The backend was deployed first; the additive query/resource fields preserve prior frontend compatibility. The frontend used a clean committed-source archive, verified project prj_Qb4KB7USZuY9HmzezIdVfrpRXiB1 / team team_lakGFdG84Dlw3s6qfEG8IKQc, and established frontend root/Node/build settings.

No new migration, grants, environment variable, storage policy, dependency or paid resource was introduced. The existing Docker command, free Render plan and disabled automatic deployment remain. Nineteen staged files passed the credential/excluded-file scan. Known server credentials are absent from released JavaScript/CSS, and private artifacts plus prod-ca-2021.crt remain excluded. Local/live validation and cleanup scope are recorded in validation.md.

The immediately preceding compatible recovery pair is frontend 3e808ed / dpl_CxJG68NdCiNoigtV9bjF9VVZhLEE and backend 0263525 / dep-db8f5ie89jmc73d96900. Re-inspect actual artifacts, retention and configuration before any recovery; no new rollback rehearsal was performed. Live Render rollback remains deferred by the user, and the historical GitHub CI billing exception remains unverified.

The final frontend-only decision refinement is current source f7bc238ce397ca020d763df73f3039cb2e5fc080, READY in dpl_dDQ7LuyTesQoFPhNw5VJMPwen3gG at https://dormfinder-andiavulb-mrstorres-pixels-projects.vercel.app and the unchanged production alias. It uses entry index-BNP4bwLh.js, with Viewings-B3lMnr9j.js. Backend remains 26b00ad / dep-db8oudff3r2c73esvfn0; no backend redeployment was needed. This clean archive was linked to the same verified project/team and established build configuration. The immediately prior frontend recovery reference is 26b00ad / dpl_8vegZ6n7bEd557W3UWTYgFUXsV3j with that same backend. Re-inspect artifacts before any recovery. Validation.md records the final affected rerun and public checks.

## Unified Saved places release preparation — October 16, 2026

The approved Saved places change is locally verified; the current application pair is still frontend f7bc238 / dpl_dDQ7LuyTesQoFPhNw5VJMPwen3gG and backend 26b00ad / dep-db8oudff3r2c73esvfn0. Render workspace tea-d7ip6vu7r5hc73ccjjng and free service srv-db44ecrbc2fs73aj14q0 are verified, with auto-deploy off and the existing Docker entrypoint. Vercel CLI inspection verifies existing project prj_Qb4KB7USZuY9HmzezIdVfrpRXiB1 in team team_lakGFdG84Dlw3s6qfEG8IKQc, frontend root, Node 24, npm ci and build:vercel. The connector project lookup returned not-found; the explicitly scoped CLI inspection succeeded for the intended project. No account or provider configuration was changed.

The fresh private backup and additive migration are complete; validation.md records the backup checksum and preserved records/permissions. The schema remains compatible with the preceding application pair. Deploy the new backend first, then the tested frontend from a clean committed-source archive. For application recovery, retain the additive columns: do not run migrate:rollback, because it would delete newly written saved-place notes/room metadata. Re-inspect actual retained deployment artifacts and configuration before recovery. A full database restore is a separate, explicitly planned recovery operation, not a routine application rollback. Live Render rollback remains deliberately deferred, and the historical GitHub CI exception remains unverified.

## Unified Saved places — released October 16, 2026

Current backend source a717e3de79bf0a2da65648828cc51d7deac495e5 is live in dep-db8tusbrjlhs73dhno90 on the existing free service, with auto-deploy still off. Current frontend source 4b5e15e313e0980d75ee1d6221f76a6ec2f5ddaf is READY in dpl_F6HXqdoHRMb5BgTXNGdxFx3Bp85h at https://dormfinder-a5hps5nuk-mrstorres-pixels-projects.vercel.app and the unchanged production alias https://dormfinder-pink.vercel.app. Its entry is index-C-CkWmGv.js, with SavedPlaces-BUJeB3ZH.js and unchanged dormRoom-DCOi7KyE.js. Both frontend deployments used clean committed-source archives, the verified existing project/team and established root/Node/build settings. Each was staged with --skip-domain, inspected through authenticated vercel curl against the tested entry, then promoted. Deployment Protection was retained. Existing backend origin, secrets, environment and provider plans were not changed.

The migration/backup and record/grant checks are recorded above and in validation.md. Application recovery must retain the added favorite metadata columns; never run migration rollback as part of switching application versions. The immediately prior compatible frontend is a717e3d / dpl_3MgAq1oMBeYcTP9uY2smU4Dw7mEF with the same backend. The pre-unification recovery pair is frontend f7bc238 / dpl_dDQ7LuyTesQoFPhNw5VJMPwen3gG and backend 26b00ad / dep-db8oudff3r2c73esvfn0; it ignores the new metadata but does not require dropping it. Re-inspect retained artifacts, current routing and configuration compatibility before recovery. No live backend rollback rehearsal occurred; it remains deferred by the user.

Final acceptance has passing evidence for all 54 distinct scoped live cases across the main run and final twelve-case rerun. Public asset/credential, readiness, campus/map/tile checks and the bounded Render error query pass. Existing source/data and the user certificate remain preserved. Further comparison and landlord/admin redesigns remain planned. The historical GitHub CI exception was not reverified and is separate from these passing local/release checks.

## Notification bell and campus marker — October 16, 2026

Current application source is da8c94decc00b116b5e09b34fc42f13c16f67b76. Backend dep-db8ug8favr4c73cdeofg is live on the existing free Render service with auto-deploy off and the established Docker entrypoint. Vercel dpl_EgfHPFuuJGja43i7m1yx7A4gLczE is READY at https://dormfinder-6k6u9d14c-mrstorres-pixels-projects.vercel.app and the unchanged public alias https://dormfinder-pink.vercel.app. Entry index-DDOp847s.js and stylesheet index-CoUzWAEj.css match the tested build. The existing project prj_Qb4KB7USZuY9HmzezIdVfrpRXiB1 / team team_lakGFdG84Dlw3s6qfEG8IKQc, frontend root and build settings were verified. A clean source archive was staged with --skip-domain, checked through authenticated CLI access and promoted after backend readiness; protection and all environment values were retained.

The only backend addition is the recipient-scoped read-only notification count endpoint. No schema migration, grant, private-storage change or new resource was required. Sixteen staged implementation/test/documentation files passed credential/excluded-file scanning. All 32 distinct scoped live cases pass across the main run and corrected real-account request-context rerun; public assets/credentials, readiness, real tiles and the bounded Render error scan pass. The user's prod-ca-2021.crt remains untracked and unchanged. Validation.md records the acceptance boundaries and initial failures.

The immediately preceding compatible recovery pair is frontend 4b5e15e / dpl_F6HXqdoHRMb5BgTXNGdxFx3Bp85h and backend a717e3d / dep-db8tusbrjlhs73dhno90. Re-inspect current routing, artifact retention and settings before recovery. Keep the earlier additive Saved places metadata; application rollback must not drop its columns or notes. No rollback rehearsal occurred for this release. Live Render rollback and the historical unverified CI exception retain their prior status. Walking-direction provider integration remains planned and is not part of this release.
