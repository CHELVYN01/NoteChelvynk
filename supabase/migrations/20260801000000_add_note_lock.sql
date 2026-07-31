-- Adds a client-side PIN gate for individual notes ("lock this note").
-- NOTE: this is a UX privacy gate, not encryption — content stays in
-- plaintext in the database, protected the same way every other note is
-- (RLS, owner-only). pin_hash guards against someone browsing the app UI
-- with the account already logged in; it does not protect against direct
-- database/API access, which RLS already scopes to the owner.

alter table notes
  add column is_locked boolean not null default false,
  add column pin_hash text;

-- A locked note must have a hash to check against, and an unlocked note
-- must not be carrying a stale hash around.
alter table notes
  add constraint notes_lock_consistency check (
    (is_locked = false and pin_hash is null) or
    (is_locked = true and pin_hash is not null)
  );
