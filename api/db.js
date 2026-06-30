// ==========================================
// api/db.js — Koneksi Vercel Postgres
// ==========================================
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL || process.env.POSTGRES_URL);

export { sql };

// Helper response
export function jsonSuccess(res, data = {}, message = 'OK', code = 200) {
    res.status(code).json({ success: true, message, data });
}

export function jsonError(res, message, code = 400) {
    res.status(code).json({ success: false, message });
}

// Ambil body JSON dari request
export function getBody(req) {
    return req.body || {};
}

// Inisialisasi tabel jika belum ada (dipanggil sekali saat cold start)
export async function initDB() {
    await sql`
        CREATE TABLE IF NOT EXISTS users (
            id          SERIAL PRIMARY KEY,
            name        VARCHAR(100) NOT NULL,
            email       VARCHAR(150) NOT NULL UNIQUE,
            password    VARCHAR(255) NOT NULL,
            phone       VARCHAR(20)  DEFAULT '',
            address     TEXT         DEFAULT '',
            city        VARCHAR(100) DEFAULT '',
            postal      VARCHAR(10)  DEFAULT '',
            role        VARCHAR(10)  NOT NULL DEFAULT 'user',
            created_at  TIMESTAMP NOT NULL DEFAULT NOW()
        )
    `;
    await sql`
        CREATE TABLE IF NOT EXISTS products (
            id          SERIAL PRIMARY KEY,
            name        VARCHAR(150) NOT NULL,
            category    VARCHAR(80)  NOT NULL,
            price       INT          NOT NULL DEFAULT 0,
            description TEXT         NOT NULL DEFAULT '',
            image       TEXT         NOT NULL DEFAULT '',
            created_at  TIMESTAMP    NOT NULL DEFAULT NOW()
        )
    `;
    await sql`
        CREATE TABLE IF NOT EXISTS orders (
            id              SERIAL PRIMARY KEY,
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
            paid_at         TIMESTAMP    NULL,
            countdown_end   TIMESTAMP    NULL,
            created_at      TIMESTAMP    NOT NULL DEFAULT NOW()
        )
    `;
    await sql`
        CREATE TABLE IF NOT EXISTS order_items (
            id          SERIAL PRIMARY KEY,
            order_id    VARCHAR(20)  NOT NULL,
            product_id  INT          NULL,
            name        VARCHAR(150) NOT NULL,
            price       INT          NOT NULL DEFAULT 0,
            qty         INT          NOT NULL DEFAULT 1,
            image       TEXT         DEFAULT ''
        )
    `;
    await sql`
        CREATE TABLE IF NOT EXISTS cart (
            id          SERIAL PRIMARY KEY,
            user_id     INT NOT NULL UNIQUE,
            items       JSONB NOT NULL DEFAULT '[]',
            updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
        )
    `;

    // Seed admin & user dummy jika tabel users kosong
    const userCount = await sql`SELECT COUNT(*)::int as cnt FROM users`;
    if (userCount[0].cnt === 0) {
        const hashUser  = '$2a$10$k7RYZMH6VwIUcjRWVHZuyeJRyuLVzHh4oPqJYD80g60/ulKSX/YfK';
        const hashAdmin = '$2a$10$CKW6D3JKS1qJvJQo2CKJ5.hMekQ.VbAFftIKipbQdKVQdxx/9Vvi.';
        const dummyUsers = [
            { name:'Budi Santoso',  email:'budi@email.com',  hash:hashUser,  phone:'081234567890', address:'Jl. Melati No. 12, Kebayoran Baru, Jakarta Selatan', city:'Jakarta',    postal:'12160', role:'user' },
            { name:'Siti Rahayu',   email:'siti@email.com',  hash:hashUser,  phone:'082345678901', address:'Jl. Kenanga No. 5, Dago, Bandung',                  city:'Bandung',    postal:'40135', role:'user' },
            { name:'Andi Wijaya',   email:'andi@email.com',  hash:hashUser,  phone:'083456789012', address:'Jl. Veteran No. 45, Genteng, Surabaya',             city:'Surabaya',   postal:'60271', role:'user' },
            { name:'Dewi Lestari',  email:'dewi@email.com',  hash:hashUser,  phone:'084567890123', address:'Jl. Malioboro No. 88, Gedongtengen, Yogyakarta',    city:'Yogyakarta', postal:'55271', role:'user' },
            { name:'Rizky Pratama', email:'rizky@email.com', hash:hashUser,  phone:'085678901234', address:'Jl. Sudirman No. 100, Medan Baru, Medan',           city:'Medan',      postal:'20154', role:'user' },
            { name:'Admin Tatang',  email:'admin@email.com', hash:hashAdmin, phone:'08999999999',  address:'Toko Kue Tatang',                                   city:'Jakarta',    postal:'12000', role:'admin' },
        ];
        for (const u of dummyUsers) {
            await sql`
                INSERT INTO users (name, email, password, phone, address, city, postal, role)
                VALUES (${u.name}, ${u.email}, ${u.hash}, ${u.phone}, ${u.address}, ${u.city}, ${u.postal}, ${u.role})
                ON CONFLICT (email) DO NOTHING
            `;
        }
    }

    // Seed default products jika kosong
    const prodCount = await sql`SELECT COUNT(*)::int as cnt FROM products`;
    if (prodCount[0].cnt === 0) {
        const defaultProducts = [
            { name:'Kue Lapis Legit Premium', category:'Kue Basah',       price:75000,  desc:'Lapis legit beraroma mentega pilihan premium dengan rempah khas yang harum.',                          image:'https://i.pinimg.com/1200x/d4/f3/c7/d4f3c7eaad1620801712318684b6b534.jpg' },
            { name:'Nastar Keju',             category:'Kue Kering',       price:65000,  desc:'Kue nastar renyah lembut dengan isian selai nanas manis madu dan taburan keju gurih.',                image:'https://i.pinimg.com/736x/88/da/c3/88dac3899943f02c51fe6c95ce664b2f.jpg' },
            { name:'Croissant Cokelat Pastry',category:'Roti & Pastry',    price:18000,  desc:'Pastry ala Perancis yang berlapis renyah di luar, bertekstur lembut di dalam.',                      image:'https://i.pinimg.com/webp87/1200x/34/a0/59/34a059a12664dcae118986a011cd897c.webp' },
            { name:'Kue Black Forest Klasik', category:'Kue Ulang Tahun', price:185000, desc:'Kue spons cokelat kaya rasa berbalut krim segar dan topping parutan dark chocolate murni.',           image:'https://i.pinimg.com/736x/fd/2f/d4/fd2fd4ce9503a7dd5e8e9209d1806911.jpg' },
            { name:'Pie Buah',                category:'Kue Basah',         price:20000,  desc:'Pie buah dengan topping buah-buahan segar dan manis.',                                                image:'https://i.pinimg.com/736x/99/b8/1b/99b81b035b196ddcc8ae4f8e6f15e1b0.jpg' },
            { name:'Brownies Panggang Almond',category:'Roti & Pastry',     price:45000,  desc:'Brownies panggang dengan tekstur fudgy cokelat pekat dipadu renyahnya potongan kacang almond.',      image:'https://i.pinimg.com/1200x/7c/56/12/7c5612a139e38c2b09a8b0622d051749.jpg' },
        ];
        for (const p of defaultProducts) {
            await sql`
                INSERT INTO products (name, category, price, description, image)
                VALUES (${p.name}, ${p.category}, ${p.price}, ${p.desc}, ${p.image})
            `;
        }
    }
}