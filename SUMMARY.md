# NoteChelvyn — Summary

Personal note-taking web app. Single user (owner only). Dibangun untuk menggantikan
Apple Notes / Windows Notepad yang tidak pernah sinkron antar device, tanpa
menitipkan isi catatan ke Google Drive / Notion / Evernote.

---

## Kenapa dibuat

**Masalah nyata:** catatan kerja tersebar di dua device — MacBook dan Windows — dan
tidak pernah selaras. Note di satu mesin tidak ada di mesin lain. Kerja jadi
terhambat karena template kerja yang dipakai sehari-hari tidak selalu ada di
device yang sedang dipegang.

**Kenapa tidak pakai Drive/Notion:** bukan soal fitur — Drive jelas lebih matang.
Alasannya kepemilikan data. Catatan kerja disimpan di database milik sendiri,
bukan di server pihak ketiga yang isinya bisa dipindai atau dipakai untuk hal lain.

**Bonus:** proyek ini sekaligus jadi portofolio publik — bukti kemampuan build
full-stack app (SvelteKit + Postgres + auth + RLS + deploy) yang lahir dari
kebutuhan sendiri, bukan sekadar tutorial yang diikuti.

---

## Apa yang dibangun

Web app yang bisa dibuka dari browser mana pun (MacBook, Windows, HP), login
dengan satu akun, lalu tulis dan baca catatan yang sama di semua device.

**Fitur inti (v1):**

| Fitur           | Deskripsi                                                                                |
| --------------- | ---------------------------------------------------------------------------------------- |
| Login           | Supabase Auth (email + password), signup dimatikan — hanya akun owner yang bisa masuk    |
| Markdown editor | Tulis dalam markdown dengan live preview di sebelahnya                                   |
| Tag + pencarian | Beri tag pada note, cari isi note via Postgres full-text search                          |
| Auto-save       | Note tersimpan otomatis saat mengetik; draft ditahan di localStorage kalau koneksi putus |

**Ditunda ke v2 (roadmap):** template kerja siap pakai, folder/nested notes,
export ke markdown, dark mode, keyboard shortcut, attachment/gambar.

---

## Stack

| Layer     | Pilihan                         | Alasan                                                               |
| --------- | ------------------------------- | -------------------------------------------------------------------- |
| Framework | SvelteKit 2 (Svelte 5)          | SSR + API routes dalam satu codebase, bundle kecil, DX enak          |
| Bahasa    | TypeScript                      | Type safety dari DB sampai UI                                        |
| Database  | Supabase (Postgres)             | Postgres asli + auth + RLS bawaan, free tier cukup untuk single user |
| Auth      | Supabase Auth (`@supabase/ssr`) | Session di httpOnly cookie, aman untuk SSR                           |
| Styling   | Tailwind CSS                    | Cepat, tidak perlu maintain file CSS terpisah                        |
| Editor    | CodeMirror 6                    | Markdown editing, ringan, extensible                                 |
| Deploy    | Vercel (`adapter-vercel`)       | Deploy dari git push, gratis untuk personal                          |

---

## Model keamanan

Ini catatan pribadi berisi materi kerja, jadi keamanannya diperlakukan serius —
bukan sekadar "toh cuma saya yang pakai".

1. **Signup dimatikan** di Supabase dashboard. Akun owner dibuat manual sekali.
   Tanpa ini, endpoint signup Supabase terbuka untuk siapa saja.
2. **Row Level Security (RLS) aktif** di semua tabel, policy `user_id = auth.uid()`.
   Ini pertahanan terakhir: kalau ada bug di kode server, database tetap menolak
   membaca data milik user lain.
3. **`SUPABASE_SERVICE_ROLE_KEY` tidak pernah dipakai** di aplikasi. Key itu
   bypass RLS sepenuhnya. Aplikasi hanya pakai anon key + session user.
4. **Session di httpOnly cookie**, bukan localStorage — token tidak bisa dicuri
   lewat XSS.
5. **Semua akses data lewat `event.locals`**, bukan parameter dari client.
   `user_id` tidak pernah datang dari request body — selalu dari session
   yang sudah diverifikasi server.
6. **Markdown di-sanitize** sebelum di-render. Markdown mengizinkan raw HTML,
   jadi tanpa sanitasi note sendiri bisa jadi vektor stored XSS.
7. **Rate limit** di endpoint login untuk menahan brute force.

---

## Dokumen terkait

- [PLAN.md](PLAN.md) — rencana implementasi bertahap, fase per fase
- [CLAUDE.md](CLAUDE.md) — konvensi kode & aturan kerja untuk AI assistant
- [LIST_DONE.md](LIST_DONE.md) — changelog pekerjaan yang sudah selesai

---

## Status

Belum mulai — dokumen perencanaan disusun 30 Juli 2026. Progres tercatat di
[LIST_DONE.md](LIST_DONE.md).
