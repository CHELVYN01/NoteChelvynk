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
