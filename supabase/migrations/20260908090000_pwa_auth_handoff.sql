create table if not exists public.later_space_pwa_handoffs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code_hash text not null unique check (length(code_hash) = 64),
  auth_token_hash text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz
);

create index if not exists later_space_pwa_handoffs_user_idx
  on public.later_space_pwa_handoffs (user_id, created_at desc);

alter table public.later_space_pwa_handoffs enable row level security;
revoke all on public.later_space_pwa_handoffs from public, anon, authenticated;

create or replace function public.consume_later_space_pwa_handoff(p_code_hash text)
returns table(auth_token_hash text)
language sql
security definer
set search_path = public
as $$
  update public.later_space_pwa_handoffs as handoff
  set consumed_at = now()
  where handoff.code_hash = p_code_hash
    and handoff.consumed_at is null
    and handoff.expires_at > now()
  returning handoff.auth_token_hash;
$$;

revoke all on function public.consume_later_space_pwa_handoff(text) from public, anon, authenticated;
grant execute on function public.consume_later_space_pwa_handoff(text) to service_role;
