-- Separate draw creation and reveal limits so a large group can reveal from one shared network.
drop function if exists public.consume_draw_rate_limit(text);
drop function if exists private.consume_draw_rate_limit(text);

create or replace function private.consume_draw_rate_limit(p_key text, p_limit integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare v_count integer;
begin
  if p_limit < 1 or p_limit > 200 then
    raise exception 'Invalid rate limit';
  end if;
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
  return v_count <= p_limit;
end;
$$;

create or replace function public.consume_draw_rate_limit(p_key text, p_limit integer)
returns boolean
language sql
security definer
set search_path = ''
as $$ select private.consume_draw_rate_limit(p_key, p_limit); $$;

revoke all on function private.consume_draw_rate_limit(text, integer) from public, anon, authenticated;
revoke all on function public.consume_draw_rate_limit(text, integer) from public, anon, authenticated;
grant execute on function private.consume_draw_rate_limit(text, integer) to service_role;
grant execute on function public.consume_draw_rate_limit(text, integer) to service_role;
