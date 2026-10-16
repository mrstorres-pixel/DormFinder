# Implementation status

Approved deadline: October 14, 2026, Asia/Singapore. Free tiers only. Codex owns implementation.

## Inspection after interrupted validation

The repository had no commits. The previous task had created application files, installed locked dependencies and isolated runtimes, migrated local PostgreSQL, and written tests. It had not created deployment/CI documentation or completed browser validation. Existing application work was preserved.

Completed locally:
- Laravel/Sanctum accounts, backend-assigned registration roles, revocation and profile endpoints.
- Owner-isolated private drafts, transactional revision checks and material-edit demotion.
- Validated and re-encoded images, private signed URLs, upload retry identity, deletion maintenance.
- React screens and feedback states; responsive layouts.
- PHPUnit/PostgreSQL tests, frontend component tests, Chromium/WebKit integration tests.
- Windows bootstrap/start/stop/check scripts.
- Render Docker/blueprint, Vercel routing output, GitHub validation and controlled migration workflows.
- Deployment, architecture, API and evidence documentation.

## Phase 1 accepted with a documented CI exception

Account access is verified in the user-confirmed Supabase organization, Render workspace and Vercel team. Free resources only. The live frontend is [DormFinder](https://dormfinder-pink.vercel.app), backed by [Render](https://dormfinder-api.onrender.com) and Supabase project `zujrpipjkgwqwlipgpwe`.

Completed in the cloud:

- All six Laravel migrations, eleven owner-owned application tables, restricted runtime login, certificate-verified pooler TLS and private S3 Storage.
- Render Docker build/startup and Vercel production routing from source commit `f1df38f692573619298b066bbbce5af98826f8c1`.
- Four deployed Playwright tests in Chromium/WebKit: registration, login/logout, password revocation, CSRF, cookies, drafts, photos and responsive layouts.
- Session, draft and normalized private photo persistence across a backend redeploy; guest/other-owner denial, signed URL expiry and no-store responses.
- Public asset scan found none of the server credentials; Supabase security advisors reported no lints after migration.

Confirmed Render sleep/cold wake-up passed after a controlled 20-minute interval with tabs/monitors closed. The provider sleep response and fresh startup logs establish the restart; readiness through Vercel took 24.3 seconds. The existing session, draft and private photo survived. GitHub Actions is blocked before any steps execute by an account billing lock; the account owner must resolve the restriction and rerun CI. No paid upgrade is authorized. The user approved deferring this external CI blocker and proceeding to Phase 2 on October 9. Phase 1 is accepted with this exception, not claimed as a passing GitHub CI run. Local validation must pass before every release; migrations remain controlled, additive and backed up. GitHub Support can resolve the lock separately.

Continuation: existing source, local Laravel environment and local database were preserved. Supabase `BodegaWebsite` and Render `websys2` were untouched. Persisted credentials and APP_KEY remain in ignored `.secrets/` files. A private application-schema export preceded migrations. Only synthetic browser-test accounts/drafts were added to the new cloud project; no destructive seeding or truncation ran. Preserve keys, roles, applied migrations and existing service/project IDs on resume.

The initial automatic approval review rejected the secret-bearing Render creation payload. The user explicitly approved sending those credentials to DormFinder Render, and creation succeeded. The user corrected Docker Command to `/var/www/html/docker/entrypoint.sh`; the corrected service is live. Do not create a duplicate service.

## Phase 2 accepted with the documented CI exception

Implemented room options/inventory/charges, submission and administrator review, public listing details/comparison, and participant-only inquiries/replies. Local checks passed: 57 PHPUnit tests / 223 assertions, 6 frontend tests, lint/production build and 6 Chromium/WebKit tests including the full three-role workflow. A fresh private cloud application-schema export was verified before the seventh additive migration; the restricted runtime can read all five new tables and still cannot create schema objects. Phase 2 source commit `04f10c1b863be12ca3ef586d7ca81f8f48f99e02` was deployed to the existing Render and Vercel projects. All six deployed Chromium/WebKit tests passed (1.7 minutes), including the complete three-role workflow, comparison, private replies, denial checks, material-edit hiding and snapshot retention. The original Phase 1 draft and private photo remained intact; its expired session was renewed through normal login. Public asset credential scans and Supabase security advisors passed. Preserve Phase 1 source, credentials, local/cloud records and provider resources. Deployed acceptance passed the landlord → administrator → student → landlord → student workflow plus negative authorization and lifecycle checks.

## Phase 3 accepted with the documented CI exception

Implemented same-option rent/availability search, property type and price basis, stable pagination and newest/rent/distance sorting; private student favorites; complete selected-option comparison; keyboard/button photo gallery; and opt-in Leaflet maps with backend-calculated campus distances. All local checks pass: 67 PHPUnit tests / 303 assertions, 10 frontend tests, ESLint/production build and 6 Chromium/WebKit tests (1.7 minutes) covering Phases 1–3. The eighth additive cloud migration passed after a verified private application-schema export. Source `eae862f65cb0e2d9019eeb673a51b23d01aa1d16` is live on the existing Render/Vercel projects. All six deployed checks passed across the Chromium run and targeted WebKit rerun, including the Phase 3 flow (49.9s / 49.2s respectively). The original draft/private photo remain intact; runtime schema CREATE and anonymous/authenticated schema usage remain denied. Three public assets passed the credential scan; Supabase security advisors reported no lints. A single external campus tile returned HTTP 200/image/png. The initial WebKit authentication run reported an access-control network page error; all functional assertions passed and the unchanged rerun passed with no page errors. See validation evidence for the exact limits. Preserve existing credentials, provider IDs, source migrations and records.

## Phase 4 accepted with the documented CI exception

Phase 4 is accepted with the documented CI exception. All 79 backend tests / 452 assertions, 15 frontend tests, lint/build and six local Chromium/WebKit checks pass. The ninth additive cloud migration followed a verified private application-schema export. Runtime audit UPDATE/DELETE remain denied; INSERT/read are allowed; schema CREATE and anonymous/authenticated schema usage remain denied. Supabase security advisors returned no lints. Source da0f30d6c9490fbee1ec199921a60c25bd547463 is live on the existing Render/Vercel projects. All six deployed checks passed in one 4.0-minute Chromium/WebKit run, including the full report/moderation/lifecycle/notification/audit/count flow. Original draft/photo data survived; an expired fixture session was renewed normally. Three public assets passed the credential scan. Render returned no error-level logs in the inspected release window. No dependencies, credentials, paid resources or unrelated services were replaced. GitHub release CI run 37924843463 remains blocked before any steps by the account billing lock.

## Remaining phases

### October 11 student-first improvement review

The user prioritized student search, listing details and overall usability. The earlier phase acceptance covers tested workflows; it does not mean the product is finished or easy enough to use. Local browser inspection reproduced the following student friction points: signing in from a listing lands on `/account` instead of returning to that listing; the Profile link is hidden at 360px; and the mixed-availability listing defaults to its PHP 2,000 sold-out option while a separate PHP 8,200 option is available. No horizontal overflow was seen on the inspected 360px account/browse screens.

Prioritized follow-up work, with observable completion criteria:

| Priority | Improvement | Evidence and completion criterion |
|---|---|---|
| 1 | Authentication errors and report reliability | Guest API requests without JSON Accept failed because Laravel tried to resolve an absent login route. Fixed and verified live on October 11: guest redirects are disabled and errors consistently return JSON 401. Also align the report title snapshot length (120) with accepted property titles (150); cover long titles with a regression test before changing the schema. |
| 2 | Keep students in their task | Preserve the intended listing/selected room through sign-in; expose profile/account actions on mobile; retain question text when recovering from an expired session. Verify each from the actual student flow. |
| 3 | Make availability and costs easy to judge | Clearly distinguish sold-out, available and unconfirmed inventory. Avoid presenting a sold-out lowest price as the main actionable option. Show pricing basis, monthly fixed charges, move-in charges and variable utilities together. Verify mixed inventory and stale availability examples. |
| 4 | More useful discovery | Existing filters cover text, property type, price basis, base rent, campus, availability and sort. Add room/inventory type and structured amenities first; consider distance radius and a compact mobile filter panel. Filters must continue matching the same eligible room option. |
| 5 | Richer listing information | Current data centers on description, address, coordinates, photos and room costs. Add structured facilities and house rules, clearer freshness information, useful photo captions/cover selection and an owner-friendly map pin picker. Coordinates are currently entered manually and labeled optional for drafts despite being required for submission. |
| 6 | Easier shortlisting and comparison | Review the registration gate for comparison of already-public information, make the three-selection limit clearer, and keep selected room options/price bases visible throughout. Preserve private favorites and avoid changing access rules accidentally. |
| 7 | Clearer conversation and account recovery | Inquiry lists show participant/time but no per-conversation unread state; notifications live on a separate page. Add visible unread/new-reply cues and improve session-expiry recovery. Password recovery/email verification need a separate free-provider plan before use by real tenants/owners. |
| 8 | Loading, accessibility and operational readiness | Give long backend wake-ups useful feedback; check keyboard focus, error recovery and mobile controls across real tasks. Complete backup/local-fallback recovery and two deployed rehearsals after the chosen improvements. |

The approved API fix passes 17 authentication tests and the complete local backend suite (90 tests / 776 assertions). A browser check through the local frontend confirms JSON 401 with no redirect for wildcard, HTML and JSON Accept headers. The backend fix is live from commit 92a7065; all four deployed guest-error and sample-workflow checks passed in Chromium/WebKit. Deployment evidence is in validation.md. The other rows are a prioritized backlog, not claims of completed improvements; new facilities/filter data and changes to guest comparison require deliberate implementation and acceptance checks.

The user-requested safe synthetic dataset portion of Phase 5 is complete locally and live: 16 public fictional samples plus three private lifecycle examples, 38 room options and 38 private normalized layout images. All 24 existing live properties and their related prior records were preserved. Repeat execution skipped every sample and added nothing. Seven meaningful seed tests pass, and the full backend suite is now 86 tests / 596 assertions. The sample workflow passes in Chromium/WebKit both locally and live, including loaded images, filters, favorites, three-property comparison, map pins and participant-only inquiry/reply. The remaining Phase 5 work still includes hardening, rollback/local fallback and two deployed rehearsals; this dataset does not complete the full phase. Direct non-JSON guest API authentication was fixed and verified live on October 11; it now returns JSON 401 with no redirect.

| Phase | Deliverables | Acceptance gate |
|---|---|---|
| 5 | Integration debugging, accessibility, safe synthetic seeds, final course/demo docs, rollback/local fallback | Two deployed rehearsals; all required checks pass |
| 6 | October 14 rehearsal/submission | Provider availability, smoke checks, release evidence |

October 9: deployment gate. October 10: full workflow gate; drop the target backlog if late. October 12: stop feature expansion. October 13: hardening and rehearsal; freeze by 20:00. October 14: presentation.

Ordered optional backlog: room-type/amenity/radius filters; Blade printable comparison; geocoding; photo ordering/profile richness; expanded statistics. Email verification/reset and additional campus administration remain stretch. Payments, reservations, real-time chat, identity verification and recommendations remain excluded.

Instructor clarification: Blade grading, external messaging-service requirement, XSL, final rubric and exact submission time.


## October 11 improvement increment

The approved improvement plan is split into five delivery parts in [improvement-plan.md](improvement-plan.md). The first core increment is implemented and deployed to the existing free services: seven-campus discovery/preferences, student filtering/recommendations, map/list selection across all result pages, guest comparison, warm responsive navigation, listing facilities/rules, photo ordering, a pin picker and audited vacancy refresh.

Application source is 605085b1063f7d86cbf47531d88e83cb8b3428e2. The backup, migration, campus synchronization, preserved-row checks and original draft/photo readback passed. Local gates pass 99 backend tests/830 assertions and 20 frontend tests, lint/build; all 12 deployed browser scenarios have passing evidence across the full run and targeted reruns. See validation.md for the explicit WebKit cancellation diagnosis and interim failures.

Remaining work is tracked explicitly: verify additional campuses; improve restoration of unsubmitted map movement and unsaved-edit protection for browser Back/programmatic navigation; refine dashboard and publishing usability with user feedback; complete the historic formal rollback/local-fallback rehearsal. The broader marketplace roadmap remains planned, and the approved GitHub billing-lock CI exception is still separate from acceptance evidence.

## Map continuity completed — October 11

The next student-usability increment is deployed: map center/zoom, pending area-search state, selected listing/room and List/Map mode survive listing visits and return navigation. Filter URLs remain authoritative. Searches retain independent bounded tab context, while result pages share context. A first mobile Show on map action still centers its chosen listing; restored views keep the student's position.

Frontend source 916df82 is live on the existing Vercel project. Twenty-three frontend tests, lint/build and all eight affected deployed browser scenarios have passing evidence (including the targeted rerun documented in validation.md). Backend/data/provider credentials are unchanged. The next implementation item is fuller unsaved-edit protection for browser Back and programmatic navigation; additional sourced campuses remain in the backlog.

## Recovery verification - October 12, 2026

The current frontend was temporarily rolled back to its immediately previous compatible Vercel production build and then restored successfully. The public build marker, API readiness, ten campuses and sixteen sample listings passed on the previous build. Current build and automatic domain assignment are restored. A separate production-schema backup was restored locally with all 21 table fingerprints and constraints verified.

Cold local application/database restart preserved 20 application tables (session rows excluded), 141 private files and both existing environment files. Sample and full three-role workflows pass in Chromium/WebKit with browser external requests blocked. The repeatable command is npm.cmd --prefix frontend run test:fallback. Startup/shutdown scripts now preserve setup files and report occupied ports or failed process lifecycle operations truthfully.

This completes the rehearsed frontend rollback and local fallback coverage. Render rollback controls, full S3 bucket restoration, final release tagging, the remaining marketplace roadmap and the historical GitHub billing-lock CI exception remain separate. Live application code is unchanged by this operations-only increment; current sources remain backend 5b76e53 and frontend cc807b4. See deployment.md and validation.md for exact scope.

## October 12 approved steps 1–4 follow-up

Private photo backup and isolated local/S3 restore are verified for all 96 objects, with unchanged original inventory and all temporary cloud copies removed. The isolated database's 96 ready-photo references have checksum-verified, decoded restored bytes. Live Render rollback is deliberately pending at the user's request.

The campus directory now has 15 distinct locations, including four CEU locations and TIP Quezon City. A fresh private schema backup preceded cloud synchronization. The sync ran twice and preserved original campus values and application-row fingerprints; ten migrations and restricted runtime grants remain unchanged.

The remaining photo, moderation and lifecycle form guards are implemented, including failed-save retention, guarded report filtering, submission protection and stable photo retry identity. Student refinements preserve mobile filter input and comparison campus/room context, and surface room costs near the top of listing details. Final release evidence is recorded in validation.md. This increment does not complete the broader marketplace roadmap or resolve the historical GitHub CI restriction.

Release ce04614 is live on the existing Vercel production alias; all 12 focused deployed Chromium/WebKit scenarios passed in one run (50.9s). API readiness, all 15 campuses, the public build marker, startup-asset credential scan and real map tiles passed. Backend PHP remains 5b76e53; campus data was explicitly synchronized after backup. See validation.md for precise local/live coverage and deferred Render rollback.

## Practical features — local checks complete, October 12

The approved campus finder, truthful selected-room match explanations, comparison highlights, private named shortlists/notes, viewing requests/counterproposals and useful dashboard counts are implemented locally. Interrupted work was preserved. Card and map-preview room changes synchronize selections, prices and comparison; inquiry/viewing forms and the room editor have distinct React keys.

Passing evidence: 104 backend tests / 918 assertions, Pint, 44 frontend tests, ESLint, the Vercel build, and six focused Chromium/WebKit scenarios including the complete three-role workflow. Two strengthened room-price synchronization cases also pass. No known local regression failures remain in this scope. Detailed evidence is in validation.md.

This batch remains uncommitted and undeployed. Its production backup/migration, permissions checks, deployment and live acceptance are pending; frontend ce04614 and backend 5b76e53 remain the live sources. Live Render rollback stays deferred by the user. The historical GitHub CI billing restriction is a separate exception.

## Practical features — released and verified, October 12

The pending backed-up migration and controlled deployment steps are complete. Application source 5d48f44 is live on both existing free services: Render dep-db674a0473hc73dcs7lg and Vercel dpl_CzQKZupB69QJfip2BkLDiKBuMogp. The production alias remains https://dormfinder-pink.vercel.app. Eleven migrations are applied; thirteen existing application-table row fingerprints are unchanged, and restricted grants remain enforced. Supabase security advisors report no findings.

All six real deployed Chromium/WebKit scenarios pass in 1.5 minutes: three-role dashboard counts/destinations, room and displayed-price synchronization, and the campus finder/private shortlist/viewing negotiation-confirmation flow. Test shortlists are removed and synthetic viewing requests cancelled with history retained. Public startup assets pass credential scanning, the entry marker matches the tested build, all fifteen campuses remain available, and twelve real map tile requests pass with zero failures. The post-deploy Render application error query returned no error logs.

The agreed practical-feature batch is complete. Live Render rollback remains deferred by the user; GitHub CI's historical billing-lock exception was not reverified. Informational database performance findings remain recorded separately in validation.md. No new paid resources or further roadmap features were introduced.

## First appearance/flow increment — released October 12

Frontend source 3db30dc is READY in dpl_FcvdkSKzN1NaMFgyBdXpFT9UWxyY at https://dormfinder-pink.vercel.app. It establishes calmer shared styling, grouped saved/account navigation with active states and keyboard dismissal, a reusable home/campus search, content-first results with optional filters, and a focused room/cost decision area with expandable terms and private actions. Drafts remain mounted when collapsed, restored questions reopen, and viewing drafts retain room-change protection. Shared styling/navigation apply to existing roles.

Passing checks: 46 frontend tests, lint/build, all 26 affected local Chromium/WebKit scenarios across the recorded main run/rerun, and all 18 live scenarios in one 2.5-minute run. Live asset scanning, the build marker, all fifteen campuses, real map tiles and the bounded Render error query passed. Backend remains 5d48f44; no backend code, schema, dependency or provider configuration changed.

This completes the shared-navigation and home/search/results/details visual increment. Saved places/comparison, conversations/viewings/student home and deeper landlord/admin layouts remain the next visual stages. The five functional priorities remain saved and deferred during visual work. Live Render rollback and the unverified historical CI exception remain separate.

## Second appearance/flow increment — released October 12

Frontend source 6c2da4e is READY in dpl_H92dnpEHJbxQK7dSY4vADJFyaLDL at https://dormfinder-pink.vercel.app. Home now leads with one campus search and actual published available-room previews. Listing photos and the selected-room decision panel share the desktop layout, with photos then decisions on mobile. Private shortlists, conversations and viewings share property/room context and clearer continuation paths. Notes and owner proposals open when needed; student home prioritizes actual outstanding decisions before counts. Existing snapshots, exact room selection, drafts and navigation guards remain intact.

Passing evidence: 50 frontend tests, lint/build, eighteen full affected local Chromium/WebKit scenarios, ten final focused local cases and eighteen live cases in one 2.9-minute run. The production build marker, backend readiness, public credential scan, fifteen-campus directory, twelve successful real map tiles and bounded Render error query pass. Browser artifacts and public screenshots remain ignored. Backend remains 5d48f44; no migration, dependency, provider environment or paid resource change occurred.

This completes the scoped second visual pass. Further comparison and deeper landlord/admin workspace layouts remain planned, alongside the five retained functional priorities. Live Render rollback is still deferred by the user; the historical GitHub billing-lock CI exception remains unverified. Existing data and the user's untracked certificate were preserved.

## Persistent discovery map — released October 12

Frontend source 1dc03d4 is live in dpl_A1ca9LxXCVnmHZ87npvp3374sWn3 at https://dormfinder-pink.vercel.app. A viewport-sized right-hand map now begins alongside the discovery heading and stays under the desktop header while results scroll. Selected-room previews stay inside the map, with a close/focus-return control. Compact filters, separated map labels and selected-cluster room prices make the map a central part of browsing. Mobile List/Map mode and existing room/price/comparison and Back-navigation continuity are retained.

Passing evidence: 53 frontend tests, lint/build, sixteen affected local browser scenarios, and all sixteen live scenarios across the main run and corrected two-case heading-selector rerun. Real map tiles, public asset scanning, the deployed build marker, readiness and the bounded backend error query pass. Details are in validation.md. Backend source remains 5d48f44; existing data, free plans and the user's untracked certificate were preserved. Other planned visual work and the previously deferred operational checks remain separate.

## Filter drawer — released October 12

Frontend source 163ad43 is live in dpl_413BQYzMg1nU7HvuqbutsB5cp4yf at https://dormfinder-pink.vercel.app. Filters now open in a desktop side drawer or mobile sheet without shifting the listings/map. Four grouped sections scroll independently of the heading and Apply/Clear footer. Closing preserves drafts; Clear all inside the drawer takes effect on Apply. Keyboard focus, Escape, outside dismissal, background scroll locking and focus return are verified. Standalone sorting, applied filter count and same-campus map preservation keep refinement connected to discovery.

Passing evidence: 55 frontend tests, lint/build, all eighteen affected local browser scenarios and all eighteen scoped live browser scenarios across main runs and corrected test-only reruns. Readiness, the exact production build marker, public asset/credential scan, fifteen campuses, sixteen real map tile responses and the bounded backend error query pass. Details and initial test failures are recorded in validation.md. Existing work, production data, free providers and the user's certificate were preserved. Backend remains 5d48f44; no schema or backend deployment was required. Further visual work and the previously deferred operational checks remain separate.

## Animated entrance and image-led blue refresh — released October 15

The approved scroll-driven 3D room entrance was released as 8969af5 / dpl_5BGPDTspNBPb7BvQtRAovpDrocok. Its original geometry, scroll reversal, mobile framing, direct search shortcut and reduced-motion/graphics fallbacks remain. The subsequent user-approved white/navy/cobalt refinement is current source 93021f3, READY in dpl_936fS3U5iUKgnVUzukNyNAePGMoR at https://dormfinder-pink.vercel.app.

The palette applies throughout existing screens, the header spans the viewport, and self-hosted Inter provides a consistent sans-serif font. The numbered Explore/Compare/Visit strip is removed. Large homepage covers show only listing titles and demo identification. Three original optimized interior concepts are gated to the named fictional demo samples and labeled AI demo illustration, preserving ordinary uploaded photos and existing galleries. Exact room links, availability/campus rules, drafts and navigation context remain in place. Asset paths, prompts and provenance are in design-assets.md.

Passing evidence: 58 frontend tests, lint/build, all twenty-four local cases across scoped runs, and all twenty-four live Chromium/WebKit scenarios in one clean 1.8-minute run. Actual 3D runs in both browsers. Final build/engine markers, generated covers, font loading, readiness, public credential scan, fifteen campuses and sixteen real map tiles pass. The existing deferred-engine size advisory remains recorded rather than suppressed; slow devices reduce drawing resolution and graphics failure uses the static poster. Backend remains 5d48f44; no migration, backend deployment, provider environment, production record or paid-service change occurred. The user's certificate is preserved. Further comparison and landlord/admin visual work, retained functional priorities and previously deferred operational checks remain planned.

## Visible campus search and compact listing facts — released October 15

Frontend source 4620368 is READY in dpl_ERxMRJUXEaGbDjWqFeDJctXvpq6g at https://dormfinder-pink.vercel.app. Campus autocomplete and Search campus are always visible on results; the remaining refinements stay in the drawer. Campus changes retain other requirements and clear stale map/page scope. Clearing advanced filters retains campus. Featured homes show one minimal price/basis/room-capacity row beneath their titles. Guests have one Sign in entry, with registration available from that page. The Sort helper and recommendations explanation block are removed. Removing administrator setup copy from public auth pages remains a separate, unimplemented suggestion.

Passing evidence: 61 frontend tests, lint/build, all twenty scoped local browser cases across recorded runs, and all twenty live Chromium/WebKit cases in one clean 1.8-minute run. Build/engine markers, font/demo covers, readiness, public credential scanning, fifteen campuses and sixteen real map tiles pass. No scoped regression failure remains. Backend source 5d48f44, production records, free providers and the user's certificate are preserved. No backend deployment, migration, dependency or environment change was required. Existing roadmap work, deferred Render rollback and the unverified historical GitHub CI exception retain their prior status; see validation.md and deployment.md for evidence and recovery references.

## Student space and profile settings — released October 15

Frontend source b51af8d is READY in dpl_GTWSyUZJD7RjkjrJpCtwfRCRYPUW at https://dormfinder-pink.vercel.app. The student's account page now has usable campus search, visual saved-place previews and actual recent conversations/future viewing requests. Generic next-step cards, the full-name greeting and statistics strip are removed. Empty activity sections disappear; failed collections retry independently. Exact room prices/bases/capacities and destinations, demo labeling and unavailable/stale states are retained. Viewing links focus the relevant request. Mobile puts activity ahead of saved places.

Profile now groups personal details and campus, with password controls collapsed until needed. Saving a campus updates the next search, validation rejects unselected text and existing independent draft/password guards remain. Guest navigation has Browse and one Sign in entry; Create an account still offers both roles. The redundant For landlords navbar entry and public administrator setup note are removed. Account retains reports and notifications; landlord/admin operational dashboards remain intact.

Passing evidence: 66 frontend tests, lint/build, forty distinct local browser cases across recorded runs and forty deployed Chromium/WebKit cases in one clean 2.6-minute run. A separate real-account check confirms four successful private collection responses, exact room/viewing links, mobile profile rendering and zero page errors. Built entry/engine, deferred private-page chunks, font/covers, public credential scanning, readiness, fifteen campuses and sixteen real map tiles pass. New write/error/empty-state browser scenarios use controlled API fixtures; production preferences/listings were not edited. Existing records, free providers and the user's certificate are preserved. Backend remains 5d48f44; no backend deployment or migration was required. Other roadmap work and previously deferred operational checks remain separate.

## Conversation-first messaging and private profile photos — released October 16

Frontend source 3e808ed is READY in dpl_CxJG68NdCiNoigtV9bjF9VVZhLEE at https://dormfinder-pink.vercel.app; backend source 0263525 is live in Render dep-db8f5ie89jmc73d96900. The student's Your space no longer contains discovery search or statistics. Saved places navigation contains only Favorites and Shortlists. Messages replaces the inquiry/ticket presentation with a desktop inbox/chat workspace, participant photos/names, message previews, incoming/outgoing bubbles and a compact composer. Mobile has separate inbox/chat views. Duplicate viewing/conversation cross-links are removed; relevant room/viewing actions use contextual buttons.

People can upload or remove their own real profile photo in Edit profile; missing photos use initials. Photos remain in existing private storage and are readable only by self or actual conversation participants. Latest/older history, paused threads, draft guards, retry identity, keyboard history scrolling and mobile/landscape layouts are verified. Existing campus preference stays in profile, while Browse/home retain discovery. No public avatar service, fabricated profile photo, read receipt or typing indicator was introduced.

Passing evidence: 108 backend tests / 968 assertions, Pint, 69 frontend tests, lint/build, 44 distinct local browser scenarios across recorded runs and all 46 scoped live Chromium/WebKit scenarios in one clean 4.5-minute run. Actual student–owner messages and temporary private-photo upload/session persistence/removal pass in both browsers. Independent existing-account/private collection, exact saved-room/viewing links, image loading, public asset credential scan, readiness, fifteen campuses and sixteen successful real map tiles pass. The bounded backend error query returns no error logs. Supabase security advisors returned zero findings. Detailed scope, earlier test corrections and artifacts are in validation.md.

Completed work and existing data are preserved. Only designated synthetic acceptance activity was added and temporary test photos were removed. Existing free providers, schema, grants, dependencies, environment and the user's certificate are unchanged. Saved-place/comparison and deeper landlord/admin visual work remain planned outside this increment. Live Render rollback remains deferred; the historical GitHub CI exception remains unverified.

## Visible listing actions and viewing workspace — released October 16

Frontend f7bc238 is READY in dpl_dDQ7LuyTesQoFPhNw5VJMPwen3gG at https://dormfinder-pink.vercel.app; backend 26b00ad is live in dep-db8oudff3r2c73esvfn0. Request a viewing and Message owner are visible listing actions. Save opens the shortlist picker, Compare is compact, and phones keep price/basis plus the visit action in a bottom bar. Focused dialogs preserve drafts when closed and restore keyboard focus. Existing requests show their state and View request, keeping the actual requested room explicit.

Viewings has Upcoming, Requests and History, with property images, participant photos and clear appointment dates/statuses. Desktop pairs a list with selected details; phones open a focused appointment screen. Pending decisions appear beside the time. The owner's proposal button directly opens/focuses its fields; student acceptance, cancellation, history and contextual Messages actions retain existing authorization and scheduling rules. Server-side grouping/pagination, private deep links and old status URLs are verified. Unpublished images are withheld while request snapshots remain available; proposal drafts are protected during refresh/navigation.

Passing evidence: 110 backend tests / 1000 assertions, Pint, 69 frontend tests, lint/build, 54 distinct local browser scenarios and all 56 scoped live Chromium/WebKit scenarios across recorded runs. The final affected ten-case live rerun passes cleanly in 1.5 minutes, including actual student–owner request/proposal/confirmation and cleanup, direct owner-button focus and phone decision visibility. Final public asset/credential scanning, scene/readiness, fifteen campuses, sixteen real map tiles, bounded application-error logs and security advisors pass. Validation.md distinguishes controlled UI fixtures from real deployed API journeys and records earlier failures, corrections and cleanup.

Completed work, existing records, free providers and the user's certificate are preserved. Only designated synthetic acceptance activity was changed: temporary private lists/photos are removed and viewing requests cancelled with history retained. No migration, grants, dependency, provider environment or paid-resource change was introduced. Other roadmap work, deferred Render rollback and the unverified historical CI exception remain separate.
