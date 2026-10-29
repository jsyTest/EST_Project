-- NB-V2-006: REVIEW ONLY until the user approves this exact remote schema change.
-- Run once, as a transaction. A pre-existing table/function causes failure rather than silent replacement.
begin;

create table public.education_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 80),
  configuration jsonb not null,
  schema_version integer not null default 1 check (schema_version = 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint education_drafts_configuration_shape check (
    coalesce(jsonb_typeof(configuration) = 'object'
    and configuration -> 'version' = '1'::jsonb
    and jsonb_typeof(configuration -> 'requirements') = 'object'
    and jsonb_typeof(configuration -> 'mapping') = 'object'
    and octet_length(configuration::text) <= 524288, false)
  )
);
create index education_drafts_owner_updated_idx on public.education_drafts (user_id, updated_at desc, id desc);

alter table public.education_drafts enable row level security;
alter table public.education_drafts force row level security;

-- Remove the project's broad default table grants for this table only.
revoke all on table public.education_drafts from public, anon, authenticated;
grant usage on schema public to authenticated;
grant select on table public.education_drafts to authenticated;
grant insert (title, configuration, schema_version) on public.education_drafts to authenticated;
grant update (title, configuration, schema_version) on public.education_drafts to authenticated;
-- No browser DELETE, owner/id assignment, timestamp editing or TRUNCATE grants.

create policy education_drafts_select_own on public.education_drafts for select to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create policy education_drafts_insert_own on public.education_drafts for insert to authenticated
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create policy education_drafts_update_own on public.education_drafts for update to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create function public.education_drafts_touch_updated_at()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.user_id is distinct from old.user_id or new.id is distinct from old.id or new.created_at is distinct from old.created_at then
    raise exception 'Draft ownership and identity are immutable' using errcode = '42501';
  end if;
  new.updated_at := clock_timestamp();
  return new;
end;
$$;
revoke all on function public.education_drafts_touch_updated_at() from public, anon, authenticated;
create trigger education_drafts_update_timestamp before update on public.education_drafts
for each row execute function public.education_drafts_touch_updated_at();

notify pgrst, 'reload schema';
commit;
