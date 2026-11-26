-- Atomic draw creation and abuse controls for MphatsoDraw.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.request_limits (
  bucket_key text primary key,
  window_started_at timestamptz not null,
  request_count integer not null default 0
);
revoke all on private.request_limits from public, anon, authenticated, service_role;

create or replace function private.consume_draw_rate_limit(p_key text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare v_count integer;
begin
  insert into private.request_limits(bucket_key,window_started_at,request_count)
  values (p_key,now(),1)
  on conflict (bucket_key) do update
    set window_started_at = case
      when private.request_limits.window_started_at < now() - interval '15 minutes' then now()
      else private.request_limits.window_started_at end,
        request_count = case
      when private.request_limits.window_started_at < now() - interval '15 minutes' then 1
      else private.request_limits.request_count + 1 end
  returning request_count into v_count;
  return v_count <= 5;
end;
$$;

create or replace function public.consume_draw_rate_limit(p_key text)
returns boolean
language sql
security definer
set search_path = ''
as $$ select private.consume_draw_rate_limit(p_key); $$;
revoke all on function private.consume_draw_rate_limit(text) from public,anon,authenticated;
revoke all on function public.consume_draw_rate_limit(text) from public,anon,authenticated;
grant usage on schema private to service_role;
grant execute on function private.consume_draw_rate_limit(text) to service_role;
grant execute on function public.consume_draw_rate_limit(text) to service_role;

create or replace function public.create_private_draw(
  p_event jsonb, p_names jsonb, p_token_hashes jsonb, p_assignment jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_draw_id uuid;
  v_ids uuid[] := array[]::uuid[];
  v_id uuid;
  v_name text;
  v_hash text;
  v_i integer;
  v_n integer;
  v_recipient integer;
begin
  v_n := jsonb_array_length(p_names);
  if v_n < 3 or v_n > 120
     or jsonb_array_length(p_token_hashes) <> v_n
     or jsonb_array_length(p_assignment) <> v_n then
    raise exception 'Invalid draw payload';
  end if;
  insert into public.draws(title,budget,currency,draw_date,message)
  values (
    coalesce(nullif(left(p_event->>'title',120),''),'Secret Santa'),
    nullif(p_event->>'budget','')::numeric,
    coalesce(nullif(left(p_event->>'currency',3),''),'MWK'),
    nullif(p_event->>'draw_date','')::date,
    left(coalesce(p_event->>'message',''),1000)
  ) returning id into v_draw_id;
  for v_i in 0..v_n-1 loop
    v_name := btrim(p_names->>v_i);
    v_hash := p_token_hashes->>v_i;
    if v_name = '' or v_hash !~ '^[a-f0-9]{64}$' then
      raise exception 'Invalid participant data';
    end if;
    insert into public.draw_participants(draw_id,display_name,reveal_token_hash)
    values (v_draw_id,v_name,v_hash)
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
$$;
revoke all on function public.create_private_draw(jsonb,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.create_private_draw(jsonb,jsonb,jsonb,jsonb) to service_role;
