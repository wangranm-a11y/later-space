create extension if not exists pgcrypto;

create table if not exists public.later_space_items (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('image', 'video', 'link', 'text')),
  data jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object'),
  asset_path text,
  source_device_id text,
  client_updated_at bigint not null,
  server_updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  revision bigint not null default 1
);

alter table public.later_space_items
  add column if not exists created_at timestamptz not null default now();

create index if not exists later_space_items_user_sync_idx
  on public.later_space_items (user_id, server_updated_at);

create index if not exists later_space_items_user_active_idx
  on public.later_space_items (user_id, created_at)
  where deleted_at is null;

create table if not exists public.later_space_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object'),
  client_updated_at bigint not null,
  server_updated_at timestamptz not null default now(),
  revision bigint not null default 1
);

create or replace function public.touch_later_space_row()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    if new.client_updated_at < old.client_updated_at then
      return old;
    end if;
    if tg_table_name = 'later_space_items'
      and new.client_updated_at = old.client_updated_at
      and old.deleted_at is not null
      and new.deleted_at is null then
      return old;
    end if;
    new.revision = old.revision + 1;
  end if;
  new.server_updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_later_space_items on public.later_space_items;
create trigger touch_later_space_items
before update on public.later_space_items
for each row execute function public.touch_later_space_row();

drop trigger if exists touch_later_space_settings on public.later_space_settings;
create trigger touch_later_space_settings
before update on public.later_space_settings
for each row execute function public.touch_later_space_row();

alter table public.later_space_items enable row level security;
alter table public.later_space_settings enable row level security;

drop policy if exists "Users read own Later Space items" on public.later_space_items;
create policy "Users read own Later Space items"
on public.later_space_items for select
using (auth.uid() = user_id);

drop policy if exists "Users insert own Later Space items" on public.later_space_items;
create policy "Users insert own Later Space items"
on public.later_space_items for insert
with check (auth.uid() = user_id);

drop policy if exists "Users update own Later Space items" on public.later_space_items;
create policy "Users update own Later Space items"
on public.later_space_items for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users delete own Later Space items" on public.later_space_items;
create policy "Users delete own Later Space items"
on public.later_space_items for delete
using (auth.uid() = user_id);

drop policy if exists "Users read own Later Space settings" on public.later_space_settings;
create policy "Users read own Later Space settings"
on public.later_space_settings for select
using (auth.uid() = user_id);

drop policy if exists "Users insert own Later Space settings" on public.later_space_settings;
create policy "Users insert own Later Space settings"
on public.later_space_settings for insert
with check (auth.uid() = user_id);

drop policy if exists "Users update own Later Space settings" on public.later_space_settings;
create policy "Users update own Later Space settings"
on public.later_space_settings for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public, file_size_limit)
values ('later-space-media', 'later-space-media', false, 262144000)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

drop policy if exists "Users read own Later Space media" on storage.objects;
create policy "Users read own Later Space media"
on storage.objects for select
using (bucket_id = 'later-space-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users upload own Later Space media" on storage.objects;
create policy "Users upload own Later Space media"
on storage.objects for insert
with check (bucket_id = 'later-space-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users update own Later Space media" on storage.objects;
create policy "Users update own Later Space media"
on storage.objects for update
using (bucket_id = 'later-space-media' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'later-space-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users delete own Later Space media" on storage.objects;
create policy "Users delete own Later Space media"
on storage.objects for delete
using (bucket_id = 'later-space-media' and (storage.foldername(name))[1] = auth.uid()::text);
