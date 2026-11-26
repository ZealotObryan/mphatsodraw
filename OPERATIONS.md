# MphatsoDraw Operations Guide

## Production services

- Frontend: https://mphatsodraw-git.vercel.app
- Backend: Supabase Edge Functions `create-draw` and `reveal`.
- Database project: `oxoateqbfaebveavmcmf` (EU West).
- Scheduled maintenance: Supabase Cron (`pg_cron`).

## Daily data lifecycle

The scheduled job `mphatsodraw-expired-data-cleanup` runs daily at 02:17 UTC (04:17 CAT).

It calls `private.cleanup_expired_data()`, which:
1. Deletes draws whose `expires_at` is due; participant rows are deleted through the draw foreign-key cascade.
2. Deletes rate-limit buckets whose window has been inactive for more than 24 hours.
3. Deletes cron execution history older than 30 days.

A draw is retained for at least 180 days after creation, or until 90 days after its scheduled event date if that is later. Reveal requests check the expiry timestamp directly, so an expired link is rejected even if the scheduled cleanup has not yet run.

### Verify the schedule

Run in the Supabase SQL editor as a database owner:

```sql
select jobid, jobname, schedule, active
from cron.job
where jobname = 'mphatsodraw-expired-data-cleanup';
```

### Inspect recent job runs

```sql
select jobid, status, start_time, end_time, return_message
from cron.job_run_details
where jobid = (
  select jobid from cron.job
  where jobname = 'mphatsodraw-expired-data-cleanup'
)
order by start_time desc
limit 10;
```

### Run cleanup manually

Only run this as a database owner when intentionally checking maintenance:

```sql
select private.cleanup_expired_data();
```

The function is deliberately not executable by anonymous, authenticated or service-role clients.

## Edge Function monitoring

Both Edge Functions emit JSON log events:
- `draw_created`
- `reveal_succeeded`
- `rate_limit_rejected`
- `draw_creation_failed`
- `reveal_failed`

Responses include an `X-Request-ID` header. When investigating a user-reported failure, ask for the request ID and approximate time, then filter the Supabase Edge Function logs by that ID.

Logs deliberately exclude participant names, reveal tokens, assignments, request bodies and IP addresses. Never add those values to logs.

## Security review reminders

- Never expose `SUPABASE_SERVICE_ROLE_KEY` in frontend code, browser storage, screenshots or this repository.
- Do not create public RLS policies on the draw tables; application access is server-mediated.
- Keep the `private` schema inaccessible to browser roles.
- CORS is not authentication. Continue to enforce validation and rate limits in the Edge Functions.
- Treat reveal URLs as private bearer secrets.

## Current launch gate

The database schema, retention schedule and Edge Function deployment have been hardened, but manual live HTTP/browser acceptance testing is still required before describing the app as fully launch-ready.
