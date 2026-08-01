# NoteChelvyn

A private, single-user note-taking app. Built to solve a real problem: work notes
scattered across a MacBook and a Windows machine that never stayed in sync — without
handing the contents to Google Drive or Notion.

**Status:** in development. Phases 0–6 complete (auth, CRUD, markdown editor, tags,
search, offline drafts) — see [LIST_DONE.md](LIST_DONE.md) for the changelog and
[PLAN.md](PLAN.md) for what's left before v1.

<!-- Screenshot: sidebar with notes list + markdown editor with live preview open.
     Add with: ![NoteChelvyn screenshot](docs/screenshot.png) -->

## Stack

SvelteKit 2 (Svelte 5 runes) · TypeScript · Supabase (Postgres + Auth + RLS) ·
Tailwind CSS 4 · CodeMirror 6 · deployed on Vercel

## Features

- Markdown editor with live preview (sanitized before render), split or tabbed
  depending on screen width
- Tags and Postgres full-text search, with match highlighting in results
- Auto-save with offline drafts (localStorage) and cross-device conflict detection —
  editing the same note from two machines won't silently clobber one of them
- Per-note PIN lock for anything you'd rather not have visible at a glance

## Security model

Single-user does not mean lax. See [SUMMARY.md](SUMMARY.md#model-keamanan) for the
full reasoning; the short version:

- Signups disabled at the Supabase project level — the owner account is the only one
- Row Level Security on every table, so a bug in application code still can't leak data
- The service role key is never used by the app; it bypasses RLS entirely
- Sessions live in httpOnly cookies, out of reach of XSS
- `getUser()` (which verifies the JWT) gates authorization, never `getSession()`
- Markdown is sanitized with DOMPurify before rendering — markdown allows raw HTML
- Security headers on every response: a strict `Content-Security-Policy` (nonce-based,
  no `unsafe-inline` for scripts), `X-Frame-Options: DENY`,
  `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`

## Setup

```sh
npm install
cp .env.example .env    # fill in from your Supabase dashboard
npm run dev
```

## Scripts

| Command           | Description                  |
| ----------------- | ---------------------------- |
| `npm run dev`     | Development server           |
| `npm run build`   | Production build             |
| `npm run preview` | Preview the production build |
| `npm run check`   | Type-check with svelte-check |
| `npm run lint`    | Prettier + ESLint            |
| `npm run format`  | Auto-format                  |

## Documentation

- [SUMMARY.md](SUMMARY.md) — why this exists, stack, security model
- [PLAN.md](PLAN.md) — phased implementation plan
- [CLAUDE.md](CLAUDE.md) — coding conventions and rules
- [LIST_DONE.md](LIST_DONE.md) — changelog
