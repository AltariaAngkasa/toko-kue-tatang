// ==========================================
// api/orders.js — Manajemen Pesanan (Vercel Serverless)
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
    const action  = req.query.action || '';

    if (action === 'create')        return createOrder(req, res, session);
    if (action === 'list')          return listOrders(req, res, session);
    if (action === 'all')           return listAllOrders(req, res, session);
    if (action === 'get')           return getOrder(req, res, session);
    if (action === 'update_status') return updateStatus(req, res, session);
    if (action === 'inject_demo')   return injectDemoOrders(req, res, session);

    return jsonError(res, 'Action tidak dikenali', 404);
}

// ============================
// Buat pesanan baru
// ============================
async function createOrder(req, res, session) {
    if (!session) return jsonError(res, 'Silakan login terlebih dahulu.', 401);
    if (req.method !== 'POST') return jsonError(res, 'Method not allowed', 405);

    const body = getBody(req);
    const { orderId, items, subtotal, shipping, serviceFee, discount, total,
            courier, courierEta, address, note, countdownEnd } = body;

    if (!orderId || !items || !total) return jsonError(res, 'Data pesanan tidak lengkap.');

    const userId = session.id;
    const cdEnd  = countdownEnd ? new Date(countdownEnd).toISOString() : new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

    await sql`
        INSERT INTO orders
        (order_id, user_id, user_email, subtotal, shipping, service_fee, discount, total,
         courier, courier_eta, addr_name, addr_phone, addr_full, addr_city, addr_postal,
         note, status, countdown_end)
        VALUES
        (${orderId}, ${userId}, ${session.email}, ${subtotal||0}, ${shipping||0}, ${serviceFee||2000},
         ${discount||0}, ${total}, ${courier||''}, ${courierEta||''},
         ${address?.name||''}, ${address?.phone||''}, ${address?.full||''},
         ${address?.city||''}, ${address?.postal||''},
         ${note||''}, 'Menunggu Pembayaran', ${cdEnd})
    `;

    for (const item of items) {
        await sql`
            INSERT INTO order_items (order_id, product_id, name, price, qty, image)
            VALUES (${orderId}, ${item.id||null}, ${item.name||''}, ${item.price||0}, ${item.qty||1}, ${item.image||''})
        `;
    }

    return jsonSuccess(res, { orderId }, 'Pesanan berhasil dibuat!', 201);
}

// ============================
// List pesanan milik user
// ============================
async function listOrders(req, res, session) {
    if (!session) return jsonError(res, 'Silakan login terlebih dahulu.', 401);

    const rows = await sql`SELECT * FROM orders WHERE user_id = ${session.id} ORDER BY created_at DESC`;
    return jsonSuccess(res, await formatOrders(rows));
}

// ============================
// Semua pesanan (admin)
// ============================
async function listAllOrders(req, res, session) {
    if (!session || session.role !== 'admin') return jsonError(res, 'Akses ditolak.', 403);

    const rows = await sql`SELECT * FROM orders ORDER BY created_at DESC`;
    return jsonSuccess(res, await formatOrders(rows));
}

// ============================
// Detail satu pesanan
// ============================
async function getOrder(req, res, session) {
    if (!session) return jsonError(res, 'Silakan login terlebih dahulu.', 401);

    const orderId = req.query.order_id || '';
    if (!orderId) return jsonError(res, 'order_id wajib diisi.');

    const rows  = await sql`SELECT * FROM orders WHERE order_id = ${orderId} LIMIT 1`;
    const order = rows[0];
    if (!order) return jsonError(res, 'Pesanan tidak ditemukan.', 404);

    if (session.role !== 'admin' && order.user_id !== session.id) {
        return jsonError(res, 'Akses ditolak.', 403);
    }

    const formatted = await formatOrders([order]);
    return jsonSuccess(res, formatted[0]);
}

// ============================
// Update status pesanan
// ============================
async function updateStatus(req, res, session) {
    if (!session) return jsonError(res, 'Silakan login terlebih dahulu.', 401);
    if (req.method !== 'POST') return jsonError(res, 'Method not allowed', 405);

    const { orderId, status } = getBody(req);
    const allowed = ['Menunggu Pembayaran','Diproses','Dikirim','Selesai','Dibatalkan'];
    if (!allowed.includes(status)) return jsonError(res, 'Status tidak valid.');

    const check = await sql`SELECT * FROM orders WHERE order_id = ${orderId} LIMIT 1`;
    const order  = check[0];
    if (!order) return jsonError(res, 'Pesanan tidak ditemukan.', 404);

    if (session.role !== 'admin' && order.user_id !== session.id) {
        return jsonError(res, 'Akses ditolak.', 403);
    }

    if (['Diproses', 'Dikirim'].includes(status)) {
        await sql`UPDATE orders SET status=${status}, paid_at=NOW() WHERE order_id=${orderId}`;
    } else {
        await sql`UPDATE orders SET status=${status} WHERE order_id=${orderId}`;
    }

    return jsonSuccess(res, { orderId, status }, 'Status berhasil diperbarui.');
}

// ============================
// Inject demo orders
// ============================
async function injectDemoOrders(req, res, session) {
    if (!session) return jsonError(res, 'Silakan login terlebih dahulu.', 401);
    if (req.method !== 'POST') return jsonError(res, 'Method not allowed', 405);

    const count = await sql`SELECT COUNT(*)::int as cnt FROM orders WHERE user_id = ${session.id}`;
    if (count[0].cnt > 0) return jsonSuccess(res, [], 'Sudah ada pesanan.');

    const demoOrders = [
        {
            orderId: '8472639104', subtotal: 205000, shipping: 15000, serviceFee: 2000,
            discount: 0, total: 222000, courier: 'JNE', courierEta: '2-3 hari kerja',
            status: 'Selesai', paidAt: new Date(Date.now() - 7*24*60*60*1000 + 30*60*1000),
            createdAt: new Date(Date.now() - 7*24*60*60*1000),
            items: [
                { id:1, name:'Kue Lapis Legit Premium', qty:1, price:75000, image:'https://i.pinimg.com/1200x/d4/f3/c7/d4f3c7eaad1620801712318684b6b534.jpg' },
                { id:2, name:'Nastar Keju', qty:2, price:65000, image:'https://i.pinimg.com/736x/88/da/c3/88dac3899943f02c51fe6c95ce664b2f.jpg' },
            ],
        },
        {
            orderId: '3819204756', subtotal: 185000, shipping: 25000, serviceFee: 2000,
            discount: 10000, total: 202000, courier: 'J&T', courierEta: '1-2 hari kerja',
            status: 'Dikirim', paidAt: new Date(Date.now() - 2*24*60*60*1000 + 45*60*1000),
            createdAt: new Date(Date.now() - 2*24*60*60*1000),
            items: [
                { id:4, name:'Kue Black Forest Klasik', qty:1, price:185000, image:'https://i.pinimg.com/736x/fd/2f/d4/fd2fd4ce9503a7dd5e8e9209d1806911.jpg' },
            ],
        },
        {
            orderId: '5604817239', subtotal: 54000, shipping: 15000, serviceFee: 2000,
            discount: 0, total: 71000, courier: 'JNE', courierEta: '2-3 hari kerja',
            status: 'Menunggu Pembayaran', paidAt: null,
            createdAt: new Date(Date.now() - 20*60*1000),
            countdownEnd: new Date(Date.now() + 100*60*1000),
            items: [
                { id:3, name:'Croissant Cokelat Pastry', qty:3, price:18000, image:'https://i.pinimg.com/webp87/1200x/34/a0/59/34a059a12664dcae118986a011cd897c.webp' },
            ],
        },
    ];

    for (const o of demoOrders) {
        const cdEnd = o.countdownEnd ? o.countdownEnd.toISOString() : null;
        await sql`
            INSERT INTO orders
            (order_id, user_id, user_email, subtotal, shipping, service_fee, discount, total,
             courier, courier_eta, addr_name, addr_phone, addr_full, addr_city, addr_postal,
             note, status, paid_at, countdown_end, created_at)
            VALUES
            (${o.orderId}, ${session.id}, ${session.email}, ${o.subtotal}, ${o.shipping},
             ${o.serviceFee}, ${o.discount}, ${o.total}, ${o.courier}, ${o.courierEta},
             ${session.name}, ${session.phone||''}, ${session.address||''},
             ${session.city||''}, ${session.postal||''},
             '', ${o.status}, ${o.paidAt}, ${cdEnd}, ${o.createdAt.toISOString()})
            ON CONFLICT (order_id) DO NOTHING
        `;
        for (const item of o.items) {
            await sql`
                INSERT INTO order_items (order_id, product_id, name, price, qty, image)
                VALUES (${o.orderId}, ${item.id}, ${item.name}, ${item.price}, ${item.qty}, ${item.image})
                ON CONFLICT DO NOTHING
            `;
        }
    }

    return jsonSuccess(res, [], 'Demo orders berhasil diinjeksi.');
}

// ============================
// Format orders dari DB ke format JS
// ============================
async function formatOrders(orders) {
    if (!orders.length) return [];

    const orderIds   = orders.map(o => o.order_id);
    const itemRows = await sql`SELECT * FROM order_items WHERE order_id = ANY(${orderIds})`;

    const itemsMap = {};
    for (const item of itemRows) {
        if (!itemsMap[item.order_id]) itemsMap[item.order_id] = [];
        itemsMap[item.order_id].push({
            id:    item.product_id,
            name:  item.name,
            price: item.price,
            qty:   item.qty,
            image: item.image,
        });
    }

    return orders.map(o => ({
        orderId:      o.order_id,
        userId:       o.user_id,
        userEmail:    o.user_email,
        subtotal:     o.subtotal,
        shipping:     o.shipping,
        serviceFee:   o.service_fee,
        discount:     o.discount,
        total:        o.total,
        courier:      o.courier,
        courierEta:   o.courier_eta,
        address: {
            name:   o.addr_name,
            phone:  o.addr_phone,
            full:   o.addr_full,
            city:   o.addr_city,
            postal: o.addr_postal,
        },
        note:         o.note,
        status:       o.status,
        paidAt:       o.paid_at,
        countdownEnd: o.countdown_end,
        createdAt:    o.created_at,
        items:        itemsMap[o.order_id] || [],
    }));
}