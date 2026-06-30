# Panduan Deploy ke Vercel

## Persiapan

### 1. Install Vercel CLI
```bash
npm install -g vercel
```

### 2. Install dependencies project
```bash
npm install
```

---

## Deploy ke Vercel

### Langkah 1 — Push ke GitHub

1. Buat repository baru di [github.com](https://github.com)
2. Push project kamu:
```bash
git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/username/toko-kue-tatang.git
git push -u origin main
```

---

### Langkah 2 — Buat Project di Vercel

1. Buka [vercel.com](https://vercel.com) → Login
2. Klik **Add New Project**
3. Import repository GitHub yang baru dibuat
4. Pada bagian **Framework Preset** pilih **Other**
5. Klik **Deploy** (biarkan dulu, kita setup database setelah ini)

---

### Langkah 3 — Setup Vercel Postgres

1. Di dashboard Vercel, buka project kamu
2. Klik tab **Storage**
3. Klik **Create Database** → pilih **Postgres**
4. Beri nama database, misal: `toko-kue-db`
5. Pilih region terdekat (Singapore untuk Indonesia)
6. Klik **Create**
7. Setelah selesai, klik **Connect to Project** → pilih project kamu
8. Klik tab **Settings** di database, lalu salin nilai:
   - `POSTGRES_URL`
   - `POSTGRES_URL_NON_POOLING`
   - (atau klik **Show Secret** untuk melihat semua env vars)

---

### Langkah 4 — Set Environment Variables

1. Di project Vercel, buka **Settings** → **Environment Variables**
2. Tambahkan variable berikut (Vercel Postgres biasanya otomatis menambahkan ini saat connect):

| Variable | Nilai |
|----------|-------|
| `POSTGRES_URL` | (dari Vercel Postgres) |
| `POSTGRES_PRISMA_URL` | (dari Vercel Postgres) |
| `POSTGRES_URL_NON_POOLING` | (dari Vercel Postgres) |
| `POSTGRES_USER` | (dari Vercel Postgres) |
| `POSTGRES_HOST` | (dari Vercel Postgres) |
| `POSTGRES_PASSWORD` | (dari Vercel Postgres) |
| `POSTGRES_DATABASE` | (dari Vercel Postgres) |
| `NODE_ENV` | `production` |

> Kalau sudah connect database ke project, semua variable Postgres biasanya otomatis tersedia.

---

### Langkah 5 — Redeploy

Setelah environment variables diset, redeploy project:
1. Buka tab **Deployments** di Vercel
2. Klik titik tiga (**...**) di deployment terbaru
3. Klik **Redeploy**

Atau push commit baru ke GitHub:
```bash
git commit --allow-empty -m "trigger redeploy"
git push
```

---

### Langkah 6 — Inisialisasi Database

Saat pertama kali dibuka, database akan otomatis diinisialisasi (tabel dibuat + data awal di-seed) melalui fungsi `initDB()` yang dipanggil di setiap API endpoint.

Cukup buka URL project kamu dan coba login — tabel akan terbuat otomatis.

---

## Akun Login

| Role  | Email              | Password  |
|-------|--------------------|-----------|
| User  | budi@email.com     | kue1234   |
| User  | siti@email.com     | kue1234   |
| Admin | admin@email.com    | admin123  |

---

## Struktur File API (Vercel Serverless)

```
api/
├── auth.js       # Login, register, logout, session (cookie-based)
├── products.js   # CRUD produk
├── orders.js     # Buat & kelola pesanan
├── cart.js       # Keranjang belanja
└── db.js         # Koneksi Vercel Postgres + initDB
```

---

## Catatan Penting

- **Session** menggunakan HTTP-only cookie (bukan localStorage)
- **Database** otomatis dibuat saat API pertama kali dipanggil
- **`API_BASE`** di `auth.js` otomatis deteksi environment:
  - `localhost` / Laragon → pakai `api/` (PHP)
  - Vercel → pakai `/api` (JS Serverless)
- Semua tampilan HTML/CSS **tidak berubah**
