# Validation evidence — October 9, 2026

## Passed locally

- PHP 8.4.26, PostgreSQL 17.11: **41 PHPUnit tests, 126 assertions**.
- Frontend: **3 component tests**; ESLint and Vite production build pass.
- Playwright: **4 tests pass**, two each in Chromium and WebKit.
- Browser workflow: real session registration, required CSRF token, private draft creation, normalized upload, image loading after reload, guest denial, logout, login and password-change logout.
- Browser response verifies HttpOnly and SameSite=Lax cookie attributes. HTTPS Secure cookies are conditional assertions for the deployed test run; local HTTP does not prove production HTTPS behavior.
- Mobile/tablet/desktop home layouts pass no-horizontal-overflow checks at 360, 768 and 1440px; screenshots were visually inspected.
- Composer lockfile validates; Composer and npm advisory checks reported no vulnerabilities at execution time.
- PowerShell scripts parse successfully. Render and workflow files parse as YAML.
- Local bootstrap completed a clean dependency reinstall without resetting the database or credentials. Tracked server stop/start and subsequent readiness/check-script execution pass.
- Vercel routing output builds and validates with a test-fixture origin; this does not prove a real deployment.

Backend coverage includes fixed registration roles and forbidden elevation, duplicate normalized email, suspended login/access, owner isolation, material-edit demotion, optimistic revision conflict, upload format/size limits, eight-photo cap, signed URL expiry, upload retry identity, deletion and simulated storage failure consistency. These tests use PostgreSQL, not SQLite.

## Corrections made during resumed validation

- ESLint flat configuration now uses compatible rule configuration.
- Backend tests supply the browser Origin so Sanctum exercises stateful session middleware; logout assertions target the web session guard rather than the cached request's Sanctum guard.
- Password changes explicitly clear the remember token, avoiding mass-assignment exclusion.
- Real browser tests confirm CSRF rejection even for same-origin writes without a token.
- Fixed mobile horizontal overflow from the hero's Bootstrap gutter.
- Replaced a corrupt browser-test PNG fixture with a valid canvas-generated image; rejection of the corrupt image was correct application behavior.
- Cookie assertions read actual Set-Cookie headers, avoiding a Windows WebKit cookie-inspection discrepancy.
- Added landlord pagination and periodic signed-photo URL refresh while the tab is visible.
- Local bootstrap validates Composer's checksum and uses PowerShell BasicParsing for downloads. It refuses dependency reinstall while Vite holds its native module open.

## Passed in the deployed Phase 1 slice

Release source: `f1df38f692573619298b066bbbce5af98826f8c1`. Actual frontend: [DormFinder](https://dormfinder-pink.vercel.app); backend: [Render API](https://dormfinder-api.onrender.com). Vercel release `dpl_3bW6KhFR5QfV636kSQpw9mUPETdB` is READY. Render redeploy `dep-db44kf3ncjis73bpfe3g` is live.

- **4 deployed Playwright tests pass (34.9 seconds)**, two each in Chromium and WebKit. Registration, CSRF rejection (419), login/logout, password-change session revocation, private draft creation and normalized image loading after reload pass through Vercel's same-origin proxy.
- Cookies are Secure, HttpOnly, SameSite=Lax and host-only. Guest reads are denied (401); a separate landlord cannot retrieve another owner's draft (403/404).
- No horizontal overflow at 360, 768 and 1440px in either browser.
- With all backend requests intercepted, Chromium and WebKit display the startup-error message and recover to sign-in after manual Try again; no automatic read retry loop or backend traffic was generated. This is a simulated transport-failure check against deployed frontend code, not the timed idle measurement.
- An existing authenticated session, draft and private JPEG survived the second successful Render deployment. Responses remain no-store.
- The same session, draft and private JPEG also passed readback after the 16-minute idle interval; no-store remained intact.
- Private S3 transport passed upload, authenticated read, signed HTTP read and deletion; the probe object was removed. Bucket `property-photos` is private with no anonymous Storage policies. A previously valid signed photo URL was denied after expiry (HTTP 400).
- The two public JavaScript/CSS assets contained none of the exact server credential values checked. API 404 responses are JSON with no debug output and no-store headers.
- Warm readiness measured approximately 386ms directly and 306ms through Vercel. These are individual observations, not a load-test guarantee. After a 960-second interval without requests from this validation process, readiness through Vercel returned HTTP 200 in 290ms at 02:15:58 UTC. No fresh startup logs appeared; actual Render sleep/cold wake-up was not established. External traffic may prevent idle sleep, but was not measured.

### Confirmed sleep and cold recovery

The account owner confirmed all DormFinder tabs and monitors closed. The validation process then left the service untouched from **02:19:58 UTC to 02:39:58 UTC** (1200 seconds). At 02:39:54 UTC, direct `/robots.txt` returned Render's documented sleeping-service response, `User-agent: *` with `Disallow: /`; the application's own file has an empty Disallow directive. Render documents that this sleep response does not trigger a wake-up.

The scheduled Vercel `/api/v1/health` request started at 02:39:58 UTC and returned **HTTP 200 / ready in 24279ms (24.3 seconds)** on the first attempt. Fresh Render logs at 02:40:03 UTC show configuration caching and PHP-FPM startup on instance `srv-db44ecrbc2fs73aj14q0-8gt6l`. No error-level startup logs were returned. Together these establish actual sleep and cold recovery, unlike the earlier warm idle probe.

Post-wake readback confirms the **same existing session, draft and private normalized JPEG survived**, with no-store responses. No records or credentials were recreated. This is one measured cold start, not a worst-case latency guarantee; the frontend's manual retry transport-failure checks passed separately in both browsers.

### Database and account evidence

Supabase project `zujrpipjkgwqwlipgpwe` is ACTIVE_HEALTHY in Singapore, PostgreSQL **17.11 (17.11.0.003)**. The organization reports Free and quoted $0/month for provisioning. Existing BodegaWebsite was untouched.

Client-to-session-pooler TLS **1.3 / TLS_AES_256_GCM_SHA384** was verified using `psql`, `verify-full` and the supplied project CA. `pg_stat_ssl` describes the pooler's upstream connection, not this client TLS link. A private pre-migration application-schema export was catalog-verified; this is not a full managed-database backup.

All six committed Laravel migrations ran using the separate migration owner. All eleven application tables belong to `dormfinder_owner`; `dormfinder_runtime` can access application data but cannot create schema objects. Both logins are non-superuser, cannot create databases/roles and cannot bypass RLS. Anonymous/authenticated roles have no schema usage. Global owner defaults revoke PUBLIC function execution. Post-migration Supabase security advisors returned no lints. At the resource check, application core tables totaled 221184 bytes, owner/runtime connections totaled 2 against max_connections 60, and three synthetic ready photos existed. These are snapshots, not quotas.

Render account/workspace access passes in confirmed My Workspace. DormFinder service `srv-db44ecrbc2fs73aj14q0` is Free/Singapore, auto-deploy off, Docker context backend. Existing websys2 was untouched. Two initial deploys failed because the compound Docker Command was interpreted incorrectly. The user corrected it to `/var/www/html/docker/entrypoint.sh`; subsequent image startup and readiness pass. The healthCheckPath setting is currently empty; the readiness endpoint was tested manually.

Vercel connector reads pass but writes returned 403 and its listing lagged behind the CLI-created project. CLI OWNER access, Hobby plan and project readback pass for `prj_Qb4KB7USZuY9HmzezIdVfrpRXiB1` in `team_lakGFdG84Dlw3s6qfEG8IKQc`. Production was deployed from a Git archive of committed source, excluding local secrets and unfinished files. BACKEND_ORIGIN and Render origins use the actual provider URLs. Preview builds and external rewrite caching are disabled. Vercel Git auto-deployment is not connected.

### Actual runtime/build versions

Laravel **13.35.0**, Sanctum **4.3.3**, Flysystem AWS S3 **3.35.3** are pinned in the deployed Composer lock. Vite **8.3.4** is confirmed in Vercel build logs. Vercel uses Node major **24**; its build CLI was **62.1.0**. The local deployment CLI was **58.11.0**, local Node **24.16.0**, local PHP **8.4.26**. Cloud Node/PHP patch versions were not measured directly. Render built PHP 8.4 FPM Bookworm image digest `sha256:6bfef8e416977aa41f48e3e42a40c1e08050d24e4a938c6edb421400bff24601`. Docker is absent locally; the successful cloud Docker build/startup supplies container evidence.

### Free-tier operating limits checked October 9

[Render Free](https://render.com/docs/free) sleeps after 15 minutes without inbound traffic and typically takes about a minute to wake. Its filesystem is ephemeral. The workspace shares 750 free instance hours per month with existing services, including websys2; there is no persistent disk, SSH or one-off job support on Free.

[Supabase Free](https://supabase.com/pricing) includes 500MB database, 1GB Storage, 5GB egress plus 5GB cached egress and two active projects. Projects may pause after a week of inactivity. The existing project and DormFinder use the two active-project allowance.

[Vercel Hobby](https://vercel.com/docs/plans/hobby) includes 100GB Fast Data Transfer, 10GB Fast Origin Transfer, one million CDN requests monthly and 100 deployments/day. It is for personal, noncommercial use; exceeded limits generally require waiting for reset. No paid upgrade was made.

## Outstanding verification and later scope

Confirmed Render sleep/cold wake-up and persistence now pass. GitHub Linux CI remains blocked; the user approved a temporary exception and authorized Phase 2 on October 9. Phase 1 is accepted with that exception; no passing GitHub CI result is claimed. No load/soak test, final rehearsal or local fallback rehearsal has been claimed. Trusted proxies currently use the configured wildcard; stable provider ingress boundaries were not verified. API cache/cookie behavior passed the deployed tests.

GitHub CI [latest run 37867696380](https://github.com/mrstorres-pixel/DormFinder/actions/runs/37867696380) failed with an empty steps list. The earlier run [37867523468](https://github.com/mrstorres-pixel/DormFinder/actions/runs/37867523468) reported an account billing lock before any job steps executed. Resolve the account restriction without assuming permission for paid changes, then rerun CI. This is not failing application-test evidence and not a passing Linux CI run.

At 02:18 UTC, Codex retried failed jobs on run 37867696380 (attempt 2). GitHub accepted the retry, but job [113638127281](https://github.com/mrstorres-pixel/DormFinder/actions/runs/37867696380/job/113638127281) failed before steps at 02:19 UTC. Its public check annotation explicitly reports the same account billing lock. The account owner sees no lock notice in settings; GitHub Support must investigate the discrepancy. No billing or payment settings were changed.

The account owner should inspect GitHub billing/account notices and contact support if the lock is unexpected. GitHub documents [locked-account recovery](https://docs.github.com/en/billing/how-tos/troubleshooting/locked-account); this deployment did not change billing or authorize payment.

Phase 2 room options, review/public details, basic comparison and private inquiries are implemented; its full three-role scenario passes locally and in the deployed release. Search filters/sorting, favorites, maps/campus distance, notifications, reporting/moderation and final demo seeds remain later-phase work. Reproduce local checks with scripts/check.ps1 while local servers run; existing local accounts/drafts remain intact.

## Phase 2 local acceptance and migration checkpoint

- **57 PHPUnit tests / 223 assertions pass**, including 16 Phase 2 checks covering inventory and charge integrity, stale revisions, submission completeness and locked edits, review authority/feedback, public visibility, comparison selections, inquiry isolation/retries/snapshot retention, suspension freeze, controlled administrator provisioning and migration readiness.
- **6 frontend tests**, ESLint and Vite production build pass.
- **6 Playwright tests pass (1.1 minutes)** in Chromium/WebKit: existing Phase 1 tests plus the landlord → administrator → student → landlord → student story, selected-option costs, private inquiry replies, administrator/guest denial, material-edit hiding, message retention and responsive thread layouts.
- Existing initialized local database was started and migrated without resetting records or credentials. A separate synthetic local administrator was created through the controlled CLI. CI now provisions its own private synthetic admin fixture; it still has no production secrets.
- Fresh private cloud application-schema export and archive catalog verification completed before the seventh additive migration. Runtime reads all five new tables and retains no schema CREATE privilege. Only a distinctly labeled synthetic cloud test administrator was added; no existing accounts, source migrations, keys or service settings were overwritten.
- Render/Vercel release and deployed Phase 2 acceptance passed; see the release evidence below.

## Phase 2 deployed acceptance — October 9

Application source: `04f10c1b863be12ca3ef586d7ca81f8f48f99e02`. Existing Render deployment `dep-db4bacjl550s73b756jg` became live at 09:35:24 UTC (17:35:24 Singapore). Vercel production `dpl_HWmecozMnoZzLVXBY2kYuVhrn5Xk` is READY and aliased to [DormFinder](https://dormfinder-pink.vercel.app). The Vercel release used a clean Git archive of that source, with explicit existing team/project scope. No provider resources, stable keys or unrelated services were replaced.

- **6 deployed Playwright tests pass (1.7 minutes)** in Chromium/WebKit. The Phase 2 workflow takes 28.6s / 27.8s respectively: landlord creates a photo and two separate inventory options, submits, administrator approves, student browses/compares the selected option and sends an inquiry, landlord replies, and student reads/replies. Fixed monthly rent plus fees displays PHP 3,750.79 with a per-person basis.
- Drafts return public 404; pending review locks editing. Guest inquiry reads return 401 and administrator inquiry reads return 404 without disclosing messages. A material edit removes the public listing while the original inquiry snapshot and messages remain accessible to its participants. Inquiry layouts pass at 360, 768 and 1440px. No browser page errors were recorded.
- Existing Phase 1 authentication/photo tests also pass. The original persistence fixture's two-hour session had expired after the earlier cold test; normal login to that same account succeeded and its unchanged draft and private normalized JPEG passed readback. This confirms preserved data, without claiming that an expired session remained active. No fixture or credential was recreated.
- Readiness through Vercel returns HTTP 200, ready, phase 2. Render returned no error-level logs for the inspected release window. Post-migration Supabase security advisors report no lints. The two deployed public assets contain none of the checked private server credentials; API 404 remains safe JSON with no-store.
- Vercel build CLI was 62.7.0. Source dependencies remain locked; no dependency change or paid upgrade occurred.

GitHub [Phase 2 validation run 37911758621](https://github.com/mrstorres-pixel/DormFinder/actions/runs/37911758621) failed before any steps. Job 113758316502 again reports the account billing lock. The previously approved CI exception remains in effect; local and deployed results above are separate evidence, not a passing Linux CI result. Phase 2 is accepted with that exception. Search/favorites/maps and later phases remain outstanding.
