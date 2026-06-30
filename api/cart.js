// ==========================================
// api/cart.js — Keranjang Belanja (Vercel Serverless)
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

    const session = getSession(req);
    if (!session) return jsonError(res, 'Silakan login terlebih dahulu.', 401);

    const action = req.query.action || '';

    if (action === 'get')   return getCart(req, res, session);
    if (action === 'save')  return saveCart(req, res, session);
    if (action === 'clear') return clearCart(req, res, session);

    return jsonError(res, 'Action tidak dikenali', 404);
}

// ============================
// Ambil cart milik user
// ============================
async function getCart(req, res, session) {
    const rows  = await sql`SELECT items FROM cart WHERE user_id = ${session.id} LIMIT 1`;
    const items = rows[0] ? rows[0].items : [];
    return jsonSuccess(res, items);
}

// ============================
// Simpan cart
// ============================
async function saveCart(req, res, session) {
    if (req.method !== 'POST') return jsonError(res, 'Method not allowed', 405);

    const { items } = getBody(req);
    if (!Array.isArray(items)) return jsonError(res, 'Format items tidak valid.');

    await sql`
        INSERT INTO cart (user_id, items, updated_at)
        VALUES (${session.id}, ${JSON.stringify(items)}, NOW())
        ON CONFLICT (user_id)
        DO UPDATE SET items = ${JSON.stringify(items)}, updated_at = NOW()
    `;

    return jsonSuccess(res, { count: items.length }, 'Keranjang berhasil disimpan.');
}

// ============================
// Kosongkan cart
// ============================
async function clearCart(req, res, session) {
    if (req.method !== 'POST') return jsonError(res, 'Method not allowed', 405);

    await sql`UPDATE cart SET items = '[]', updated_at = NOW() WHERE user_id = ${session.id}`;
    return jsonSuccess(res, [], 'Keranjang berhasil dikosongkan.');
}