-- NoteChelvyn — initial schema: notes, tags, note_tags
-- RLS policies, indexes, and updated_at trigger included in the same migration
-- per CLAUDE.md rule #4 (no table without RLS, not even temporarily).

-- notes
create table notes (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  title        text not null default 'Untitled',
  content      text not null default '',
  is_pinned    boolean not null default false,
  is_archived  boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  search_vector tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(title, '')),   'A') ||
    setweight(to_tsvector('simple', coalesce(content, '')), 'B')
  ) stored
);

create index notes_user_updated_idx on notes (user_id, updated_at desc);
create index notes_search_idx       on notes using gin (search_vector);

-- tags
create table tags (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  color      text not null default 'gray',
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

-- note_tags (many-to-many)
create table note_tags (
  note_id uuid not null references notes(id) on delete cascade,
  tag_id  uuid not null references tags(id)  on delete cascade,
  primary key (note_id, tag_id)
);

create index note_tags_tag_idx on note_tags (tag_id);

-- RLS
alter table notes     enable row level security;
alter table tags      enable row level security;
alter table note_tags enable row level security;

create policy notes_owner on notes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy tags_owner on tags
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- note_tags has no user_id of its own; ownership is derived from notes.
-- Without this policy, the join table becomes a gap for attaching tags to
-- someone else's note.
create policy note_tags_owner on note_tags
  for all using (
    exists (select 1 from notes n where n.id = note_id and n.user_id = auth.uid())
  ) with check (
    exists (select 1 from notes n where n.id = note_id and n.user_id = auth.uid())
  );

-- updated_at trigger
create or replace function set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''          -- prevent search_path hijacking on security definer
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger notes_updated_at
  before update on notes
  for each row execute function set_updated_at();

-- "Automatically expose new tables" was left off when creating the project
-- (deliberately — we don't want new tables silently reachable by default).
-- PostgREST still needs a table-level GRANT before RLS is even evaluated;
-- without it every request 401s with "permission denied" regardless of policy.
-- RLS policies above remain the real access boundary — this just lets
-- authenticated/anon reach the table so those policies can run.
grant select, insert, update, delete on notes, tags, note_tags to authenticated;
grant select on notes, tags, note_tags to anon;
