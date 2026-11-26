# MphatsoDraw — Phase 1 and Phase 2 QA checklist

## Verified in this development cycle

- [x] Supabase production schema and Edge Function deployment inspected.
- [x] `create-draw` date regex corrected and deployed as version 6.
- [x] `private.request_limits` RLS enabled and migration recorded.
- [x] Anonymous/authenticated roles confirmed unable to read private rate-limit data.
- [x] Rate-limit database function smoke-tested with RLS enabled.
- [x] Three-participant atomic database draw creation tested inside a transaction and rolled back.
- [x] Confirmed no QA draw or participant rows remain after rollback.
- [x] Duplicate-recipient database constraint tested.
- [x] Assignment solver compared against brute-force matching for every undirected exclusion graph with 3, 4 and 5 participants (8 + 64 + 1,024 graphs; zero mismatches).
- [x] Additional randomized assignment checks at 3, 4, 5, 10, 50 and 120 participants.
- [x] Exclusion remapping verified when participant order changes.
- [x] Production frontend responds HTTP 200 and includes the latest validation, exclusion, retry and accessibility changes.
- [x] Latest Vercel production deployment confirmed READY.
- [x] No Vercel runtime error clusters found in the last 24 hours.

## Still required — live HTTP/browser acceptance

- [ ] POST a valid 3-person draw to the deployed `create-draw` function.
- [ ] Open all three returned reveal URLs and confirm each recipient is correct and unique.
- [ ] Confirm a reveal token cannot reveal a different participant.
- [ ] POST malformed and unknown tokens; confirm safe 400/404 responses.
- [ ] Test an impossible exclusion set through the deployed function.
- [ ] Test a valid couple-exclusion draw through the deployed function.
- [ ] Test real calendar date validation through the deployed function.
- [ ] Test rate-limit responses through real requests.
- [ ] Test WhatsApp sharing on a phone and desktop.
- [ ] Review visual layout at mobile, tablet and desktop widths using screenshots.
- [ ] Verify keyboard navigation and screen-reader labels in a browser.

## Manual production test safety

Use test-only participant names and a clearly identifiable event title. Do not use real participant details in QA. Remove test records after verification using an owner-controlled cleanup operation; do not expose service-role credentials in a browser or in this repository.

## Known limitation

Database-level tests and static production checks do not replace live HTTP/browser testing. The application should not be marked fully launch-ready until the outstanding acceptance checks pass.
