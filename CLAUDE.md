## Project Configuration

- **Language**: TypeScript
- **Package Manager**: npm
- **Add-ons**: none

---

# CLAUDE.md — NoteChelvyn

Panduan kerja untuk AI assistant di repo ini. Baca ini sebelum menulis kode.

Konteks proyek: [SUMMARY.md](SUMMARY.md) · Rencana: [PLAN.md](PLAN.md) ·
Changelog: [LIST_DONE.md](LIST_DONE.md)

---

## Tentang proyek ini

Aplikasi note pribadi **single user**. Bukan produk multi-tenant, tidak ada
sistem sharing, tidak ada tim. Kalau ada permintaan fitur yang mengasumsikan
banyak user (share note, kolaborasi, permission role), tanyakan dulu — kemungkinan
besar itu salah paham soal scope.

Sekaligus dipakai sebagai portofolio publik. Artinya kode harus rapi dan history
git harus terbaca — bukan sekadar "yang penting jalan".

---

## Stack

- **SvelteKit 2** + **Svelte 5** (runes: `$state`, `$derived`, `$effect`, `$props`)
- **TypeScript** — mode strict
- **Supabase** (Postgres + Auth + RLS) via `@supabase/ssr`
- **Tailwind CSS**
- **CodeMirror 6** untuk editor markdown
- Deploy: **Vercel** (`adapter-vercel`)

---

## Aturan keamanan — non-negotiable

Ini catatan kerja pribadi. Aturan di bawah tidak boleh dilanggar dengan alasan
"toh cuma dipakai sendiri".

### 1. `user_id` selalu dari session, tidak pernah dari client

```ts
// ❌ SALAH — siapa pun bisa menulis atas nama user lain
const { user_id, content } = await request.json();
await supabase.from('notes').insert({ user_id, content });

// ✅ BENAR — identitas datang dari session terverifikasi
const { user } = await locals.safeGetSession();
if (!user) throw error(401);
await supabase.from('notes').insert({ user_id: user.id, content });
```

### 2. `getUser()`, bukan `getSession()`, untuk keputusan otorisasi

`getSession()` di server membaca cookie tanpa memverifikasi tanda tangan JWT —
cookie palsu akan lolos. `getUser()` memverifikasi ke server auth Supabase.
Selalu lewat `locals.safeGetSession()` yang sudah membungkus ini.

### 3. `SUPABASE_SERVICE_ROLE_KEY` tidak dipakai di kode aplikasi

Key itu mem-bypass RLS sepenuhnya. Kalau ada task yang "butuh" service role,
berhenti dan tanyakan — hampir selalu ada cara lain lewat RLS policy.

### 4. RLS aktif di setiap tabel baru

Tabel baru tanpa RLS = tabel yang terbuka lewat API Supabase. Tambahkan
`enable row level security` + policy `auth.uid()` di migration yang sama, bukan
"nanti".

### 5. Sanitasi HTML sebelum `{@html}`

Markdown mengizinkan raw HTML. Selalu `marked()` → `DOMPurify.sanitize()` →
`{@html}`. Jangan pernah `{@html}` langsung dari konten user.

```ts
// src/lib/utils/markdown.ts
import { marked } from 'marked';
import DOMPurify from 'isomorphic-dompurify';

export function renderMarkdown(md: string): string {
	return DOMPurify.sanitize(marked.parse(md) as string);
}
```

### 6. Secret hanya di `$env/static/private` atau `$env/dynamic/private`

Jangan pernah `PUBLIC_` untuk sesuatu yang rahasia — prefix itu membuat nilainya
ikut ter-bundle ke browser. Kode yang menyentuh secret ditaruh di
`src/lib/server/`, yang diblokir SvelteKit dari bundle client.

### 7. Validasi input di server

Client-side validation itu UX, bukan keamanan. Form action bisa dipanggil
langsung lewat `curl`. Batasi panjang judul/konten di server.

---

## Konvensi kode

### Svelte 5 runes, bukan sintaks lama

```svelte
<!-- ✅ -->
<script lang="ts">
	let { note }: { note: Note } = $props();
	let draft = $state(note.content);
	let wordCount = $derived(draft.trim().split(/\s+/).filter(Boolean).length);
</script>

<!-- ❌ jangan pakai export let / $: / stores untuk state lokal -->
```

### Ambil data di `+page.server.ts`, bukan `onMount`

Data yang butuh auth harus di-load di server. Fetch dari `onMount` berarti
halaman ter-render dulu baru datanya datang — dan logika auth-nya jadi ada di client.

### Mutasi lewat form action, bukan `fetch` manual

Form action jalan tanpa JS, dapat progressive enhancement dari `use:enhance`,
dan penanganan error-nya sudah baku. Pakai `+server.ts` hanya kalau memang
butuh endpoint JSON.

### TypeScript

- Tanpa `any`. Kalau tipenya belum jelas, pakai `unknown` lalu persempit.
- Tipe DB di `src/lib/types.ts`, di-generate dari Supabase kalau memungkinkan:
  `npx supabase gen types typescript --project-id <id> > src/lib/types.ts`

### Penamaan

| Jenis         | Gaya            | Contoh                      |
| ------------- | --------------- | --------------------------- |
| Komponen      | PascalCase      | `NoteCard.svelte`           |
| Util / helper | camelCase       | `renderMarkdown.ts`         |
| Route         | kebab-case      | `src/routes/note/[id]/`     |
| Kolom DB      | snake_case      | `is_archived`, `updated_at` |
| Env var       | SCREAMING_SNAKE | `PUBLIC_SUPABASE_URL`       |

### Error handling

Jangan telan error diam-diam. Tampilkan pesan yang bisa dipahami manusia, dan
log detail teknisnya ke server. Jangan bocorkan detail internal database ke UI.

---

## Alur kerja

### Sebelum mulai

1. Baca [PLAN.md](PLAN.md), kerjakan fase paling awal yang belum selesai
2. Jangan lompat fase — tiap fase bergantung pada yang sebelumnya
3. Kalau ada permintaan di luar rencana, tanyakan apakah masuk v1 atau roadmap

### Setelah selesai

1. `npm run check` (svelte-check) dan `npm run lint` harus bersih
2. Tes manual di browser — jangan lapor selesai kalau belum dibuka
3. Commit dengan pesan konvensional (lihat bawah)
4. **Update [LIST_DONE.md](LIST_DONE.md)** dengan hash commit

### Format commit

```
<type>: <deskripsi singkat>

type: feat | fix | refactor | style | docs | chore | security
```

Contoh: `feat: add markdown live preview with DOMPurify sanitization`

### Format LIST_DONE.md

```markdown
[30/07/2026]

- add : fitur login (a3f9c21)
- fix : session tidak persist setelah refresh (b7e1d04)
```

Prefix: `add` (fitur baru) · `fix` (perbaikan bug) · `update` (ubah yang sudah ada) ·
`remove` (hapus) · `security` (perbaikan keamanan).
Tanggal `DD/MM/YYYY`, terbaru di atas. Selalu sertakan 7 karakter pertama hash commit.

---

## Yang tidak boleh dilakukan tanpa bertanya

- Menambah dependency baru — cek dulu apakah bisa dengan yang sudah ada
- Mengubah skema database — migration harus direview dulu
- `git push`, deploy, atau apa pun yang keluar ke publik
- `DROP`, `TRUNCATE`, atau apa pun yang menghapus data
- Menonaktifkan RLS, meskipun cuma "sementara buat debug"
- Commit `.env` atau nilai key apa pun
- Menambah fitur yang tidak ada di [PLAN.md](PLAN.md)

### Eksekusi selalu di tangan user

AI assistant di repo ini **hanya menulis dan menyiapkan kode** — tidak pernah
menjalankan perintah eksekusi apa pun sendiri (`npm run dev`, `npm run build`,
`npm install`, `git push`, deploy, migration, dsb). Semua perintah yang
menjalankan/mengubah sesuatu di luar mengedit file harus dijalankan oleh user
sendiri di terminalnya. AI boleh **menyarankan** perintah persis yang perlu
dijalankan (dengan penjelasan kenapa), tapi keputusan dan eksekusinya di
tangan user sepenuhnya — ini soal kemitraan kerja, bukan cuma soal keamanan.

**Alasan:** debugging deploy Vercel Fase 7 (02/08/2026) berputar-putar karena
AI menjalankan `npm install`, mengubah `vite.config.ts` bolak-balik, dan
membuat asumsi soal apa yang "sudah pernah dites" tanpa user yang benar-benar
mengonfirmasi tiap langkah — user harus terus-menerus mengoreksi ("sudah
pernah deploy dari fase 1", "masih error", dst) karena AI mengeksekusi
duluan lalu baru bertanya, bukan sebaliknya.

---

## Bahasa

- Komentar kode, nama variabel, pesan commit: **English**
- Penjelasan ke user: **Bahasa Indonesia** dengan istilah teknis tetap English
- UI aplikasi: **English** (lebih baik untuk portofolio publik)
