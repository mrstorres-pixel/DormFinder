# DormFinder improvement plan

Status: core releases, the practical-feature batch, connected appearance/flow, persistent map, filter drawer, scroll-driven room entrance and white/navy/cobalt refresh are deployed October 11–15, 2026. The connected visual redesign now covers discovery, selected-room details, private shortlists, conversations, viewings and student-home priorities, with an image-led homepage and self-hosted typography. Further comparison and deeper landlord/admin workspace layouts remain planned, alongside the retained functional priorities below. The approved follow-up steps 1–4 are verified, except live Render rollback, which the user explicitly deferred. Preserve completed work and existing data; build on the current React frontend, Laravel API, Supabase database/storage, Render backend and Vercel frontend. Keep all provider accounts and services free. Never reset production data or expose credentials.

## Product direction

Make finding student housing near a specific college or university the main experience. Support multiple institutions and distinct campuses, rather than only TIP. Use SuzyRent's side-by-side rental results and map as inspiration, with clearer student costs, campus context, useful comparisons and honest availability. Aim for measurable usability and reliability rather than claiming to be better in every way without evidence.

Use the October 15 approved visual identity: white surfaces, deep navy text, cobalt-blue actions and subtle blue-gray supporting surfaces. Use self-hosted Inter throughout, clear contrast, restrained borders and image-led homepage features. Carry consistent controls, navigation, feedback and accessibility across student, landlord and administrator screens. This supersedes the earlier ivory/brown direction; dated release notes below preserve its history.

## Next phase: a connected visual and interaction redesign

User direction, October 12: the recent interface feels clunky, overly dominated by controls, and unintuitive between steps. The whole system should feel connected. Prioritize the experience and visual hierarchy before adding more functional modules. The direction was initially recorded without interface changes; the first implementation increment is described below. Remaining screen-specific redesign stages stay planned.

### Findings from the current screens

- The authenticated header presents Browse, My space/Reviews, Inquiries, Viewings, Favorites, Shortlists, Notifications, Profile and Sign out with little hierarchy. Users have to infer which destination serves their current task.
- The homepage campus form and separate campus finder are competing starting points. A single housing-search entry should reveal optional refinements naturally and carry its choices into results.
- Listing details place room costs, comparison, an inquiry form, shortlist controls and a viewing form in the same column. These actions need distinct purpose, priority and progressive disclosure.
- Dashboards repeat linked counts and multiple next-action cards, then add further browse links. Important decisions and continuing work need stronger priority than the number of available tools.
- Shortlists, conversations and viewings largely present independent forms/lists. They need consistent property/room summaries, clear return paths and context explaining how they relate to the student's housing decision.

### Experience model

The main student journey is: choose a campus and needs → explore results and map → understand a selected room and its costs → optionally save/compare → ask the owner or arrange a viewing → follow responses and agreed visits. Saving, comparison and inquiry are optional branches, not mandatory steps or locked wizard stages. Experienced users can browse directly and revisit any stage.

Use persistent campus/search context in discovery, selected property/room context in details and comparison, and the existing private historical snapshots in conversations and viewings. Return navigation must recover the search and room wherever that context is available. Do not invent a relationship between an unrelated inquiry and viewing, automatically send a request, or silently replace a draft when the user changes context.

### Shared visual foundation and navigation

- Keep the approved white/navy/cobalt housing identity, legible text, calmer supporting surfaces and consistent spacing. Use photography and useful content to establish hierarchy.
- Define shared page headings, property/room summaries, cost summaries, status treatments, empty states, feedback and action placement. Use borders and cards for meaningful groups; avoid wrapping every paragraph or action in another panel.
- Give each screen one clear primary action appropriate to its state. Keep secondary actions visible but quieter; destructive actions belong away from the primary task.
- Organize student navigation around Find housing, Saved places, Conversations and Viewings. Group favorites and named shortlists within Saved places, and place profile/settings and notification access in a consistent account area. Preserve the existing routes and access rules while simplifying how they are presented.
- Give landlords a coherent workspace for listings, student conversations and viewings. Give administrators a coherent workspace for review, reports, accounts and history. Keep a shared brand/header vocabulary while making the role's current area obvious.
- Use active navigation, meaningful breadcrumbs and contextual return links. Keep mobile navigation concise and touch-friendly, with the same destinations and current-page cues as desktop.

### Screen-by-screen direction

1. **Home and campus search:** one obvious campus-led starting point. Show budget/room/distance refinements in a compact, understandable group. Let students adjust preferences without starting again. Avoid a long introductory explanation before useful search controls.
2. **Results and map:** put campus and result context at the top, then compact search/filter controls, useful listing cards and the connected map. Keep price basis and availability readable. The selected card, room, map marker and preview must agree. On mobile, List/Map should feel like two views of the same search.
3. **Listing details:** prioritize photos, identity/location and the selected room's meaningful costs. Give room selection a stable place. Follow with the information needed to decide. Use a focused action area for saving/comparing and contacting/visiting; open a relevant form when that action is chosen. Preserve all unsent drafts, conflict handling and guards when switching or closing forms.
4. **Saved places and comparison:** distinguish quick favorites from named room shortlists using plain explanations. Present saved rooms with the same summaries as discovery. Make comparing a chosen set an obvious continuation, and provide contextual ways to return to the selected listing or arrange a viewing. Keep notes private and historical unavailable listings understandable.
5. **Conversations and viewings:** lead with the property, room, relevant person and next decision. Use readable statuses, grouped date/time information and consistent response controls. Keep previous/current proposed times clear. Show success states that explain where to continue; avoid displaying unrelated forms at once.
6. **Student home:** lead with decisions awaiting the student, upcoming agreed viewings and a clear way to resume housing exploration. Supporting counts should be compact rather than dominate the page. Use existing data; do not imply saved searches exist until that later feature is implemented.
7. **Landlord workspace:** use a consistent listing → readiness/review → availability → student response structure. Prioritize requests needing decisions and listings needing updates. Make editing, publication state and next action clear without losing guards or historical records.
8. **Administrator workspace:** prioritize the review/report queues and their next action. Use consistent inspection layouts and readable status/history. Keep sensitive/private access restrictions and separate account moderation from normal listing review.

### Implementation order and acceptance

- First establish the shared visual language and navigation, then redesign home/search → results/map → listing details as one complete student journey.
- Next connect saved places/comparison → conversations/viewings → student home using the same summaries and action hierarchy.
- Then apply the shared language to landlord and administrator workspaces, preserving their distinct operational tasks.
- Review representative desktop and mobile screens together before release so that individual page improvements do not create another disconnected style.
- Verify keyboard access, focus after opening/closing forms, readable contrast, 360/768/1440px layouts, mobile navigation, loading/empty/error states, room/price synchronization, search return context, authentication return paths and draft protection.
- Rehearse complete guest, student, landlord and administrator flows in Chromium and WebKit. Preserve the existing backend/privacy/revision protections, completed features, data and free providers. Release only tested changes; no unrelated new feature or dependency is required for this redesign.

## Retained functional priorities after the visual phase

1. **Accurate listings and availability:** clearer room differences, complete photos/costs, and dependable availability freshness.
2. **Full-budget matching:** total known monthly and move-in cost filters, with unknown charges stated clearly.
3. **Better campus recommendations:** clear selected-room reasons based on campus, distance, budget and requirements.
4. **A smoother decision process:** further connect saving, comparing, private questions and arranging viewings. The visual phase begins improving this experience using existing capabilities.
5. **Faster landlord responses:** clearer inquiry/viewing queues and practical availability updates.

Saved campus searches and a viewing calendar remain subsequent practical improvements. Email verification/password recovery remain deferred at the user's request. Privacy, data preservation and regression checks remain requirements throughout.

### First visual increment: shared navigation and the discovery journey

Implemented: a calmer shared visual foundation, grouped Saved places and Account menus, current-area indicators, keyboard/Escape/outside-click menu handling, one reusable campus/room/budget/preferences form on home and the campus finder, an original decorative room illustration, compact result cards, initially collapsed filters with visible applied chips, and progressive result explanations. Home keeps unrestricted room browsing until a room type is selected; a budget requires a clear per-person/per-room basis.

Listing details now use a stable room/cost decision area, with known monthly and move-in totals visible before expanding the detailed charge breakdown. Inquiry, shortlist and viewing forms open when selected. They remain mounted when collapsed, preserving private inquiry text, viewing drafts, retry identity and conflict guards. Historical inquiry/room selection behavior and card/map/comparison synchronization remain intact. On small screens the decision area follows the gallery; on desktop it stays beside the property information. Shared navigation and calmer count surfaces apply to all existing roles.

The next visual increments remain saved places/comparison, conversations/viewings and student home as a connected decision workspace, then the deeper landlord/admin screen layouts. The retained functional priorities above remain deferred during this visual work. No new backend endpoints, migration, dependency or provider configuration is required for this first increment. Detailed verification and release state are recorded in validation.md.

Release verified: frontend source 3db30dc is READY on the existing Vercel production alias; backend remains 5d48f44. All eighteen live Chromium/WebKit checks pass, alongside forty-six frontend tests, lint/build and passing evidence for twenty-six affected local browser scenarios across the main run and corrected rerun. The existing fifteen-campus directory, private records and provider plans are preserved. The first visual increment is complete; the remaining visual stages above are separate follow-ups.

### Second visual increment: content first and connected decisions

Following the user's further feedback, the second pass simplifies home to one campus-search entry with optional budget/preferences and actual approved, freshly available listing previews. It uses existing listing media and keeps fictional samples visibly labeled. Saved-campus previews keep the explicit 2 km scope and offer an honest empty state. Photo failures use a fallback without hiding the listing. Invalid preferences are opened and focused for correction.

Listing details now place the gallery beside the room decision panel, with photos → room decisions → supporting details on mobile. The repeated full-width cost banner is removed; the selected-room summary remains accessible on the decision panel, and all detailed charges and guards remain available. Shortlists use a list sidebar, compact room cards, private note previews/editors and explicit continuation links. The selected room survives a trip to create/manage a shortlist; returning does not automatically save or send anything.

Inquiry and viewing screens share property/room context, preserve historical snapshots and offer appropriate current-listing/owner-management links. Owner viewing proposals open only when needed; previous owner notes are retained in the editor. Student home prioritizes outstanding viewing decisions and replies, with activity counts underneath. These changes use existing APIs and access rules. Deeper landlord publishing/admin queue redesigns and the retained functional priorities remain planned. Local checks and release evidence are recorded in validation.md.

Release verified: frontend source 6c2da4e is READY in existing Vercel deployment dpl_H92dnpEHJbxQK7dSY4vADJFyaLDL at https://dormfinder-pink.vercel.app. All eighteen live Chromium/WebKit cases pass in one 2.9-minute run. Fifty frontend tests, lint/build, eighteen full affected local browser cases and ten final focused cases pass. The production entry matches index-V9l_CNZo.js; campus, real map tile and public-asset credential checks pass. Backend remains 5d48f44, with no schema, dependency or provider configuration changes.

### Map-centered discovery refinement — October 12, 2026

The user requested that the map feel like a main feature and stay on the right while browsing. The discovery page now places a viewport-sized map alongside the entire search/results column, with a persistent desktop header and map. The selected-room preview sits inside the map, has a close control with keyboard focus return, and retains room/card/price/comparison synchronization. Mobile keeps its List/Map switch. Search controls and active filters are more compact; explanation text follows results instead of pushing the map below the fold.

Map label grouping now accounts for overlapping label footprints rather than arbitrary grid boundaries. Zooming reveals separate listings; a selected group displays the chosen room's price and basis with the group count. Existing tile attribution, unavailable-map messaging, campus reference, area search and browsing continuity remain available. This refinement uses the existing frontend/API and free provider plans. Local and live evidence are recorded in validation.md; deeper comparison and landlord/admin redesigns remain separate planned work.

Released source 1dc03d4 is READY at the existing production alias in dpl_A1ca9LxXCVnmHZ87npvp3374sWn3. Fifty-three frontend tests, lint/build, sixteen affected local browser scenarios and all sixteen live scenarios have passing evidence. Two live page-loading cases required a test-only heading update and passed their focused rerun; the other fourteen passed the main run. No application failure remains in the scoped checks.

### Filter drawer refinement — October 12, 2026

The approved filters redesign replaces the inline expanding box with a left-side desktop drawer and a nearly full-screen mobile sheet. Opening it leaves the listings and map in place. Campus/location, budget, room preferences and amenities/availability have distinct sections; the heading, close control and Apply filters/Clear all footer remain visible while the contents scroll. Closing retains unapplied changes; Clear all inside the drawer edits the draft until Apply. Active filters remain visible with a count on the Filters button. Sort sits beside the result count, with rent sorting available after selecting a price basis.

The modal supports outside-click dismissal, Escape, keyboard focus containment and focus return, and prevents background scrolling. Campus suggestions consume Escape before the drawer closes. Refining the same campus/radius preserves the map viewport and intentional area bounds; changing the campus/radius resets the relevant map context. Room choices and List/Map mode remain available. This is a frontend-only refinement using the existing API and free providers. Verification and release evidence are recorded in validation.md.

Released source 163ad43 is READY in dpl_413BQYzMg1nU7HvuqbutsB5cp4yf at the existing production alias. Fifty-five frontend tests, lint/build and all eighteen scoped local and eighteen live browser scenarios have passing evidence across main runs and corrected test-only reruns. Real map tiles, readiness, public asset scanning and the production build marker pass. Remaining visual stages and retained functional priorities are unchanged.

### Scroll into your next dorm room — October 15, 2026

The user prioritized a scroll-animated landing page ahead of the remaining saved-places/comparison redesign. The approved direction is an original stylized 3D, cozy single-student room with warm cream, wood and orange colors; a visible Find housing shortcut; and a simplified mobile entrance. The door opens during the first quarter of the scroll, the camera aligns with and enters the doorway during the middle half, and the furnished room reveals the closing message during the final quarter. Upward scrolling reverses the scene. Desktop uses three viewport heights and mobile two, without scroll interception or audio.

Implemented with pinned Three.js 0.186.1, loaded only from the homepage when motion is enabled. The room uses original geometry, batched materials, soft lighting and inexpensive contact shadows. A matching original SVG appears before loading and on graphics failures. Reduced motion removes the extended sequence and does not download the engine; preference changes are handled. Rendering occurs only when scene progress or size changes, stops while offscreen/hidden, and releases resources on unmount. Device-pixel ratio is capped at 1.5 desktop/1 mobile, with adaptive resolution for slower graphics devices. No external models, embeds or paid resources are needed.

The existing campus form, preferences, featured listings and landlord path follow the room. Find housing skips directly to search with focus return to the campus field when available. The scene is marked as imagined artwork and makes no rental availability or verification claims. API, database and authentication behavior are unchanged. Local evidence and release status are in validation.md. Saved places/comparison, landlord/admin visual work and the retained functional priorities remain pending.

### White, navy and cobalt visual refresh — October 15, 2026

The user approved replacing the earlier beige/brown palette with white, navy and cobalt. The global palette now uses shared semantic colors across the existing routes, controls, drawers, maps and workspaces. Inter is self-hosted with its OFL license and used for body text, controls and headings; decorative serif/italic headings are removed. Navigation spans the viewport with the brand left and links right, using responsive side padding and the existing mobile menu. The Explore/Compare/Visit numbered strip is removed.

Homepage features now prioritize large covers and listing titles, with prices, availability counts, room descriptions and explanatory footer text removed from those cards. Exact selected-room links and fresh-availability/campus selection rules remain. Demo identification stays visible. The user separately approved original, photo-like demo covers: three generated interiors are mapped only to the named fictional demo samples and labeled AI demo illustration. Uploaded photos for ordinary listings and existing detail galleries are preserved. Prompts, provenance, license and asset paths are recorded in design-assets.md.

The animated room and its static poster share the new palette, while natural wood gives the scene some warmth and depth. Existing search, saved context, drafts and access rules remain in place. This is a frontend-only increment; no backend deployment, migration, provider environment change or paid resource is required. Saved places/comparison and deeper landlord/admin visual layouts remain planned. Validation and release evidence are in validation.md.

Released source 93021f3 is READY in dpl_936fS3U5iUKgnVUzukNyNAePGMoR at the existing production alias. Fifty-eight frontend tests, lint/build and all twenty-four scoped live Chromium/WebKit scenarios pass, with the live cases in one clean 1.8-minute run. Font and cover loading, exact build/engine markers, readiness and public asset/map checks pass. Production data, free providers and the user's certificate remain intact.

### Campus-first controls and minimal listing facts — October 15, 2026

The user requested a visible campus search on results, with all remaining refinements in the existing drawer; minimal price and room-capacity information on featured cards; removal of the text under Sort and the recommendations explanation block; and one Sign in entry instead of separate Sign in/Get started links. The user selected the single Sign in option; registration stays accessible from the existing Create an account link on that page. Role-specific landlord entry and authenticated navigation remain available.

Results now have a visible campus autocomplete and Search campus action above the listings, beside Filters on desktop and adapted to mobile. Changing campus preserves budget, price basis, amenities and other requirements while clearing page/old map bounds. Newly selected campuses get a 2 km radius if no distance is already specified; explicit sorting and distance choices are preserved. Clearing the campus removes its radius and campus-only sorting. Unselected queries show an error and retain typed text. The drawer contains location/radius, budget, room and amenity controls; its Clear filters action clears refinements while retaining the visible campus. Campus is excluded from the advanced-filter count and chips.

Featured cards retain the large covers and titles, plus one quiet line showing exact base rent, per-person/per-room monthly basis, and the selected option's room capacity. Capacity is not inferred from pictures, vacancy counts or total property inventory. Whole-peso prices omit .00; fractional amounts retain their precision. The two requested explanation blocks are removed; price-basis validation and detailed listing costs remain. This frontend-only refinement preserves existing data/providers. Validation and release evidence are in validation.md.

Follow-up completed in the student-space redesign below: administrator setup details were removed from public account pages.

Released source 4620368 is READY in dpl_ERxMRJUXEaGbDjWqFeDJctXvpq6g at the existing production alias. Sixty-one frontend tests, lint/build and all twenty scoped live Chromium/WebKit scenarios pass, with the live cases in one clean 1.8-minute run. Exact build/engine markers, font/demo-cover loading, readiness, public asset scanning and real map tiles pass. Backend, existing data, free providers and the user's certificate are preserved.

### A usable student space and personal settings — October 15, 2026

Replace the student dashboard's generic next-step cards, full-name greeting and statistics strip with a direct campus search, actual saved-place previews, recent conversations and future proposed/agreed viewings. Use exact room links, price bases and capacities, retain explicit demo imagery labeling and show stale/sold-out/unavailable saved inventory honestly. Hide empty activity sections, keep failed collections independently recoverable and put activity before saved places on mobile. Previews use the existing first API page, with full-list links; viewing previews explicitly identify additional pages rather than claiming a complete next-visit schedule.

Personal settings now separate name/email, saved campus and collapsed password controls. Selecting and saving campus drives the next student search; invalid unselected text cannot clear a preference accidentally. Existing independent unsaved-change/password guards, errors and session revocation are retained. The student page and profile are separately loaded and do not load on the public homepage. Guest navigation has Browse and one Sign in entry; registration still offers student/owner roles through Create an account. The redundant For landlords navbar entry and public administrator setup note are removed. Reports/notifications remain in Account. Landlord/admin operational dashboards retain their existing counts.

Local frontend gates and scoped browser journeys pass as recorded in validation.md. This frontend-only change uses existing authenticated/public APIs and preserves data, backend authorization, free services and the user's certificate. Deeper comparison and landlord/admin layout work remains planned. Released source b51af8d is READY in dpl_GTWSyUZJD7RjkjrJpCtwfRCRYPUW at the existing production alias. Sixty-six frontend tests, lint/build, forty scoped local browser cases across recorded runs and forty deployed Chromium/WebKit cases in one clean 2.6-minute run pass. Independent real-account/private API, public-asset credential, readiness and map checks pass. See validation.md and deployment.md for evidence and recovery references.

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

Production status: frontend source b51af8d is live on the existing free Vercel project, and backend source 5d48f44 remains live on the existing free Render service. Fifteen sourced campuses, private inquiries/shortlists/viewings, moderation, map continuity, form protection and the connected discovery/decision journey remain available. The preceding backed-up migration preserved application records and restricted grants; these frontend-only visual releases required no database changes. Secrets and the user certificate were excluded. See validation.md for acceptance evidence and deployment.md for current recovery references.

## Order, timebox and release criteria

Work in parts 1 through 5, with overlapping verification as necessary. The proposed target is implementation on October 11-12, feature cutoff October 12, hardening October 13, freeze at 20:00 Singapore time October 13, and final smoke checks October 14. Adjust dates to evidence rather than skipping release gates.

If time becomes constrained, defer dashboard polish, advanced photo controls and pin-picker polish before weakening core search correctness, privacy or release checks. A release must retain existing workflows and have truthful costs, campus context, availability and failure states.

## Later roadmap

- Verify and expand campuses, branches and geographic coverage.
- Improve saved searches, alerts and recommendations using real usage evidence.
- Email verification and account recovery are deferred in favor of practical features at the user's request; assess notification workflows separately.
- Viewing appointments and landlord response tools are deployed and verified in the practical-feature batch below.
- Plan applications, reservations, cancellation rules and document privacy separately.
- Plan payments, refunds, disputes and trustworthy reviews separately, with explicit operational requirements.
- Improve search quality, accessibility, performance and dashboards through user testing.

These are future planning items, not completed functionality or permission to incur costs.

## October 12 follow-up: approved steps 1–4

- Recovery: all 96 private S3 objects (2,018,327 bytes) were backed up and restored to isolated local storage and a fresh private S3 prefix. Every checksum matched; the 96 temporary cloud copies were removed, and the original bucket inventory stayed unchanged. All 96 ready S3 photo references in the isolated database restore resolve to decoded, checksum-verified local image bytes. Live Render rollback is pending at the user's explicit request.
- Form protection: photo file/caption edits, account moderation and listing lifecycle notes now use the shared navigation guard. Report filter/page changes go through guarded URLs. Successful saves clear their own form; failures preserve edits. Submission and actions that would close another dirty form require those edits to be saved or cleared first. Photo retries preserve the upload identity. Availability edits survive unrelated revision refreshes; in-flight editable fields are disabled.
- Campus expansion: five sourced additions bring the directory to 15: CEU Manila/Mendiola, Makati/Gil Puyat, Makati/Legazpi Village, Malolos, and TIP Quezon City/Aurora. CEU's distinct addresses are verified against its [official directory](https://admission2.ceu.edu.ph/static/contact-us.html); TIP QC against the [official institutional flyer](https://dru.tip.edu.ph/assets/generic-pages/downloadables/TIP-Institutional-Flyer-August-2022.pdf). Coordinate sources and dated approximation notes are stored in campus-directory.json. This does not cover every university or every CEU-related institution.
- Student usability: mobile filter collapse preserves entered values; comparison title links preserve the selected campus and room. Listing details show selected-room costs and availability near the top, with a shortcut to full room terms and the inquiry area. Private question drafts remain scoped to the account/property/room in the current tab, and editing is disabled while sending. Actual guest walkthroughs check keyboard campus selection, budgets, comparison, room context, empty-campus results and 360/768/1440px layouts.

Final release tagging and email recovery planning remain subsequent steps. The historical GitHub billing-lock exception remains separate from local/browser acceptance.

## October 12 practical-feature batch: released and verified

The agreed batch adds a guided campus/budget/room/amenity search, selected-room match explanations, comparable-cost highlights, private named shortlists with room choices and notes, student viewing requests with landlord counterproposals and student confirmation, and useful role dashboard counts. Viewing requests use Philippine time, participant-only access, revision checks, retry identity and overlapping-appointment protection. Notifications stay in the existing application.

The interruption follow-up preserves this completed work. A room chosen on the listing card or map preview now drives the card selection, map price marker, preview charges and comparison selection. Inquiry and viewing forms use distinct React key namespaces; the room editor also has separate edit/new keys. The existing full role workflow checks console errors without suppressing duplicate-key warnings.

Final local evidence: 104 backend tests / 918 assertions, Pint, 44 frontend tests, ESLint and the Vercel production build pass. Six focused Chromium/WebKit scenarios pass for the complete role workflow, practical-feature flow and room synchronization. The strengthened room-sync check additionally verifies displayed base rent and known monthly charges across preview and comparison; both browsers pass. See validation.md for run details.

The additive practical-feature migration was applied in production after a fresh verified backup, with thirteen existing application-table fingerprints preserved and restricted permissions checked. That release deployed application source 5d48f44 to both existing free providers; the subsequent visual release updates the frontend as recorded above. Six live Chromium/WebKit scenarios passed for campus search, shortlists, viewing negotiation, room/price synchronization and all three role dashboards. Public asset credential scanning, fifteen-campus reads and real map tiles passed. Existing data and the user-provided certificate are preserved. Live Render rollback stays deferred; the historical GitHub CI exception remains unverified. See validation.md and deployment.md for current evidence and recovery references.
