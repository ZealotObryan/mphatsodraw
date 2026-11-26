-- MphatsoDraw private draw storage
create extension if not exists pgcrypto;

create table if not exists public.draws (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  budget numeric,
  currency text not null default 'MWK',
  draw_date date,
  message text,
  created_at timestamptz not null default now()
);

create table if not exists public.draw_participants (
  id uuid primary key default gen_random_uuid(),
  draw_id uuid not null references public.draws(id) on delete cascade,
  display_name text not null,
  recipient_id uuid references public.draw_participants(id) deferrable initially deferred,
  reveal_token_hash text not null unique,
  revealed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists draw_participants_draw_id_idx on public.draw_participants(draw_id);
create index if not exists draw_participants_token_hash_idx on public.draw_participants(reveal_token_hash);

alter table public.draws enable row level security;
alter table public.draw_participants enable row level security;

-- Intentionally no anon/authenticated policies and no direct grants.
revoke all on public.draws from anon, authenticated;
revoke all on public.draw_participants from anon, authenticated;
