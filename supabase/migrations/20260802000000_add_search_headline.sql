-- Full-text search with highlighted snippets (Phase 5).
--
-- notes.search_vector and its GIN index already exist (init migration).
-- ts_headline() can't be expressed through PostgREST's .textSearch() builder,
-- so search needs a dedicated RPC function.
--
-- security invoker (not definer): the function must run with the caller's
-- own privileges so the notes_owner RLS policy still applies. Without this,
-- a security definer function would run as its owner and could read every
-- user's notes regardless of RLS.
create or replace function search_notes_headline(search_query text)
returns table (
  id uuid,
  title text,
  snippet text,
  is_pinned boolean,
  is_locked boolean,
  updated_at timestamptz
)
language sql
security invoker
stable
set search_path = ''
as $$
  select
    n.id,
    n.title,
    ts_headline(
      'simple',
      n.content,
      websearch_to_tsquery('simple', search_query),
      'MaxFragments=1, MaxWords=30, MinWords=15'
    ) as snippet,
    n.is_pinned,
    n.is_locked,
    n.updated_at
  from public.notes n
  where n.is_archived = false
    and n.search_vector @@ websearch_to_tsquery('simple', search_query)
  order by n.is_pinned desc, n.updated_at desc
$$;

grant execute on function search_notes_headline(text) to authenticated;
