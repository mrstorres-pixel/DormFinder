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

## Not yet verified

Cloud deployment, production-cookie forwarding through Vercel, Render restart/redeploy persistence, private Supabase Storage operations, pooler certificate/role setup, free-tier cold starts/quotas and performance acceptance criteria require account access.

Docker is not installed locally. Container build and Linux CI execution are prepared but cannot be called passing until the actual workflow runs. A local production build does not prove Docker startup or external integration.

Room options, approval/discovery/comparison, favorites, inquiries, notifications, reporting/moderation and final synthetic seeds have not been implemented. The core three-role release acceptance scenario is consequently still pending.

Use scripts/check.ps1 with the local servers running to reproduce the current application checks. Playwright's synthetic accounts and drafts remain in the designated local database; no user records are truncated.
