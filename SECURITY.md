# MphatsoDraw

Secret Santa generator with a Malawi touch. 🎁🇲🇼

## Secure backend (in progress)

The backend uses Supabase Edge Functions and opaque 256-bit reveal tokens. Only token hashes are stored. The public reveal endpoint returns a single participant's assignment; there is no endpoint that returns the complete mapping. Database tables have RLS enabled and direct anonymous/authenticated access revoked.

**Trust limitation:** project/database owners can still access backend data. This is organizer-resistant at the application/API level, not cryptographic blindness from infrastructure owners. Participants must keep their reveal links private.

### SQL
Apply `supabase/migrations/202611260001_mphatsodraw_schema.sql` to the new Supabase project.

### Functions
Deploy `create-draw` and `reveal` from `supabase/functions/`. Set secrets:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only, never expose in frontend)
- `PUBLIC_APP_URL` (production app URL)

The endpoints are unauthenticated; add rate limiting / abuse protection before broad public use. This starter has no admin assignment retrieval endpoint.
