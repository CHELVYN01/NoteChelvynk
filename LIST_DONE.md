# LIST_DONE

Changelog pekerjaan yang sudah selesai. Terbaru di atas.

**Format:**

```
[DD/MM/YYYY]
- <prefix> : <deskripsi> (<hash commit 7 karakter>)
```

**Prefix:** `add` (fitur baru) · `fix` (perbaikan bug) · `update` (ubah yang sudah ada) ·
`remove` (hapus sesuatu) · `security` (perbaikan keamanan) · `docs` (dokumentasi)

---

[02/08/2026]

- add : draft note ke `localStorage` tiap ketikan, dipulihkan lewat prompt restore jika lebih baru dari server (0f5d7e4)
- add : indikator status `Offline — draft saved locally`, auto-retry save saat koneksi kembali (0f5d7e4)
- add : deteksi konflik multi-device — action `update` menolak (409) kalau `updated_at` server berubah sejak load, tawarkan reload atau overwrite (0f5d7e4)
- security : draft localStorage dikecualikan selama note locked masih tergate PIN, aktif lagi begitu ter-unlock di sesi itu (0f5d7e4)

---

[02/08/2026]

- add : CRUD tag (buat, rename, hapus) via form action root, warna dari 7 preset Tailwind (6b3b835)
- add : TagPicker di halaman note — assign/unassign tag existing atau buat baru sekaligus assign (6b3b835)
- add : filter daftar note berdasarkan tag di sidebar, state di URL query `?tag=` (6b3b835)
- add : full-text search via `search_vector`, endpoint `/search` dengan debounce 300ms (6b3b835)
- add : highlight kata cocok di hasil pencarian pakai `ts_headline` (RPC `search_notes_headline`) (6b3b835)
- security : RPC search pakai `security invoker` supaya RLS pemanggil tetap berlaku, bukan `definer` (6b3b835)
- security : snippet note locked tidak pernah dikirim dari endpoint search, konsisten dengan load() biasa (6b3b835)
- security : `sanitizeHeadline()` — whitelist ketat cuma tag `<b>` sebelum `{@html}` di hasil pencarian (6b3b835)
- fix : tag yang tidak lagi dipakai note manapun dihapus otomatis di server, bukan menggantung kosong di daftar filter (6b3b835)

---

[01/08/2026]

- add : editor markdown CodeMirror 6, highlight code block per bahasa (9c47f50)
- add : live preview markdown dengan toggle Edit / Split / Preview, jadi tab di layar sempit (9c47f50)
- security : pipeline `marked()` → `DOMPurify` → `{@html}`, 15 payload XSS diuji dan tidak ada yang lolos (9c47f50)
- security : blokir `<form>`/`<input>` di preview — default DOMPurify meloloskannya, dan note yang berisi form fungsional bisa jadi kotak login palsu (9c47f50)
- security : blokir atribut `style` di preview — bukan eksekusi script, tapi cukup untuk overlay clickjacking di atas tombol Delete (9c47f50)
- security : pengecualian lint `{@html}` di-scope ke MarkdownPreview.svelte saja, file lain tetap gagal lint (9c47f50)
- add : link hasil render dapat `rel="noopener noreferrer"` supaya halaman tujuan tidak pegang `window.opener` (9c47f50)
- fix : editor cuma menyimpan satu huruf — `$effect` sinkronisasi ikut ter-subscribe ke state CodeMirror dan menimpa dokumen tiap ketikan (9c47f50)
- fix : editor dibangun ulang tiap ketikan karena `doc:` membaca state reaktif — diam-diam menghapus undo history (9c47f50)

---

[01/08/2026]

- fix : prompt PIN lock note jadi modal di tengah, sekaligus perbaiki crash saat SSR (5abd731)

---

[01/08/2026]

- add : CRUD note lengkap — sidebar, create/update/delete (soft delete), pin (ba5dd2b)
- add : auto-save debounce 800ms, dipercepat dari Fase 6 atas permintaan (ba5dd2b)
- add : fitur lock note dengan PIN, di luar rencana PLAN.md awal (ba5dd2b)
- security : PIN di-hash pakai scrypt (`node:crypto`), tidak ada dependency baru (ba5dd2b)
- security : content note locked tidak pernah dikirim server via load() biasa — hanya lewat action unlock setelah PIN benar (ba5dd2b)
- fix : auto-save race condition — timer debounce basi bisa menyimpan ke note yang salah saat pindah note cepat (ba5dd2b)

---

[01/08/2026]

- add : login/logout via Supabase Auth dengan form action dan `use:enhance` (9915cc5)
- add : route guard di hooks.server.ts — halaman non-publik redirect ke /login kalau belum login (9915cc5)
- security : safeGetSession() verifikasi JWT lewat getUser(), bukan percaya cookie mentah (9915cc5)
- security : rate limit percobaan login, dikunci per IP+email (9915cc5)

---

[01/08/2026]

- add : migration awal — tabel notes, tags, note_tags dengan index & trigger updated_at (528f037)
- security : RLS aktif di semua tabel, policy owner-only berbasis auth.uid() (528f037)
- security : signup dimatikan di Supabase Auth, akun owner dibuat manual (528f037)
- security : GRANT eksplisit ke anon/authenticated (Automatically expose new tables = OFF by design) (528f037)
- docs : verifikasi RLS via REST API — anon GET /notes balik 200 [] (528f037)

---

[30/07/2026]

- add : scaffold SvelteKit 2 + Svelte 5 runes, TypeScript strict (8c5f21d)
- add : Tailwind 4 dengan plugin typography & forms (8c5f21d)
- add : adapter-vercel, Prettier, ESLint (8c5f21d)
- add : dependency Supabase (@supabase/supabase-js, @supabase/ssr) (8c5f21d)
- add : tipe App.Locals termasuk kontrak safeGetSession, disiapkan untuk Fase 2 (8c5f21d)
- add : .gitattributes normalisasi line ending untuk kerja lintas macOS/Windows (8c5f21d)
- security : .env masuk .gitignore & diverifikasi tidak ikut ter-stage (8c5f21d)
- docs : summary, plan, claude.md, list_done, dan README (8c5f21d)

---

<!--
Contoh pengisian nanti:

[02/08/2026]
- add : markdown live preview dengan sanitasi DOMPurify (c4d8e12)
- fix  : draft localStorage menimpa versi server yang lebih baru (9a2b7f3)

[01/08/2026]
- add : fitur login (a3f9c21)
- security : rate limit percobaan login (b7e1d04)
-->
