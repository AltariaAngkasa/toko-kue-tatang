<?php
// ==========================================
// api/cart.php — Keranjang Belanja (Server-side)
// ==========================================

require_once __DIR__ . '/../config/database.php';

setApiHeaders();
session_start();

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

switch ($action) {
    case 'get':
        requireLogin();
        getCart();
        break;

    case 'save':
        requireLogin();
        if ($method !== 'POST') jsonError('Method not allowed', 405);
        saveCart();
        break;

    case 'clear':
        requireLogin();
        if ($method !== 'POST') jsonError('Method not allowed', 405);
        clearCart();
        break;

    default:
        jsonError('Action tidak dikenali', 404);
}

function requireLogin(): void {
    if (empty($_SESSION['user'])) {
        jsonError('Silakan login terlebih dahulu.', 401);
    }
}

// ============================
// Ambil cart milik user
// ============================
function getCart(): void {
    $userId = (int) $_SESSION['user']['id'];
    $pdo    = getDB();

    $stmt = $pdo->prepare('SELECT items FROM cart WHERE user_id = ? LIMIT 1');
    $stmt->execute([$userId]);
    $row  = $stmt->fetch();

    $items = [];
    if ($row) {
        $items = json_decode($row['items'], true) ?? [];
    }

    jsonSuccess($items);
}

// ============================
// Simpan / update cart
// ============================
function saveCart(): void {
    $userId = (int) $_SESSION['user']['id'];
    $body   = getRequestBody();
    $items  = $body['items'] ?? [];

    if (!is_array($items)) {
        jsonError('Format items tidak valid.');
    }

    $pdo      = getDB();
    $itemsJson = json_encode($items);

    // Upsert: insert jika belum ada, update jika sudah
    $stmt = $pdo->prepare(
        'INSERT INTO cart (user_id, items) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE items = VALUES(items), updated_at = CURRENT_TIMESTAMP'
    );
    $stmt->execute([$userId, $itemsJson]);

    jsonSuccess(['count' => count($items)], 'Keranjang berhasil disimpan.');
}

// ============================
// Kosongkan cart
// ============================
function clearCart(): void {
    $userId = (int) $_SESSION['user']['id'];
    $pdo    = getDB();

    $stmt = $pdo->prepare('UPDATE cart SET items = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?');
    $stmt->execute(['[]', $userId]);

    jsonSuccess([], 'Keranjang berhasil dikosongkan.');
}