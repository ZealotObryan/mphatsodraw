# MphatsoDraw Security Notes

## Current architecture

MphatsoDraw uses a public static frontend and two Supabase Edge Functions:
- `create-draw`: validates a draw request, creates a valid one-to-one assignment and returns one unique reveal URL per participant.
- `reveal`: validates one 256-bit random reveal token and returns only that participant's recipient.

The functions run with `verify_jwt = false` because the application has no account system. The reveal token is the participant's bearer secret. This is not a substitute for protecting and privately distributing the link.

## Token and assignment protection

- Reveal tokens are generated using `crypto.getRandomValues` (32 random bytes).
- Only SHA-256 token hashes are stored in `public.draw_participants`.
- The reveal endpoint looks up one participant by the token hash and fetches only that participant's recipient.
- There is no public endpoint that returns the full assignment mapping.
- A composite foreign key keeps recipient references within the same draw.
- A unique constraint on `(draw_id, recipient_id)` prevents duplicate recipients.
- Draw creation is performed by a single database function/transaction so a failed operation does not leave a partial draw.

**Trust limitation:** project/database owners and anyone with the Supabase service-role credentials can access the underlying assignment data. The design protects participants from one another at the application/API level; it does not provide cryptographic blindness from infrastructure owners.

## Database access controls

- `public.draws` and `public.draw_participants` have RLS enabled.
- Anonymous and authenticated direct table access is revoked. There are intentionally no public RLS policies because all application data access is mediated by the Edge Functions using server-side credentials.
- `private.request_limits` has RLS enabled and is in the non-exposed `private` schema. Anonymous and authenticated roles have no schema usage or table privileges.
- The private rate-limit function is `SECURITY DEFINER`, owned by `postgres`, uses a fixed/empty search path, and is the only intended path to the private rate-limit rows.

The Supabase security advisor reports informational `rls_enabled_no_policy` findings for these three tables. This is intentional for the current server-only access model; adding permissive policies would weaken it.

## Abuse protection

- Draw creation: 5 requests per source IP per 15-minute window.
- Reveal: 150 requests per source IP per 15-minute window to accommodate groups sharing a network.
- Input validation covers participant count (3–120), unique names, name length, exclusions, budget and real calendar dates.
- CORS is restricted to the production app and local development origins. CORS is a browser control, not an authentication boundary.

## Secrets and deployment

Required Supabase Edge Function secrets:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` — server-side only; never put this in browser code.
- `PUBLIC_APP_URL` — optional; defaults to `https://mphatsodraw-git.vercel.app`.

The frontend contains only the Supabase publishable key. The project currently uses the free tier; service limits and future pricing can change.

## Known limitations before public launch

- No organiser accounts or authenticated organiser dashboard.
- No organiser-controlled draw cancellation, link revocation or token regeneration.
- No automated retention/cleanup policy for old draws.
- Reveal links remain bearer secrets; anyone who receives a participant's link can reveal that participant's recipient.
- Full live browser/API end-to-end acceptance testing is still outstanding.
