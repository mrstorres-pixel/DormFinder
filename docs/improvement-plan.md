# DormFinder improvement plan

Status: first improvement release deployed on October 11, 2026; follow-up refinements and later roadmap remain planned. This document is the delivery plan and continuing backlog. Preserve completed work and existing data; build on the current React frontend, Laravel API, Supabase database/storage, Render backend and Vercel frontend. Keep all provider accounts and services free. Never reset production data or expose credentials.

## Product direction

Make finding student housing near a specific college or university the main experience. Support multiple institutions and distinct campuses, rather than only TIP. Use SuzyRent's side-by-side rental results and map as inspiration, with clearer student costs, campus context, useful comparisons and honest availability. Aim for measurable usability and reliability rather than claiming to be better in every way without evidence.

Use a warm visual identity: ivory backgrounds, white surfaces, dark brown text and burnt orange actions. Carry consistent controls, navigation, feedback and accessibility across student, landlord and administrator screens.

## Part 1: Foundation and university discovery

- Audit the existing functionality and retain completed work, account roles, private inquiries, moderation and audit records.
- Add an institution/campus directory with searchable names, acronyms, aliases and city. Different campuses must remain distinct.
- Allow guests to search; allow students to save an optional preferred campus. An explicitly selected campus takes precedence over the preference.
- Make the homepage's primary action campus search followed by recommended nearby listings.
- Default to a 2 km straight-line radius; offer 0.5, 1, 2, 5 km and unrestricted results. Label distances accurately; do not present straight-line distances as walking routes.
- Combine campus, budget, room type, price basis and amenities. All room-specific constraints must match the same room option.
- Recommend fresh available matching options first, then campus distance, with stable tie-breaking. Explain recommendations factually. Label sold-out or stale availability.
- Show a useful empty state for campuses without supply. Never silently broaden a student's radius or filters.
- Start with sourced Metro Manila campuses and expand deliberately. Candidate institutions include TIP, PUP, UST, FEU, UE, NU, CEU, DLSU, UP, Adamson and Ateneo; this is a verification backlog, not a claim that every campus is already supported.

Local implementation: additive schema, campus command, search, preferences, radius and ranking are implemented. The sourced directory now contains ten campus entries for TIP, PUP, UST, FEU, UE, NU, DLSU, Adamson, UP Diliman and Ateneo Loyola Heights. Coordinates are approximate map reference points; retain sources in database/campus-directory.json. Remaining institutions and campus branches need verification before addition.

## Part 2: Student search, maps, details and comparison

- Provide a persistent desktop map beside results, plus a list-only choice. On mobile provide clear List/Map controls and a selected listing preview.
- Synchronize selected cards, price markers and previews. Expand clusters when zooming; provide an accessible alternative for overlapping markers.
- Apply map searches to the complete filtered result set, not only the currently paginated cards. Use explicit Search this area after moving the map, disclose result caps, and keep campus and radius context visible.
- Show matching room prices and their per-person/per-room basis; avoid advertising the cheapest sold-out option as the default.
- Include campus markers, radius circles and Back to campus. Keep map attribution and manual address/coordinate fallbacks.
- Preserve filters in URLs, expose removable filter chips and reset actions, and keep mobile filters compact.
- Provide six initial landlord-declared amenities: Wi-Fi, shared kitchen, laundry, parking, study area and security. Unknown information must appear as not provided.
- Organize details around photos, eligible room options, availability, monthly costs, move-in costs, variable charges, location, amenities and house rules.
- Calculate money in integer centavos and explain deposit, advance rent and recurring fees separately.
- Allow guests to compare up to three selected room options, including price basis, costs, amenities, rules and campus distance.
- Require sign-in for favorites, inquiries and reports. Preserve safe internal return paths and selected room context. Do not automatically submit a private action after authentication.
- Preserve an unsent inquiry draft in account-scoped tab storage; clear it after successful submission or logout.
- Replace TIP-only messaging, repair mobile navigation and provide clear loading, empty, error and retry states. Explain a waking free backend after a delay.

Local implementation: core map, search, details, comparison, mobile navigation and inquiry recovery changes are implemented. Map interaction and responsive guest flows passed Chromium and WebKit. Map continuity now retains pan/zoom, pending Search this area, the selected listing/room and List/Map mode across browser Back and the Browse listings link. Context is kept per filtered search in bounded tab storage; result pages share that context, and different campuses stay separate. Storage failure falls back safely to normal browsing. The new round-trip and campus-switch checks pass locally in Chromium and WebKit; deployed acceptance is recorded in validation.md. Tile imagery was separately verified in the preceding live release.

## Part 3: Landlord publishing and administrator review

- Group listing editing into understandable sections with a completion checklist and clear draft/review/public status.
- Add amenities and house rules, optional map pin placement with manual coordinates, and photo cover/reordering controls.
- Retain input after validation errors and warn before leaving unsaved edits.
- Allow owners to refresh vacancy counts without removing an approved listing from discovery. Reject stale revisions, foreign inventory and counts beyond existing capacity; record an audit event.
- Continue sending material edits, including photo ordering, through the established review workflow.
- Keep historical inquiry snapshots intact after subsequent edits or moderation.
- Show administrators the same public listing information during review, with clear criteria and actions. Retain private inquiry access restrictions.
- Improve existing dashboards with useful status and next actions; deeper analytics and viewing schedules belong in later releases. Implemented: role-specific next actions, linked counts, saved-campus student browsing and listing status guidance. Existing unread notification counts link to updates.

Local implementation: amenities/rules, pin picker, photo order, completion checklist, vacancy endpoint/form and review information are implemented. Property and room-option edits now share one navigation guard covering links, browser Back, programmatic route changes and document unload. Sign-out checks happen before the API request, failed sign-out keeps protection active, and saving one form does not clear another form. Escape/Stay retain edits; Discard explicitly leaves. Room fee add/remove and cancelling a room edit also mark/check unsaved changes. Switching room options and removal/availability actions that replace the room editor now check for unsaved room edits before proceeding. The follow-up also protects profile edits, password inputs, vacancy counts, review decisions, listing reports, report-resolution notes and inquiry replies during route navigation and unload. Successful saves clear only the affected form; failed saves retain input and protection. Other forms and same-page replacements beyond the room editor remain follow-ups.

## Part 4: Reliability, security, performance and usability

- Use additive migrations and a verified backup before production changes. Never run destructive reset/seed commands against production.
- Preserve least-privilege database access, ownership checks, CSRF protections, private storage and audit history.
- Keep campus synchronization explicit and idempotent; preserve existing campus coordinates and existing housing records.
- Match public map and comparison publication rules to listing details. Return only necessary public fields and disclose the 200-result map cap.
- Fix the 150-character listing title/report compatibility issue.
- Avoid replaying non-idempotent submissions when recovering from expired sessions.
- Review keyboard navigation, focus, touch targets, readable contrast, loading feedback and layouts at 360, 768 and 1440 pixels. Search/details/comparison, inquiry and review code now loads when those pages are opened; page-level loading and recovery UI stays available.
- Verify campus matching, distance boundaries, same-option filters, recommendations, guest comparison, private record restrictions, vacancy ownership/conflicts, photo order and directory idempotency.
- Run PHP tests, frontend tests, lint/build and complete student/landlord/admin browser workflows in Chromium and WebKit.
- Treat GitHub's existing billing-lock CI failure as an explicit temporary exception. Local checks and release checks do not make the GitHub check green, and do not authorize paid upgrades.

Verification: the final backend suite passed 99 tests/830 assertions; the current frontend unit/component suite passes 36 tests; lint and production build passed. Existing and expanded local browser workflows passed in Chromium and WebKit. Deployed checks include the sample dataset and all three account roles; detailed run outcomes are recorded in validation.md.

## Part 5: Controlled release and handoff

1. Finish affected checks and inspect the final diff, including secret exclusion.
2. Back up the existing DormFinder production schema and verify the backup catalog.
3. Apply the additive migration and explicit campus synchronization using existing scoped credentials. Verify preserved records and runtime permissions.
4. Publish the reviewed commit and deploy only the existing free DormFinder Render and Vercel services.
5. Rehearse guest campus search and all three account roles against the deployed system; verify public listings, private inquiries, storage, maps and responsive navigation.
6. Record deployed commit/URLs, test evidence, limitations and recovery instructions. Keep the prior deployment available for rollback. Rehearsed October 12: Vercel production rollback-and-return, actual private schema restore into an isolated local database, cold local restart with data/photo preservation and local role/sample workflows with external browser requests blocked. Render rollback and complete S3 bucket restore remain separate coverage.

Production status: backend source 5b76e53d0be76d093a6ca4c692d6c49b793d7528 remains live on the existing free Render service, and frontend source cc807b4de341e38ec03b5aabaa31d191555bf649 is live on the existing free Vercel project, with ten sourced campuses, dashboard next actions, map continuity and property/room navigation protection. The fresh backup catalog, additive migration, explicit campus synchronization, preserved application-row fingerprints, restricted runtime grants and original private draft/photo readback passed. Local secret files and the existing user certificate were excluded from the release. See validation.md for browser acceptance evidence and known refinements.

## Order, timebox and release criteria

Work in parts 1 through 5, with overlapping verification as necessary. The proposed target is implementation on October 11-12, feature cutoff October 12, hardening October 13, freeze at 20:00 Singapore time October 13, and final smoke checks October 14. Adjust dates to evidence rather than skipping release gates.

If time becomes constrained, defer dashboard polish, advanced photo controls and pin-picker polish before weakening core search correctness, privacy or release checks. A release must retain existing workflows and have truthful costs, campus context, availability and failure states.

## Later roadmap

- Verify and expand campuses, branches and geographic coverage.
- Improve saved searches, alerts and recommendations using real usage evidence.
- Add secure email verification and account recovery; assess notification/unread workflows.
- Add viewing appointments and landlord response tools.
- Plan applications, reservations, cancellation rules and document privacy separately.
- Plan payments, refunds, disputes and trustworthy reviews separately, with explicit operational requirements.
- Improve search quality, accessibility, performance and dashboards through user testing.

These are future planning items, not completed functionality or permission to incur costs.
