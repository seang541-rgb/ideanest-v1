-- Agent Memory prerequisites
-- Per-user typed facts the Copilot can read at the start of every turn
-- and write via the `remember` tool. RLS ensures users can only access
-- their own memory.

create table if not exists public.agent_memory (
  id           bigserial primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  scope        text not null check (scope in ('user', 'project')),
  project_key  text,
  fact_key     text not null check (length(fact_key) between 1 and 64),
  fact_value   text not null check (length(fact_value) between 1 and 2000),
  updated_at   timestamptz not null default timezone('utc', now()),
  -- NULLS NOT DISTINCT is critical: user-scope facts have NULL project_key,
  -- and without this clause every repeated upsert would insert a duplicate row
  -- (because PostgreSQL treats NULL != NULL in unique constraints by default).
  unique nulls not distinct (user_id, scope, project_key, fact_key)
);

-- Cleanup duplicates from any prior version that had a NULLS DISTINCT unique
-- constraint (which silently allowed duplicate user-scope facts).
-- Keep the newest row per (user_id, scope, coalesce(project_key,''), fact_key).
with ranked as (
  select id, row_number() over (
    partition by user_id, scope, coalesce(project_key, ''), fact_key
    order by updated_at desc, id desc
  ) as rn
  from public.agent_memory
)
delete from public.agent_memory am
using ranked
where am.id = ranked.id and ranked.rn > 1;

-- Rebuild the unique constraint with NULLS NOT DISTINCT (PG 15+). Drop the
-- old one if it exists from a previous run with the buggy syntax.
do $$
declare
  cons_name text;
begin
  select conname into cons_name
  from pg_constraint
  where conrelid = 'public.agent_memory'::regclass
    and contype = 'u'
    and conkey @> array(
      select attnum from pg_attribute
      where attrelid = 'public.agent_memory'::regclass
        and attname in ('user_id','scope','project_key','fact_key')
    );
  if cons_name is not null then
    execute format('alter table public.agent_memory drop constraint %I', cons_name);
  end if;
end $$;

alter table public.agent_memory
  add constraint agent_memory_uniq
  unique nulls not distinct (user_id, scope, project_key, fact_key);

-- Index for the hot read path: load all of a user's memory at turn start.
create index if not exists idx_agent_memory_user
  on public.agent_memory (user_id, scope, updated_at desc);

-- RLS: users can read/write only their own rows. Service role bypasses.
alter table public.agent_memory enable row level security;

drop policy if exists "agent_memory_self_select" on public.agent_memory;
create policy "agent_memory_self_select"
  on public.agent_memory
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "agent_memory_self_insert" on public.agent_memory;
create policy "agent_memory_self_insert"
  on public.agent_memory
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "agent_memory_self_update" on public.agent_memory;
create policy "agent_memory_self_update"
  on public.agent_memory
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "agent_memory_self_delete" on public.agent_memory;
create policy "agent_memory_self_delete"
  on public.agent_memory
  for delete
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "agent_memory_service_role_all" on public.agent_memory;
create policy "agent_memory_service_role_all"
  on public.agent_memory
  for all
  to service_role
  using (true)
  with check (true);

-- Upsert RPC: caller is the user, so auth.uid() is the user_id. The RPC
-- writes one fact and returns the resulting row. Atomic on the unique key.
create or replace function public.upsert_agent_memory(
  p_scope       text,
  p_project_key text,
  p_fact_key    text,
  p_fact_value  text
)
returns public.agent_memory
language plpgsql
security definer
set search_path = ''
as $$
declare
  resulting_row public.agent_memory;
  caller_uid    uuid := auth.uid();
begin
  if caller_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if p_scope not in ('user', 'project') then
    raise exception 'INVALID_SCOPE: must be user or project';
  end if;
  if p_scope = 'project' and (p_project_key is null or length(p_project_key) = 0) then
    raise exception 'PROJECT_KEY_REQUIRED for project-scope memory';
  end if;

  insert into public.agent_memory (user_id, scope, project_key, fact_key, fact_value, updated_at)
  values (caller_uid, p_scope, p_project_key, p_fact_key, p_fact_value, timezone('utc', now()))
  on conflict (user_id, scope, project_key, fact_key)
  do update set
    fact_value = excluded.fact_value,
    updated_at = excluded.updated_at
  returning * into resulting_row;

  return resulting_row;
end;
$$;

grant execute on function public.upsert_agent_memory(text, text, text, text) to authenticated;

-- Delete RPC: caller-only. Returns deleted count.
create or replace function public.delete_agent_memory(
  p_scope       text,
  p_project_key text,
  p_fact_key    text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_count integer;
  caller_uid    uuid := auth.uid();
begin
  if caller_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  delete from public.agent_memory
  where user_id = caller_uid
    and scope = p_scope
    and ((p_project_key is null and project_key is null)
         or project_key = p_project_key)
    and fact_key = p_fact_key;

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

grant execute on function public.delete_agent_memory(text, text, text) to authenticated;
