# NoteChelvyn — Implementation Plan

Rencana kerja bertahap. Tiap fase harus jalan dan bisa dites sebelum lanjut ke
fase berikutnya. Selesai satu fase → catat di [LIST_DONE.md](LIST_DONE.md).

Konteks & alasan proyek ini ada di [SUMMARY.md](SUMMARY.md).

---

## Fase 0 — Scaffold & Tooling

**Tujuan:** project SvelteKit jalan di `localhost:5173` dengan halaman kosong.

- [ ] `npx sv create .` di folder ini (SvelteKit minimal, TypeScript, tanpa demo)
- [ ] Install: `@supabase/supabase-js`, `@supabase/ssr`, `tailwindcss`, `@sveltejs/adapter-vercel`
- [ ] Setup Tailwind (`npx sv add tailwindcss`)
- [ ] `git init` + `.gitignore` — pastikan `.env` masuk gitignore **sebelum** commit pertama
- [ ] `.env.example` berisi nama variabel saja, tanpa nilai
- [ ] Setup Prettier + ESLint
- [ ] Commit pertama

**Selesai kalau:** `npm run dev` buka halaman kosong tanpa error, `git status` bersih,
dan `.env` tidak muncul di `git status`.

---

## Fase 1 — Supabase Setup & Skema Database

**Tujuan:** database siap dengan tabel, index, dan RLS aktif.

- [ ] Buat project Supabase, catat URL + anon key ke `.env`
- [ ] **Matikan signup** di Dashboard → Authentication → Providers → Email →
      _Enable Signups_ = OFF
- [ ] Buat akun owner manual lewat Dashboard → Authentication → Users → Add User
- [ ] Jalankan migration SQL (skema di bawah)
- [ ] **Verifikasi RLS**: buka SQL Editor, `SELECT * FROM notes;` sebagai anon —
      harus mengembalikan 0 baris, bukan error dan bukan data

### Skema

```sql
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
```

### RLS

```sql
alter table notes     enable row level security;
alter table tags      enable row level security;
alter table note_tags enable row level security;

create policy notes_owner on notes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy tags_owner on tags
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- note_tags tidak punya user_id sendiri; kepemilikan diturunkan dari notes.
-- Tanpa policy ini, tabel join jadi celah untuk menempelkan tag ke note orang lain.
create policy note_tags_owner on note_tags
  for all using (
    exists (select 1 from notes n where n.id = note_id and n.user_id = auth.uid())
  ) with check (
    exists (select 1 from notes n where n.id = note_id and n.user_id = auth.uid())
  );
```

### Trigger `updated_at`

```sql
create or replace function set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''          -- cegah search_path hijacking pada security definer
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger notes_updated_at
  before update on notes
  for each row execute function set_updated_at();
```

**Selesai kalau:** ketiga tabel ada, RLS aktif di semua tabel, dan query anon
mengembalikan 0 baris.

---

## Fase 2 — Auth

**Tujuan:** bisa login, session bertahan setelah refresh, `/` terlindungi.

- [ ] `src/lib/supabase.ts` — client browser (anon key)
- [ ] `src/hooks.server.ts` — server client via `@supabase/ssr`, isi
      `event.locals.supabase` dan `event.locals.safeGetSession()`
- [ ] `src/routes/login/+page.svelte` + `+page.server.ts` (form action)
- [ ] `src/routes/logout/+server.ts`
- [ ] Route guard di `hooks.server.ts` — belum login → redirect ke `/login`
- [ ] Rate limit percobaan login (in-memory map cukup untuk single user)

**Penting soal `safeGetSession`:**
`supabase.auth.getSession()` di server membaca cookie **tanpa memverifikasi
tanda tangan JWT** — cookie yang dipalsukan akan lolos. Selalu panggil
`getUser()` (yang memverifikasi ke server auth) sebelum mempercayai session.
Ini bungkusannya:

```ts
event.locals.safeGetSession = async () => {
	const {
		data: { session }
	} = await event.locals.supabase.auth.getSession();
	if (!session) return { session: null, user: null };

	// getUser() memverifikasi JWT ke Supabase — getSession() tidak.
	const {
		data: { user },
		error
	} = await event.locals.supabase.auth.getUser();
	if (error) return { session: null, user: null };

	return { session, user };
};
```

**Selesai kalau:** buka `/` tanpa login → redirect `/login`. Login berhasil →
masuk `/`. Refresh → tetap login. Logout → balik ke `/login`.

---

## Fase 3 — CRUD Note

**Tujuan:** bisa bikin, baca, edit, hapus note.

- [ ] `src/routes/+page.server.ts` — load daftar note milik user
- [ ] Sidebar daftar note (judul + cuplikan + waktu update)
- [ ] `src/routes/note/[id]/+page.server.ts` + `+page.svelte`
- [ ] Form action: `create`, `update`, `delete`
- [ ] Soft delete (`is_archived = true`) dulu, bukan hard delete — biar tidak
      ada catatan hilang permanen karena salah klik
- [ ] Konfirmasi sebelum hapus

**Aturan yang tidak boleh dilanggar:** `user_id` diambil dari
`locals.safeGetSession()`, **tidak pernah** dari request body. Kalau `user_id`
datang dari client, siapa pun bisa menulis note atas nama orang lain — RLS
memang akan menahan, tapi jangan sampai bergantung pada satu lapis saja.

**Selesai kalau:** semua operasi CRUD jalan dan daftar note ikut ter-update.

---

## Fase 4 — Markdown Editor + Preview

**Tujuan:** editor markdown dengan preview yang aman.

- [ ] Integrasi CodeMirror 6 dengan mode markdown
- [ ] Split pane: editor kiri, preview kanan (bisa di-toggle)
- [ ] Render markdown: `marked` → **`DOMPurify`** → HTML
- [ ] Syntax highlighting untuk code block
- [ ] Responsif — di layar sempit, editor dan preview jadi tab

**Kenapa DOMPurify wajib:** markdown mengizinkan raw HTML. Tanpa sanitasi,
menempel snippet dari internet ke note bisa mengeksekusi script saat note
dibuka — stored XSS pada diri sendiri. Sanitasi dilakukan **sebelum**
`{@html}`, jangan sesudahnya.

**Selesai kalau:** markdown ter-render benar, dan `<script>alert(1)</script>`
di dalam note muncul sebagai teks biasa, tidak dieksekusi.

---

## Fase 5 — Tag & Pencarian

**Tujuan:** note bisa ditandai dan dicari isinya.

- [ ] CRUD tag (buat, rename, hapus, warna)
- [ ] Tag picker di halaman note
- [ ] Filter daftar note berdasarkan tag
- [ ] Search bar → full-text search via `search_vector`
- [ ] Highlight kata yang cocok di hasil pencarian (`ts_headline`)
- [ ] Debounce input pencarian ~300ms

**Query pencarian:**

```ts
// websearch_to_tsquery menerima input manusia ("foo -bar") tanpa error sintaks —
// plainto_tsquery/to_tsquery bisa melempar error pada karakter tertentu.
supabase
	.from('notes')
	.select('*')
	.textSearch('search_vector', query, { type: 'websearch', config: 'simple' });
```

**Selesai kalau:** cari kata yang ada di isi note → note muncul. Klik tag →
daftar terfilter.

---

## Fase 6 — Auto-save & Offline Draft

**Tujuan:** tidak ada ketikan yang hilang.

- [ ] Debounce auto-save 800ms setelah berhenti mengetik
- [ ] Indikator status: `Saving…` / `Saved` / `Offline — draft tersimpan lokal`
- [ ] Simpan draft ke `localStorage` pada tiap perubahan
- [ ] Saat load note: kalau draft lokal lebih baru dari `updated_at` server,
      tawarkan restore — **jangan timpa otomatis**
- [ ] Deteksi konflik: kalau `updated_at` server berubah sejak load (karena
      diedit dari device lain), tampilkan peringatan sebelum menyimpan
- [ ] Hapus draft lokal setelah berhasil save

**Kenapa konflik penting:** ini justru masalah utama yang mau diselesaikan —
dua device. Kalau MacBook dan Windows sama-sama membuka note yang sama, save
terakhir bisa menghapus pekerjaan yang lain tanpa jejak.

**Selesai kalau:** matikan network di DevTools → ketik → indikator jadi offline →
nyalakan lagi → tersimpan. Refresh saat offline → draft masih ada.

---

## Fase 7 — Polish & Deploy

**Tujuan:** live dan enak dipakai sehari-hari.

- [ ] Ganti ke `adapter-vercel`
- [ ] Set env var di Vercel dashboard (jangan pernah commit `.env`)
- [ ] Loading state & error boundary
- [ ] Halaman error 404 / 500
- [ ] Cek responsif di HP
- [ ] Security header di `hooks.server.ts`: CSP, `X-Frame-Options: DENY`,
      `X-Content-Type-Options: nosniff`, `Referrer-Policy`
- [ ] README dengan screenshot (ini yang dilihat orang saat menilai portofolio)
- [ ] Deploy + tes login dari device lain

**Selesai kalau:** bisa login dari MacBook dan Windows, note yang sama muncul
di keduanya.

---

## Roadmap (setelah v1)

| Prioritas | Fitur                                                         |
| --------- | ------------------------------------------------------------- |
| Tinggi    | **Template kerja siap pakai** — alasan awal proyek ini dibuat |
| Tinggi    | Export note ke `.md` / seluruh vault ke `.zip`                |
| Sedang    | Dark mode                                                     |
| Sedang    | Keyboard shortcut (Cmd/Ctrl+K command palette, Cmd+S)         |
| Sedang    | Folder / nested note                                          |
| Rendah    | Upload gambar (Supabase Storage)                              |
| Rendah    | PWA — installable, offline penuh                              |
| Rendah    | Versi history per note                                        |

---

## Struktur folder

```
src/
├── lib/
│   ├── components/     # NoteCard, Editor, TagPicker, SearchBar
│   ├── server/         # helper khusus server (jangan pernah di-import client)
│   ├── supabase.ts     # client browser
│   ├── types.ts        # tipe DB
│   └── utils/          # markdown.ts (marked + DOMPurify), debounce.ts
├── routes/
│   ├── +layout.svelte
│   ├── +layout.server.ts
│   ├── +page.svelte            # daftar note
│   ├── login/
│   ├── logout/
│   └── note/[id]/
├── hooks.server.ts
└── app.css
supabase/
└── migrations/
```

**Catatan:** apa pun di `src/lib/server/` diblokir oleh SvelteKit dari bundle
client. Semua yang menyentuh secret harus ditaruh di sana.

---

## Aturan urutan kerja

1. **Fase 1 (RLS) tidak boleh dilewati.** Bangun UI di atas database tanpa RLS
   berarti membangun di atas asumsi yang belum diuji.
2. Tiap fase selesai → catat di [LIST_DONE.md](LIST_DONE.md) dengan hash commit.
3. Satu fase = satu branch = satu commit rapi. Ini yang dibaca orang saat
   menilai portofolio.
