// ==========================================
// api/auth.js — Autentikasi (Vercel Serverless)
// ==========================================
import { sql, jsonSuccess, jsonError, getBody, initDB } from './db.js';
import bcrypt from 'bcryptjs';
import cookie from 'cookie';

// Simple session store pakai signed cookie + Vercel Postgres
// Session disimpan sebagai JSON di cookie (httpOnly)

function getSession(req) {
    const cookies = cookie.parse(req.headers.cookie || '');
    if (!cookies.session) return null;
    try {
        const decoded = Buffer.from(cookies.session, 'base64').toString('utf8');
        return JSON.parse(decoded);
    } catch {
        return null;
    }
}

function setSessionCookie(res, userData) {
    const payload = Buffer.from(JSON.stringify(userData)).toString('base64');
    const cookieStr = cookie.serialize('session', payload, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7 hari
        path: '/'
    });
    res.setHeader('Set-Cookie', cookieStr);
}

function clearSessionCookie(res) {
    const cookieStr = cookie.serialize('session', '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 0,
        path: '/'
    });
    res.setHeader('Set-Cookie', cookieStr);
}

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(204).end();

    await initDB();

    const action = req.query.action || '';

    if (action === 'login')   return handleLogin(req, res);
    if (action === 'register') return handleRegister(req, res);
    if (action === 'logout')  return handleLogout(req, res);
    if (action === 'session') return handleSession(req, res);

    return jsonError(res, 'Action tidak dikenali', 404);
}

// ============================
// Login
// ============================
async function handleLogin(req, res) {
    if (req.method !== 'POST') return jsonError(res, 'Method not allowed', 405);

    const { email, password } = getBody(req);
    if (!email || !password) return jsonError(res, 'Email dan password wajib diisi.');

    const rows = await sql`SELECT * FROM users WHERE email = ${email.toLowerCase().trim()} LIMIT 1`;
    const user  = rows[0];

    if (!user || !bcrypt.compareSync(password, user.password)) {
        return jsonError(res, 'Email atau password salah. Periksa kembali dan coba lagi.', 401);
    }

    const sessionData = {
        id:      user.id,
        name:    user.name,
        email:   user.email,
        phone:   user.phone,
        address: user.address,
        city:    user.city,
        postal:  user.postal,
        role:    user.role,
    };

    setSessionCookie(res, sessionData);
    return jsonSuccess(res, sessionData, `Selamat datang, ${user.name}!`);
}

// ============================
// Register
// ============================
async function handleRegister(req, res) {
    if (req.method !== 'POST') return jsonError(res, 'Method not allowed', 405);

    const { name, email, phone, password } = getBody(req);

    if (!name || !name.trim())           return jsonError(res, 'Nama lengkap tidak boleh kosong!');
    if (!password || password.length < 6) return jsonError(res, 'Password minimal 6 karakter!');
    if (!email || !email.includes('@'))   return jsonError(res, 'Format email tidak valid!');

    const cleanEmail = email.toLowerCase().trim();

    // Cek email sudah terdaftar
    const existing = await sql`SELECT id FROM users WHERE email = ${cleanEmail} LIMIT 1`;
    if (existing.length > 0) return jsonError(res, 'Email sudah terdaftar. Silakan login!');

    const hashed = bcrypt.hashSync(password, 10);
    const insert = await sql`
        INSERT INTO users (name, email, password, phone, address, city, postal, role)
        VALUES (${name.trim()}, ${cleanEmail}, ${hashed}, ${phone || ''}, '', '', '', 'user')
        RETURNING id
    `;
    const newId = insert[0].id;

    const sessionData = {
        id:      newId,
        name:    name.trim(),
        email:   cleanEmail,
        phone:   phone || '',
        address: '',
        city:    '',
        postal:  '',
        role:    'user',
    };

    setSessionCookie(res, sessionData);
    return jsonSuccess(res, sessionData, `Akun berhasil dibuat! Selamat datang, ${name.trim()}!`, 201);
}

// ============================
// Logout
// ============================
async function handleLogout(req, res) {
    clearSessionCookie(res);
    return jsonSuccess(res, {}, 'Berhasil logout.');
}

// ============================
// Get Session
// ============================
async function handleSession(req, res) {
    const session = getSession(req);
    if (!session) return jsonError(res, 'Tidak ada sesi aktif.', 401);
    return jsonSuccess(res, session, 'Session aktif.');
}