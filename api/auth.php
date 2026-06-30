<?php
// ==========================================
// api/auth.php — Autentikasi (Login, Register, Logout, Session)
// ==========================================

require_once __DIR__ . '/../config/database.php';

setApiHeaders();
session_start();

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

switch ($action) {
    case 'login':
        if ($method !== 'POST') jsonError('Method not allowed', 405);
        handleLogin();
        break;

    case 'register':
        if ($method !== 'POST') jsonError('Method not allowed', 405);
        handleRegister();
        break;

    case 'logout':
        handleLogout();
        break;

    case 'session':
        getSession();
        break;

    default:
        jsonError('Action tidak dikenali', 404);
}

// ============================
// Login
// ============================
function handleLogin(): void {
    $body = getRequestBody();
    $email    = strtolower(trim($body['email'] ?? ''));
    $password = $body['password'] ?? '';

    if (empty($email) || empty($password)) {
        jsonError('Email dan password wajib diisi.');
    }

    $pdo  = getDB();
    $stmt = $pdo->prepare('SELECT * FROM users WHERE email = ? LIMIT 1');
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($password, $user['password'])) {
        jsonError('Email atau password salah. Periksa kembali dan coba lagi.', 401);
    }

    // Simpan sesi
    $_SESSION['user'] = [
        'id'      => $user['id'],
        'name'    => $user['name'],
        'email'   => $user['email'],
        'phone'   => $user['phone'],
        'address' => $user['address'],
        'city'    => $user['city'],
        'postal'  => $user['postal'],
        'role'    => $user['role'],
    ];

    jsonSuccess($_SESSION['user'], "Selamat datang, {$user['name']}!");
}

// ============================
// Register
// ============================
function handleRegister(): void {
    $body     = getRequestBody();
    $name     = trim($body['name'] ?? '');
    $email    = strtolower(trim($body['email'] ?? ''));
    $phone    = trim($body['phone'] ?? '');
    $password = $body['password'] ?? '';

    if (empty($name)) {
        jsonError('Nama lengkap tidak boleh kosong!');
    }
    if (strlen($password) < 6) {
        jsonError('Password minimal 6 karakter!');
    }
    if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        jsonError('Format email tidak valid!');
    }

    $pdo = getDB();

    // Cek email sudah terdaftar
    $stmt = $pdo->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
    $stmt->execute([$email]);
    if ($stmt->fetch()) {
        jsonError('Email sudah terdaftar. Silakan login!');
    }

    // Simpan user baru
    $hashed = password_hash($password, PASSWORD_BCRYPT);
    $stmt   = $pdo->prepare(
        'INSERT INTO users (name, email, password, phone, address, city, postal, role) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([$name, $email, $hashed, $phone, '', '', '', 'user']);
    $newId = (int) $pdo->lastInsertId();

    // Langsung login
    $_SESSION['user'] = [
        'id'      => $newId,
        'name'    => $name,
        'email'   => $email,
        'phone'   => $phone,
        'address' => '',
        'city'    => '',
        'postal'  => '',
        'role'    => 'user',
    ];

    jsonSuccess($_SESSION['user'], "Akun berhasil dibuat! Selamat datang, {$name}!", 201);
}

// ============================
// Logout
// ============================
function handleLogout(): void {
    $_SESSION = [];
    session_destroy();
    jsonSuccess([], 'Berhasil logout.');
}

// ============================
// Get Session (cek login status)
// ============================
function getSession(): void {
    if (!empty($_SESSION['user'])) {
        jsonSuccess($_SESSION['user'], 'Session aktif.');
    } else {
        jsonError('Tidak ada sesi aktif.', 401);
    }
}