-- ==========================================
-- Schema Database Toko Kue Tatang
-- ==========================================

CREATE DATABASE IF NOT EXISTS toko_kue_tatang CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE toko_kue_tatang;

-- ==========================================
-- Tabel Users
-- ==========================================
CREATE TABLE IF NOT EXISTS users (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    email       VARCHAR(150) NOT NULL UNIQUE,
    password    VARCHAR(255) NOT NULL,
    phone       VARCHAR(20)  DEFAULT '',
    address     TEXT         DEFAULT '',
    city        VARCHAR(100) DEFAULT '',
    postal      VARCHAR(10)  DEFAULT '',
    role        ENUM('user','admin') NOT NULL DEFAULT 'user',
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ==========================================
-- Tabel Products
-- ==========================================
CREATE TABLE IF NOT EXISTS products (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(150) NOT NULL,
    category    VARCHAR(80)  NOT NULL,
    price       INT          NOT NULL DEFAULT 0,
    description TEXT         NOT NULL,
    image       TEXT         NOT NULL,
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ==========================================
-- Tabel Orders
-- ==========================================
CREATE TABLE IF NOT EXISTS orders (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    order_id        VARCHAR(20)  NOT NULL UNIQUE,
    user_id         INT          NOT NULL,
    user_email      VARCHAR(150) DEFAULT '',
    subtotal        INT          NOT NULL DEFAULT 0,
    shipping        INT          NOT NULL DEFAULT 0,
    service_fee     INT          NOT NULL DEFAULT 0,
    discount        INT          NOT NULL DEFAULT 0,
    total           INT          NOT NULL DEFAULT 0,
    courier         VARCHAR(50)  DEFAULT '',
    courier_eta     VARCHAR(50)  DEFAULT '',
    addr_name       VARCHAR(100) DEFAULT '',
    addr_phone      VARCHAR(20)  DEFAULT '',
    addr_full       TEXT         DEFAULT '',
    addr_city       VARCHAR(100) DEFAULT '',
    addr_postal     VARCHAR(10)  DEFAULT '',
    note            TEXT         DEFAULT '',
    status          VARCHAR(50)  NOT NULL DEFAULT 'Menunggu Pembayaran',
    paid_at         DATETIME     NULL,
    countdown_end   DATETIME     NULL,
    created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ==========================================
-- Tabel Order Items
-- ==========================================
CREATE TABLE IF NOT EXISTS order_items (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    order_id    VARCHAR(20)  NOT NULL,
    product_id  INT          NULL,
    name        VARCHAR(150) NOT NULL,
    price       INT          NOT NULL DEFAULT 0,
    qty         INT          NOT NULL DEFAULT 1,
    image       TEXT         DEFAULT '',
    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ==========================================
-- Tabel Cart (per user, server-side)
-- ==========================================
CREATE TABLE IF NOT EXISTS cart (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    user_id     INT NOT NULL UNIQUE,
    items       JSON NOT NULL DEFAULT ('[]'),
    updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ==========================================
-- Data Awal: Admin & Akun Dummy
-- ==========================================
INSERT IGNORE INTO users (id, name, email, password, phone, address, city, postal, role) VALUES
(1,  'Budi Santoso',  'budi@email.com',  '$2y$10$k7RYZMH6VwIUcjRWVHZuyeJRyuLVzHh4oPqJYD80g60/ulKSX/YfK', '081234567890', 'Jl. Melati No. 12, Kebayoran Baru, Jakarta Selatan', 'Jakarta',     '12160', 'user'),
(2,  'Siti Rahayu',   'siti@email.com',  '$2y$10$k7RYZMH6VwIUcjRWVHZuyeJRyuLVzHh4oPqJYD80g60/ulKSX/YfK', '082345678901', 'Jl. Kenanga No. 5, Dago, Bandung',                  'Bandung',     '40135', 'user'),
(3,  'Andi Wijaya',   'andi@email.com',  '$2y$10$k7RYZMH6VwIUcjRWVHZuyeJRyuLVzHh4oPqJYD80g60/ulKSX/YfK', '083456789012', 'Jl. Veteran No. 45, Genteng, Surabaya',              'Surabaya',    '60271', 'user'),
(4,  'Dewi Lestari',  'dewi@email.com',  '$2y$10$k7RYZMH6VwIUcjRWVHZuyeJRyuLVzHh4oPqJYD80g60/ulKSX/YfK', '084567890123', 'Jl. Malioboro No. 88, Gedongtengen, Yogyakarta',    'Yogyakarta',  '55271', 'user'),
(5,  'Rizky Pratama', 'rizky@email.com', '$2y$10$k7RYZMH6VwIUcjRWVHZuyeJRyuLVzHh4oPqJYD80g60/ulKSX/YfK', '085678901234', 'Jl. Sudirman No. 100, Medan Baru, Medan',            'Medan',       '20154', 'user'),
(99, 'Admin Tatang',  'admin@email.com', '$2y$10$CKW6D3JKS1qJvJQo2CKJ5.hMekQ.VbAFftIKipbQdKVQdxx/9Vvi.', '08999999999',  'Toko Kue Tatang',                                   'Jakarta',     '12000', 'admin');
-- Password untuk user biasa: kue1234
-- Password untuk admin: admin123

-- ==========================================
-- Data Awal: Produk Default
-- ==========================================
INSERT IGNORE INTO products (id, name, category, price, description, image) VALUES
(1, 'Kue Lapis Legit Premium', 'Kue Basah',        75000,  'Lapis legit beraroma mentega pilihan premium dengan rempah khas yang harum.',                                                      'https://i.pinimg.com/1200x/d4/f3/c7/d4f3c7eaad1620801712318684b6b534.jpg'),
(2, 'Nastar Keju',             'Kue Kering',        65000,  'Kue nastar renyah lembut dengan isian selai nanas manis madu dan taburan keju gurih.',                                             'https://i.pinimg.com/736x/88/da/c3/88dac3899943f02c51fe6c95ce664b2f.jpg'),
(3, 'Croissant Cokelat Pastry','Roti & Pastry',     18000,  'Pastry ala Perancis yang berlapis renyah di luar, bertekstur lembut di dalam.',                                                    'https://i.pinimg.com/webp87/1200x/34/a0/59/34a059a12664dcae118986a011cd897c.webp'),
(4, 'Kue Black Forest Klasik', 'Kue Ulang Tahun',  185000,  'Kue spons cokelat kaya rasa berbalut krim segar dan topping parutan dark chocolate murni.',                                        'https://i.pinimg.com/736x/fd/2f/d4/fd2fd4ce9503a7dd5e8e9209d1806911.jpg'),
(5, 'Pie Buah',                'Kue Basah',          20000,  'Pie buah dengan topping buah-buahan segar dan manis.',                                                                             'https://i.pinimg.com/736x/99/b8/1b/99b81b035b196ddcc8ae4f8e6f15e1b0.jpg'),
(6, 'Brownies Panggang Almond','Roti & Pastry',      45000,  'Brownies panggang dengan tekstur fudgy cokelat pekat dipadu renyahnya potongan kacang almond.',                                   'https://i.pinimg.com/1200x/7c/56/12/7c5612a139e38c2b09a8b0622d051749.jpg');