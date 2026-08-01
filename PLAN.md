# NoteChelvyn — Implementation Plan

Rencana kerja bertahap. Tiap fase harus jalan dan bisa dites sebelum lanjut ke
fase berikutnya. Selesai satu fase → catat di [LIST_DONE.md](LIST_DONE.md).

Konteks & alasan proyek ini ada di [SUMMARY.md](SUMMARY.md).

---

## Fase 0 — Scaffold & Tooling ✅

**Tujuan:** project SvelteKit jalan di `localhost:5173` dengan halaman kosong.

- [x] `npx sv create .` di folder ini (SvelteKit minimal, TypeScript, tanpa demo)
- [x] Install: `@supabase/supabase-js`, `@supabase/ssr`, `tailwindcss`, `@sveltejs/adapter-vercel`
- [x] Setup Tailwind (`npx sv add tailwindcss`) — plugin `typography` (untuk preview
      markdown di Fase 4) dan `forms` (untuk form login di Fase 2)
- [x] `git init` + `.gitignore` — pastikan `.env` masuk gitignore **sebelum** commit pertama
- [x] `.env.example` berisi nama variabel saja, tanpa nilai
- [x] Setup Prettier + ESLint
- [x] Commit pertama
- [x] `src/app.d.ts` — tipe `App.Locals` disiapkan lebih awal untuk Fase 2
- [x] `.gitattributes` — normalisasi line ending (repo ini diedit dari macOS & Windows)

**Selesai kalau:** `npm run dev` buka halaman kosong tanpa error, `git status` bersih,
dan `.env` tidak muncul di `git status`.

### Catatan: `npm run build` gagal di Windows

`adapter-vercel` membuat symlink saat build, dan Windows menolaknya dengan `EPERM`
kecuali Developer Mode aktif atau terminal dijalankan sebagai admin. **Ini bukan bug
kode** — build dengan `adapter-node` sukses, dan di Vercel (Linux) build berjalan normal.

Kalau ingin `npm run build` jalan lokal: Settings → System → For developers →
Developer Mode = ON, lalu buka ulang terminal.

### Catatan: `npm audit` melaporkan 3 low severity

CVE pada paket `cookie` (<0.7.0), transitif dari `@sveltejs/kit`. Kit `2.70.1` sudah
versi terbaru dan masih mem-pin `cookie@0.6.0`, jadi belum ada fix upstream.
**Jangan jalankan `npm audit fix --force`** — perintah itu men-downgrade Kit ke
`0.0.30` dan merusak project. Kerentanannya soal parsing nama/path cookie yang
di luar rentang karakter; tidak terjangkau lewat jalur input aplikasi ini. Tinjau
ulang saat Kit merilis versi dengan `cookie` yang sudah di-patch.

---

## Fase 1 — Supabase Setup & Skema Database ✅

**Tujuan:** database siap dengan tabel, index, dan RLS aktif.

- [x] Buat project Supabase, catat URL + anon key ke `.env`
- [x] **Matikan signup** di Dashboard → Authentication → Providers → Email →
      _Enable Signups_ = OFF
- [x] Buat akun owner manual lewat Dashboard → Authentication → Users → Add User
- [x] Jalankan migration SQL (skema di bawah)
- [x] **Verifikasi RLS**: `GET /rest/v1/notes` sebagai anon — mengembalikan
      `200 []`, bukan error dan bukan data

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

### Catatan: perlu `GRANT` eksplisit karena "Automatically expose new tables" = OFF

Project ini dibuat dengan toggle **"Automatically expose new tables" dimatikan**
(rekomendasi Supabase sendiri saat create project — kita kontrol expose lewat
migration, bukan default). Konsekuensinya: PostgREST butuh `GRANT` level tabel
ke role `anon`/`authenticated` sebelum RLS sempat dievaluasi sama sekali —
tanpa ini, tiap request ke REST API balik `401 permission denied for table ...`
walau RLS policy-nya sudah benar. Ditambahkan di migration yang sama:

```sql
grant select, insert, update, delete on notes, tags, note_tags to authenticated;
grant select on notes, tags, note_tags to anon;
```

`anon` sengaja cuma dapat `select` (bukan tulis) — supaya request anon bisa
_mencapai_ tabel dan RLS yang menjatuhkan ke 0 baris, bukan ditolak duluan oleh
grant. RLS tetap jadi batas akses sesungguhnya; grant ini cuma soal "boleh coba",
bukan "boleh lihat semua".

---

## Fase 2 — Auth ✅

**Tujuan:** bisa login, session bertahan setelah refresh, `/` terlindungi.

- [x] `src/lib/supabase.ts` — client browser (anon key)
- [x] `src/hooks.server.ts` — server client via `@supabase/ssr`, isi
      `event.locals.supabase` dan `event.locals.safeGetSession()`
- [x] `src/routes/login/+page.svelte` + `+page.server.ts` (form action)
- [x] `src/routes/logout/+server.ts`
- [x] Route guard di `hooks.server.ts` — belum login → redirect ke `/login`
- [x] Rate limit percobaan login (in-memory map cukup untuk single user)

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

Ditambahkan di luar checklist: rate limit dikunci per `IP + email` (bukan cuma
email) supaya penyerang tidak bisa mengunci owner sungguhan dengan menghajar
login dari IP lain memakai email owner.

---

## Fase 3 — CRUD Note ✅

**Tujuan:** bisa bikin, baca, edit, hapus note.

- [x] `src/routes/+page.server.ts` — load daftar note milik user
- [x] Sidebar daftar note (judul + cuplikan + waktu update)
- [x] `src/routes/note/[id]/+page.server.ts` + `+page.svelte`
- [x] Form action: `create`, `update`, `delete`
- [x] Soft delete (`is_archived = true`) dulu, bukan hard delete — biar tidak
      ada catatan hilang permanen karena salah klik
- [x] Konfirmasi sebelum hapus

**Aturan yang tidak boleh dilanggar:** `user_id` diambil dari
`locals.safeGetSession()`, **tidak pernah** dari request body. Kalau `user_id`
datang dari client, siapa pun bisa menulis note atas nama orang lain — RLS
memang akan menahan, tapi jangan sampai bergantung pada satu lapis saja.

**Selesai kalau:** semua operasi CRUD jalan dan daftar note ikut ter-update.

### Ditambahkan di luar rencana awal: auto-save & lock note

**Auto-save** dipindah lebih awal dari Fase 6 atas permintaan langsung —
debounce 800ms, kirim lewat `fetch()` terprogram ke form action (bukan
`use:enhance` submit biasa), karena perlu snapshot `title`/`content` dari
`$state` di waktu-kirim, bukan bergantung pada `HTMLFormElement.requestSubmit()`
yang sempat menyebabkan race condition (isi ke-reset ke kosong) saat pindah
note dengan timer auto-save masih pending. Timer di-cancel eksplisit saat
komponen note di-unmount (`{#key data.note.id}` remount + `$effect` cleanup)
supaya auto-save basi dari note sebelumnya tidak menembak note yang salah.

Ini menyimpang dari aturan "mutasi lewat form action, bukan fetch manual" di
CLAUDE.md secara sadar — form action tetap dipakai sebagai endpoint (bukan
`+server.ts`), cuma cara triggernya lewat `fetch()` terkontrol, bukan native
form submit, karena butuh kontrol presisi atas kapan data diambil.

**Lock note** (fitur privasi tambahan, di luar PLAN.md) — PIN per-note yang
disimpan ter-hash (`scrypt` dari `node:crypto`, tanpa dependency baru) di
kolom `pin_hash`. **Ini gate UX di client, bukan enkripsi** — content note
tetap plaintext di database, diproteksi RLS yang sama seperti note lain.
Server tidak pernah mengirim `content` note yang `is_locked` lewat `load()`
biasa (baik ke halaman note maupun ke daftar sidebar) — content asli cuma
dikirim sekali, sebagai hasil action `unlock` setelah PIN diverifikasi benar
di server. Status "unlocked" disimpan di `sessionStorage` (hilang saat tab
ditutup), bukan cookie/localStorage persisten.

Migration: `supabase/migrations/20260801000000_add_note_lock.sql` — kolom
`is_locked`, `pin_hash`, plus check constraint yang menjamin keduanya selalu
konsisten (locked note wajib punya hash, unlocked note tidak boleh menyimpan
hash basi).

---

## Fase 4 — Markdown Editor + Preview ✅

**Tujuan:** editor markdown dengan preview yang aman.

- [x] Integrasi CodeMirror 6 dengan mode markdown
- [x] Split pane: editor kiri, preview kanan (bisa di-toggle)
- [x] Render markdown: `marked` → **`DOMPurify`** → HTML
- [x] Syntax highlighting untuk code block
- [x] Responsif — di layar sempit, editor dan preview jadi tab

**Kenapa DOMPurify wajib:** markdown mengizinkan raw HTML. Tanpa sanitasi,
menempel snippet dari internet ke note bisa mengeksekusi script saat note
dibuka — stored XSS pada diri sendiri. Sanitasi dilakukan **sebelum**
`{@html}`, jangan sesudahnya.

**Selesai kalau:** markdown ter-render benar, dan `<script>alert(1)</script>`
di dalam note muncul sebagai teks biasa, tidak dieksekusi.

### Catatan: default DOMPurify masih terlalu longgar untuk app catatan

Diuji dengan 15 payload; 13 langsung mati, 2 lolos karena memang default
DOMPurify — keduanya sekarang diblokir eksplisit di `src/lib/utils/markdown.ts`:

- **`<form>` + `<input>` ter-render jadi form yang benar-benar berfungsi.**
  Artinya note bisa memuat kotak login palsu yang submit ke server orang lain.
  Di app single-user kamu harus mem-paste sendiri, tapi itu justru skenario
  realistisnya: menyalin "tutorial" dari internet. Note tidak punya alasan sah
  memuat form → `FORBID_TAGS`.
- **Atribut `style` dipertahankan** karena browser modern mengabaikan
  `javascript:` di dalam CSS, jadi bukan eksekusi script. Tapi `style` tetap
  cukup untuk membuat overlay clickjacking (`position`/`opacity`/`z-index`) di
  atas tombol Delete milik app sendiri → `FORBID_ATTR`.

Pengecualian `svelte/no-at-html-tags` di-scope ke path `MarkdownPreview.svelte`
lewat `eslint.config.js`, bukan komentar inline — supaya file lain yang memakai
`{@html}` tetap gagal lint.

### Catatan: `$effect` yang membaca state CodeMirror bikin loop

Bug saat integrasi: hanya satu huruf yang tersimpan per ketikan. Effect yang
menyinkronkan `value` ke dokumen ikut membaca `view.state`, sehingga Svelte
men-subscribe effect itu ke state CodeMirror sendiri — `dispatch` memicu effect
yang baru saja melakukan `dispatch` itu, dokumen tertimpa, cursor reset.

Perbaikan: baca `value` secara tracked, tapi bungkus akses `view.state` dengan
`untrack()`. `view` juga dijadikan variabel biasa (bukan `$state`) karena tidak
pernah dirender. `doc:` saat inisialisasi ikut di-`untrack()` — tanpa itu tiap
ketikan membongkar dan membangun ulang editor, yang diam-diam menghapus undo
history.

---

## Fase 5 — Tag & Pencarian ✅

**Tujuan:** note bisa ditandai dan dicari isinya.

- [x] CRUD tag (buat, rename, hapus, warna)
- [x] Tag picker di halaman note
- [x] Filter daftar note berdasarkan tag
- [x] Search bar → full-text search via `search_vector`
- [x] Highlight kata yang cocok di hasil pencarian (`ts_headline`)
- [x] Debounce input pencarian ~300ms

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

### Catatan: highlight pencarian butuh RPC function, bukan `.textSearch()` biasa

`ts_headline()` (potongan teks dengan kata kunci di-bold) tidak bisa
diekspresikan lewat builder PostgREST `.textSearch()` — itu cuma memfilter,
tidak memotong/menandai teks. Ditambahkan satu Postgres function,
`search_notes_headline()`, di migration
`supabase/migrations/20260802000000_add_search_headline.sql`, dipanggil lewat
`locals.supabase.rpc(...)` dari endpoint `src/routes/search/+server.ts`.

Function ini pakai `security invoker` (bukan `definer`) supaya RLS pemanggil
tetap berlaku — kalau pakai `definer`, function akan jalan dengan privilege
pemiliknya dan bisa membaca note siapa saja, melewati RLS sepenuhnya.

Snippet hasil `ts_headline` menyisipkan tag `<b>` untuk highlight — itu tetap
teks dari isi note milik user, jadi tetap disanitasi lewat `sanitizeHeadline()`
(whitelist cuma `<b>`) sebelum `{@html}` di `Sidebar.svelte`, konsisten dengan
aturan sanitasi HTML di CLAUDE.md. Note yang `is_locked` tidak pernah
mengembalikan snippet asli dari endpoint search — sama seperti aturan
`load()` biasa, hanya action `unlock` yang boleh mengirim content asli.

### Catatan: tag dihapus otomatis kalau tidak dipakai note manapun

Tag di app ini dibuat ad-hoc dari tag picker (bukan kategori predefined).
Begitu note terakhir yang memakai suatu tag di-unassign (action `removeTag`
di `src/routes/note/[id]/+page.server.ts`), server mengecek apakah tag itu
masih dipakai note lain — kalau tidak, tag dihapus langsung dari tabel `tags`.
Ini keputusan sadar (bukan default Supabase): tanpa ini, tag kosong akan
menggantung selamanya di daftar filter sidebar walau sudah tidak relevan.

---

## Fase 6 — Auto-save & Offline Draft ✅

**Tujuan:** tidak ada ketikan yang hilang.

- [x] Debounce auto-save 800ms setelah berhenti mengetik (sudah ada dari Fase 3)
- [x] Indikator status: `Saving…` / `Saved` / `Offline — draft tersimpan lokal`
- [x] Simpan draft ke `localStorage` pada tiap perubahan
- [x] Saat load note: kalau draft lokal lebih baru dari `updated_at` server,
      tawarkan restore — **jangan timpa otomatis**
- [x] Deteksi konflik: kalau `updated_at` server berubah sejak load (karena
      diedit dari device lain), tampilkan peringatan sebelum menyimpan
- [x] Hapus draft lokal setelah berhasil save

**Kenapa konflik penting:** ini justru masalah utama yang mau diselesaikan —
dua device. Kalau MacBook dan Windows sama-sama membuka note yang sama, save
terakhir bisa menghapus pekerjaan yang lain tanpa jejak.

**Selesai kalau:** matikan network di DevTools → ketik → indikator jadi offline →
nyalakan lagi → tersimpan. Refresh saat offline → draft masih ada.

### Catatan: deteksi konflik pakai optimistic concurrency di action `update`

Client mengirim `known_updated_at` (nilai `updated_at` terakhir yang ia lihat)
tiap kali save. Server bandingkan dengan `updated_at` sekarang di database
**sebelum** menulis — kalau beda, berarti device lain sudah menyimpan duluan,
dan action balik `fail(409, ...)` alih-alih menimpa. Client menerima
`updated_at` server yang baru lewat body 409, ditampilkan di modal
"Overwrite anyway" / "Reload" — tidak ada jalur yang menimpa diam-diam.

Ini butuh satu `select` tambahan sebelum `update` (bukan cukup mengandalkan
`updated_at` yang dikembalikan `update` itu sendiri), karena PostgREST tidak
punya `UPDATE ... WHERE updated_at = ...` lewat query builder — filter
kesetaraan pada `updated_at` di klausa `.eq()` sebelum `.update()` akan jadi
race yang sama persis dengan yang mau dicegah (read-then-write tanpa lock).
Trade-off yang diterima: satu round-trip ekstra demi menghindari korupsi data
diam-diam, bukan soal performa.

### Catatan: draft localStorage mengikuti status unlock, bukan `is_locked` mentah

Selama note terkunci masih _tergate_ (PIN belum dimasukkan di sesi ini),
draft tidak pernah ditulis ke `localStorage` — konsisten dengan aturan lock
note di Fase 3: content note locked tidak pernah keluar dari server dalam
bentuk plaintext kecuali lewat action `unlock` yang terverifikasi PIN.

Begitu PIN benar dan note ter-unlock, draft **diaktifkan** untuk sisa sesi
itu — content saat itu sudah plaintext di editor (dan di memori JS) juga,
jadi menuliskannya ke `localStorage` tidak membuka exposure baru, dan user
tetap dapat perlindungan anti-kehilangan ketikan yang sama seperti note
biasa. `draftEligible` di `NoteEditor.svelte` karena itu adalah `$derived`
dari `isUnlocked` (state sesi, dari `sessionStorage`), bukan `is_locked`
langsung dari database — begitu note dikunci ulang atau tab ditutup
(`sessionStorage` hilang), draft berhenti ditulis lagi.

### Catatan: belum divalidasi manual di browser

`npm run check` dan `npm run lint` bersih, tapi skenario offline di
"Selesai kalau" (matikan network, refresh saat offline, dua tab untuk
memicu conflict) belum dites langsung di browser pada sesi ini — perlu
login ke akun owner Supabase asli yang tidak tersedia untuk AI assistant.
Tes manual ini masih harus dilakukan sebelum menganggap fase ini benar-benar
tuntas.

---

## Fase 7 — Polish & Deploy

**Tujuan:** live dan enak dipakai sehari-hari.

- [x] Ganti ke `adapter-vercel` (sudah terpasang dari Fase 0, tidak ada
      `adapter-node` yang perlu diganti — lihat catatan di bawah)
- [ ] Set env var di Vercel dashboard (jangan pernah commit `.env`)
- [x] Loading state & error boundary
- [x] Halaman error 404 / 500
- [x] Cek responsif di HP
- [x] Security header di `hooks.server.ts`: CSP, `X-Frame-Options: DENY`,
      `X-Content-Type-Options: nosniff`, `Referrer-Policy`
- [x] README dengan screenshot (ini yang dilihat orang saat menilai portofolio)
- [ ] Deploy + tes login dari device lain

**Selesai kalau:** bisa login dari MacBook dan Windows, note yang sama muncul
di keduanya.

### Catatan: adapter-vercel sudah terpasang sejak Fase 0

Tidak ada migrasi dari `adapter-node` yang perlu dilakukan — project ini sejak
awal dikonfigurasi dengan `@sveltejs/adapter-vercel` di `vite.config.ts` (lihat
catatan Fase 0 soal `EPERM` symlink saat build lokal di Windows, yang memang
soal `adapter-vercel` itu sendiri, bukan `adapter-node`).

### Catatan: CSP butuh opsi `csp` di plugin `sveltekit()`, bukan header manual

SvelteKit versi ini (2.62+) membaca konfigurasi langsung dari argumen yang
dipassing ke plugin `sveltekit({...})` di `vite.config.ts` — kalau argumen itu
diisi (dan di project ini memang diisi, untuk `compilerOptions` dan
`adapter`), file `svelte.config.js` terpisah **diabaikan** (dengan warning),
bukan digabung. Karena itu opsi `csp` ditambahkan sebagai properti baru di
pemanggilan `sveltekit({...})` yang sudah ada, bukan file konfigurasi baru.

Awalnya CSP dicoba di-set manual lewat header di `hooks.server.ts` (pola yang
sama dengan tiga header lain). Itu merusak app sepenuhnya — SvelteKit selalu
menyuntik satu `<script nonce="...">` inline untuk hydration (`__sveltekit_dev`
di dev, `__sveltekit_<hash>` di build), baik di dev maupun production. CSP
manual dengan `script-src 'self'` tanpa pengecualian memblokir script itu;
menambahkan `unsafe-inline` supaya tidak rusak akan meniadakan tujuan
`script-src` yang ketat. Solusinya: pindahkan CSP ke opsi `csp.directives` di
`sveltekit({...})`, yang membuat SvelteKit sendiri yang mengatur header itu
dan otomatis menempelkan nonce per-request yang cocok ke script inline-nya —
diverifikasi dengan curl bahwa nonce di header `Content-Security-Policy` sama
persis dengan atribut `nonce` di tag `<script>` pada HTML yang dikirim.

Empat header lain (`X-Frame-Options`, `X-Content-Type-Options`,
`Referrer-Policy`) tetap di-set manual di `hooks.server.ts` karena SvelteKit
tidak punya opsi konfigurasi built-in untuk itu.

### Catatan: sidebar & modal tidak responsif sebelum fase ini

Sidebar (`w-72` tetap) dan `Modal.svelte` (`left-72` hardcode, mengasumsikan
sidebar selalu ada di kiri) tidak dirancang untuk layar sempit sejak dibuat —
di HP, sidebar akan memakan sebagian layar secara permanen dan modal salah
posisi. Diperbaiki dengan pola tab yang sama seperti split-view editor di
Fase 4: di bawah breakpoint `sm`, sidebar dan halaman note bergantian
menempati satu-satunya "layar" yang ada (bukan tampil berdampingan), dengan
tombol back (`ChevronLeftIcon`) di header note untuk kembali ke daftar.
`Modal.svelte` diubah dari `left-72` tetap menjadi `left-0 sm:left-72`, supaya
tetap center ke area konten di layar lebar tapi full-width di layar sempit
tempat sidebar tidak lagi tampil sejajar.

### Catatan: env var Vercel & deploy belum dilakukan

Butuh akses dashboard Vercel milik pemilik project dan keputusan untuk publish
ke luar — di luar kewenangan AI assistant untuk dieksekusi tanpa didampingi
langsung. Kode untuk mendukungnya (adapter, CSP, error page, responsif) sudah
siap; langkah env var dan klik deploy menyusul bersama pemilik project.

### Catatan: deploy pertama 500 di semua route — bug jsdom, bukan kode Fase 7

Deploy Vercel pertama gagal dengan `500` di setiap route termasuk `/login`.
Runtime log menunjukkan:

```
Error [ERR_REQUIRE_ESM]: require() of ES Module
.../node_modules/@exodus/bytes/encoding-lite.js from
.../node_modules/html-encoding-sniffer/lib/html-encoding-sniffer.js not supported.
```

Bukan disebabkan perubahan CSP/adapter/dsb di fase ini — `isomorphic-dompurify`
(yang menarik `jsdom` untuk sanitasi markdown di server) sudah dipakai sejak
Fase 4, dan `package-lock.json` tidak berubah sejak commit fase itu. Baru
ketahuan sekarang karena `npm run build` di Windows selalu gagal duluan di
tahap lain (`EPERM` symlink, sudah dicatat di Fase 0) — belum ada sesi
sebelumnya yang berhasil menjalankan build+runtime Vercel sungguhan sampai
percobaan deploy pertama ini.

Akar masalahnya: `html-encoding-sniffer@6.0.0` (dependency `jsdom@29.1.1`,
versi yang diminta `isomorphic-dompurify@3.19.0`) meng-`require()` paket
`@exodus/bytes`, yang murni ESM (`"type": "module"`) — kombinasi itu gagal di
runtime serverless function Vercel (Node ESM/CJS interop), walau tidak
terdeteksi lewat `npm run check`/`npm run dev` di lokal.

Perbaikan: `"overrides": { "jsdom": "27.3.0" }` di `package.json` — versi
`jsdom` 27.x terakhir sebelum `html-encoding-sniffer` di-bump ke `^6.0.0`
(persisnya di `27.4.0`, jadi `27.3.0` adalah versi teratas yang masih aman).
`jsdom@30` dicek juga dan ternyata masih mengarah ke
`html-encoding-sniffer@^6`, jadi bukan soal "belum di-upgrade" — perbaikannya
memang harus mundur, bukan maju. Setelah override, 20 payload XSS (15 asli
dari Fase 4 + 5 tambahan) diverifikasi ulang lewat `renderMarkdown()`
langsung — semuanya tetap dinetralisir dengan benar, jadi downgrade ini tidak
melemahkan sanitasi.

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
