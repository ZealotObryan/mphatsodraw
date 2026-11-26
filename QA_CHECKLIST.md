# MphatsoDraw — Production QA checklist

## Phase 1 — Functional foundation

- [x] Supabase production schema and Edge Function deployment inspected.
- [x] `create-draw` date regex corrected and deployed.
- [x] `private.request_limits` RLS enabled and migration recorded.
- [x] Anonymous/authenticated roles confirmed unable to read private rate-limit data.
- [x] Rate-limit database function smoke-tested with RLS enabled.
- [x] Three-participant atomic database draw creation tested inside a transaction and rolled back.
- [x] Confirmed no QA draw or participant rows remain after rollback.
- [x] Duplicate-recipient database constraint tested.
- [x] Assignment solver compared against brute-force matching for every undirected exclusion graph with 3, 4 and 5 participants (8 + 64 + 1,024 graphs; zero mismatches).
- [x] Additional randomized assignment checks at 3, 4, 5, 10, 50 and 120 participants.
- [x] Exclusion remapping verified when participant order changes.
- [ ] Live HTTP/browser acceptance testing remains outstanding.

## Phase 2 — User experience

- [x] Production frontend responds HTTP 200 and includes validation, exclusion, retry and accessibility changes.
- [x] Latest Vercel production deployment confirmed READY.
- [x] Small-screen styling, focus treatments and accessible labels added.
- [ ] Manual desktop, tablet and mobile review remains outstanding.
- [ ] WhatsApp sharing on an actual phone remains outstanding.
- [ ] Keyboard and screen-reader review remains outstanding.

## Phase 3 — Production hardening

- [x] Added `draws.expires_at` and retention calculation to atomic draw creation.
- [x] Draw retention is 180 days from creation, or 90 days after the scheduled event if later.
- [x] Reveal Edge Function rejects expired draws independently of the cleanup schedule.
- [x] Installed `pg_cron` and scheduled daily cleanup at 02:17 UTC.
- [x] Cleanup removes expired draws (and cascaded participants), rate-limit buckets older than 24 hours, and cron history older than 30 days.
- [x] Cleanup function is private, uses an empty search path and is executable only by `postgres`.
- [x] Hardened default privileges for future public-schema objects created by `postgres`.
- [x] Removed redundant participant indexes and added expiry/rate-limit cleanup indexes.
- [x] Deployed structured, privacy-safe Edge Function logs and `X-Request-ID` headers.
- [x] Database smoke test exercised the updated draw-creation and cleanup functions inside a transaction and rolled back.
- [ ] Verify the first scheduled cleanup run and its result after the next scheduled time.
- [ ] Re-run Supabase security/performance advisors after production changes.
- [ ] Verify retention behaviour through a live HTTP/browser test.

## Outstanding live HTTP/browser acceptance

- [ ] POST a valid 3-person draw to the deployed `create-draw` function.
- [ ] Open all three returned reveal URLs and confirm each recipient is correct and unique.
- [ ] Confirm a reveal token cannot reveal a different participant.
- [ ] POST malformed and unknown tokens; confirm safe 400/404 responses.
- [ ] Test an impossible exclusion set through the deployed function.
- [ ] Test a valid couple-exclusion draw through the deployed function.
- [ ] Test real calendar date validation through the deployed function.
- [ ] Test rate-limit responses through real requests.
- [ ] Test expired reveal behaviour with an owner-controlled QA fixture.
- [ ] Test WhatsApp sharing on a phone and desktop.
- [ ] Review visual layout at mobile, tablet and desktop widths using screenshots.
- [ ] Verify keyboard navigation and screen-reader labels in a browser.

## Manual production test safety

Use test-only participant names and a clearly identifiable event title. Do not use real participant details in QA. Remove test records after verification using an owner-controlled cleanup operation; do not expose service-role credentials in a browser or in this repository.

## Launch gate

Database-level tests and static production checks do not replace live HTTP/browser testing. Do not mark the application fully launch-ready until the outstanding acceptance checks pass.
