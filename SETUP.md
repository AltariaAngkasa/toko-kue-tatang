# Setup Toko Kue Tatang — PHP + MySQL

## Persyaratan
- PHP 8.0+
- MySQL 5.7+ / MariaDB 10.3+
- Web server (Laragon, XAMPP, atau Apache)

---

## 1. Import Database

Buka phpMyAdmin atau MySQL CLI, lalu jalankan:

```sql
source /path/to/tokokuetatang/database/schema.sql
```

Atau buka file `database/schema.sql` di phpMyAdmin → Import.

Ini akan membuat:
- Database `toko_kue_tatang`
- Semua tabel (users, products, orders, order_items, cart)
- Data awal: 5 akun user + 1 admin + 6 produk default

---

## 2. Konfigurasi Database

Buka file `config/database.php` dan sesuaikan:

```php
define('DB_HOST', 'localhost');
define('DB_USER', 'root');      // username MySQL kamu
define('DB_PASS', '');          // password MySQL kamu
define('DB_NAME', 'toko_kue_tatang');
define('DB_PORT', 3306);
```

---

## 3. Jalankan via Laragon / XAMPP

Pastikan folder project ada di:
- Laragon: `C:/laragon/www/tokokuetatang/`
- XAMPP:   `C:/xampp/htdocs/tokokuetatang/`

Akses di browser: `http://localhost/tokokuetatang/`

---

## 4. Akun Login

| Role  | Email              | Password  |
|-------|--------------------|-----------|
| User  | budi@email.com     | kue1234   |
| User  | siti@email.com     | kue1234   |
| User  | andi@email.com     | kue1234   |
| User  | dewi@email.com     | kue1234   |
| User  | rizky@email.com    | kue1234   |
| Admin | admin@email.com    | admin123  |

---

## Struktur File

```
tokokuetatang/
├── api/
│   ├── auth.php        # Login, register, logout, session
│   ├── products.php    # CRUD produk
│   ├── orders.php      # Buat & kelola pesanan
│   └── cart.php        # Keranjang belanja server-side
├── config/
│   └── database.php    # Koneksi PDO MySQL
├── database/
│   └── schema.sql      # Schema & data awal
├── auth.js             # Autentikasi via PHP session
├── script.js           # Produk & cart via API
├── checkout.js         # Checkout via API
├── payment.js          # Update status via API
├── history.js          # Riwayat pesanan via API
├── admin.js            # Dashboard admin via API
└── ...HTML & CSS files
```

---

## Catatan

- Session PHP digunakan untuk autentikasi (bukan localStorage)
- Cart disimpan di server (tabel `cart`) untuk user yang login
- Semua data produk, pesanan, dan user tersimpan di MySQL
- Tampilan HTML/CSS tidak berubah dari versi sebelumnya
