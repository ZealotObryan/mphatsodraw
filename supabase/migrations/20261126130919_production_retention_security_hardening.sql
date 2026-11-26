create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

alter table public.draws
  add column expires_at timestamptz;

update public.draws
set expires_at = greatest(
  created_at + interval '180 days',
  coalesce(((draw_date + 91)::timestamp at time zone 'UTC'), created_at + interval '180 days')
);

alter table public.draws
  alter column expires_at set default (now() + interval '180 days'),
  alter column expires_at set not null;

create index draws_expires_at_idx on public.draws(expires_at);
create index request_limits_window_started_at_idx on private.request_limits(window_started_at);

drop index if exists public.draw_participants_draw_id_idx;
drop index if exists public.draw_participants_token_hash_idx;

alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;

create or replace function public.create_private_draw(
  p_event jsonb,
  p_names jsonb,
  p_token_hashes jsonb,
  p_assignment jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_draw_id uuid;
  v_ids uuid[] := array[]::uuid[];
  v_id uuid;
  v_name text;
  v_hash text;
  v_i integer;
  v_n integer;
  v_recipient integer;
  v_expires_at timestamptz;
begin
  if jsonb_typeof(p_names) <> 'array'
     or jsonb_typeof(p_token_hashes) <> 'array'
     or jsonb_typeof(p_assignment) <> 'array' then
    raise exception 'Invalid draw payload';
  end if;

  v_n := jsonb_array_length(p_names);
  if v_n < 3 or v_n > 120
     or jsonb_array_length(p_token_hashes) <> v_n
     or jsonb_array_length(p_assignment) <> v_n then
    raise exception 'Invalid draw payload';
  end if;

  v_expires_at := greatest(
    now() + interval '180 days',
    coalesce(
      (((nullif(p_event->>'draw_date',''))::date + 91)::timestamp at time zone 'UTC'),
      now() + interval '180 days'
    )
  );

  insert into public.draws(title,budget,currency,draw_date,message,expires_at)
  values (
    coalesce(nullif(left(p_event->>'title',120),''),'Secret Santa'),
    nullif(p_event->>'budget','')::numeric,
    coalesce(nullif(left(p_event->>'currency',3),''),'MWK'),
    nullif(p_event->>'draw_date','')::date,
    left(coalesce(p_event->>'message',''),1000),
    v_expires_at
  )
  returning id into v_draw_id;

  for v_i in 0..v_n-1 loop
    v_name := btrim(p_names->>v_i);
    v_hash := p_token_hashes->>v_i;
    if v_name = '' or v_hash !~ '^[a-f0-9]{64}$' then
      raise exception 'Invalid participant data';
    end if;
    insert into public.draw_participants(draw_id,display_name,reveal_token_hash)
    values(v_draw_id,v_name,v_hash)
    returning id into v_id;
    v_ids := array_append(v_ids,v_id);
  end loop;

  for v_i in 0..v_n-1 loop
    if (p_assignment->>v_i) !~ '^[0-9]+$' then
      raise exception 'Invalid assignment';
    end if;
    v_recipient := (p_assignment->>v_i)::integer;
    if v_recipient < 0 or v_recipient >= v_n or v_recipient = v_i then
      raise exception 'Invalid assignment';
    end if;
    update public.draw_participants
    set recipient_id = v_ids[v_recipient+1]
    where id = v_ids[v_i+1];
  end loop;

  return jsonb_build_object('draw_id',v_draw_id,'participant_ids',to_jsonb(v_ids));
end;
$function$;

create or replace function private.cleanup_expired_data()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_draws_deleted bigint := 0;
  v_rate_limits_deleted bigint := 0;
  v_cron_history_deleted bigint := 0;
begin
  delete from public.draws where expires_at <= now();
  get diagnostics v_draws_deleted = row_count;

  delete from private.request_limits
  where window_started_at < now() - interval '24 hours';
  get diagnostics v_rate_limits_deleted = row_count;

  delete from cron.job_run_details
  where end_time < now() - interval '30 days';
  get diagnostics v_cron_history_deleted = row_count;

  return jsonb_build_object(
    'draws_deleted',v_draws_deleted,
    'rate_limit_buckets_deleted',v_rate_limits_deleted,
    'cron_history_rows_deleted',v_cron_history_deleted
  );
end;
$function$;

revoke all on function private.cleanup_expired_data() from public, anon, authenticated, service_role;
grant execute on function private.cleanup_expired_data() to postgres;

select cron.schedule(
  'mphatsodraw-expired-data-cleanup',
  '17 2 * * *',
  'select private.cleanup_expired_data();'
);
