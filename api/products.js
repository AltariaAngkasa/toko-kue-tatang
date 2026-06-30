// ==========================================
// api/products.js — CRUD Produk (Vercel Serverless)
// ==========================================
import { sql, jsonSuccess, jsonError, getBody, initDB } from './db.js';
import cookie from 'cookie';

function getSession(req) {
    const cookies = cookie.parse(req.headers.cookie || '');
    if (!cookies.session) return null;
    try {
        return JSON.parse(Buffer.from(cookies.session, 'base64').toString('utf8'));
    } catch { return null; }
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(204).end();

    await initDB();

    const action = req.query.action || '';

    if (action === 'list')   return getProducts(req, res);
    if (action === 'create') return createProduct(req, res);
    if (action === 'update') return updateProduct(req, res);
    if (action === 'delete') return deleteProduct(req, res);

    return jsonError(res, 'Action tidak dikenali', 404);
}

function requireAdmin(req, res) {
    const session = getSession(req);
    if (!session || session.role !== 'admin') {
        jsonError(res, 'Akses ditolak. Hanya admin yang diizinkan.', 403);
        return false;
    }
    return true;
}

// ============================
// Ambil semua produk
// ============================
async function getProducts(req, res) {
    const rows = await sql`SELECT * FROM products ORDER BY id ASC`;
    const products = rows.map(row => ({
        id:       row.id,
        name:     row.name,
        category: row.category,
        price:    row.price,
        desc:     row.description,
        image:    row.image,
    }));
    return jsonSuccess(res, products);
}

// ============================
// Tambah produk
// ============================
async function createProduct(req, res) {
    if (!requireAdmin(req, res)) return;
    if (req.method !== 'POST') return jsonError(res, 'Method not allowed', 405);

    const { name, category, price, desc, image } = getBody(req);
    if (!name || !category || !price || !image) {
        return jsonError(res, 'Semua field wajib diisi.');
    }

    const result = await sql`
        INSERT INTO products (name, category, price, description, image)
        VALUES (${name}, ${category}, ${parseInt(price)}, ${desc || ''}, ${image})
        RETURNING id
    `;
    const newId = result[0].id;

    return jsonSuccess(res, { id: newId, name, category, price: parseInt(price), desc: desc || '', image },
        `Produk "${name}" berhasil ditambahkan!`, 201);
}

// ============================
// Update produk
// ============================
async function updateProduct(req, res) {
    if (!requireAdmin(req, res)) return;
    if (req.method !== 'POST') return jsonError(res, 'Method not allowed', 405);

    const { id, name, category, price, desc, image } = getBody(req);
    if (!id || !name || !category || !price || !image) {
        return jsonError(res, 'Data tidak valid atau field wajib kosong.');
    }

    await sql`
        UPDATE products SET name=${name}, category=${category}, price=${parseInt(price)},
        description=${desc || ''}, image=${image} WHERE id=${parseInt(id)}
    `;

    return jsonSuccess(res, { id: parseInt(id) }, `Produk "${name}" berhasil diubah!`);
}

// ============================
// Hapus produk
// ============================
async function deleteProduct(req, res) {
    if (!requireAdmin(req, res)) return;
    if (req.method !== 'POST') return jsonError(res, 'Method not allowed', 405);

    const { id } = getBody(req);
    if (!id) return jsonError(res, 'ID produk tidak valid.');

    const check = await sql`SELECT name FROM products WHERE id = ${parseInt(id)}`;
    if (check.length === 0) return jsonError(res, 'Produk tidak ditemukan.', 404);
    const prodName = check[0].name;

    await sql`DELETE FROM products WHERE id = ${parseInt(id)}`;
    return jsonSuccess(res, {}, `Produk "${prodName}" berhasil dihapus.`);
}