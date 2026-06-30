<?php
// ==========================================
// api/products.php — CRUD Produk
// ==========================================

require_once __DIR__ . '/../config/database.php';

setApiHeaders();
session_start();

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

switch ($action) {
    case 'list':
        getProducts();
        break;

    case 'create':
        requireAdmin();
        if ($method !== 'POST') jsonError('Method not allowed', 405);
        createProduct();
        break;

    case 'update':
        requireAdmin();
        if ($method !== 'PUT' && $method !== 'POST') jsonError('Method not allowed', 405);
        updateProduct();
        break;

    case 'delete':
        requireAdmin();
        if ($method !== 'DELETE' && $method !== 'POST') jsonError('Method not allowed', 405);
        deleteProduct();
        break;

    default:
        jsonError('Action tidak dikenali', 404);
}

// ============================
// Guard: hanya admin
// ============================
function requireAdmin(): void {
    if (empty($_SESSION['user']) || ($_SESSION['user']['role'] ?? '') !== 'admin') {
        jsonError('Akses ditolak. Hanya admin yang diizinkan.', 403);
    }
}

// ============================
// Ambil semua produk
// ============================
function getProducts(): void {
    $pdo  = getDB();
    $stmt = $pdo->query('SELECT * FROM products ORDER BY id ASC');
    $rows = $stmt->fetchAll();

    // Normalisasi key agar sesuai dengan JS (desc -> desc)
    $products = array_map(function ($row) {
        return [
            'id'       => (int) $row['id'],
            'name'     => $row['name'],
            'category' => $row['category'],
            'price'    => (int) $row['price'],
            'desc'     => $row['description'],
            'image'    => $row['image'],
        ];
    }, $rows);

    jsonSuccess($products);
}

// ============================
// Tambah produk baru
// ============================
function createProduct(): void {
    $body     = getRequestBody();
    $name     = trim($body['name'] ?? '');
    $category = trim($body['category'] ?? '');
    $price    = (int) ($body['price'] ?? 0);
    $desc     = trim($body['desc'] ?? '');
    $image    = trim($body['image'] ?? '');

    if (empty($name) || empty($category) || $price <= 0 || empty($image)) {
        jsonError('Semua field wajib diisi dan harga harus lebih dari 0.');
    }

    $pdo  = getDB();
    $stmt = $pdo->prepare(
        'INSERT INTO products (name, category, price, description, image) VALUES (?, ?, ?, ?, ?)'
    );
    $stmt->execute([$name, $category, $price, $desc, $image]);
    $newId = (int) $pdo->lastInsertId();

    jsonSuccess([
        'id'       => $newId,
        'name'     => $name,
        'category' => $category,
        'price'    => $price,
        'desc'     => $desc,
        'image'    => $image,
    ], "Produk \"{$name}\" berhasil ditambahkan!", 201);
}

// ============================
// Update produk
// ============================
function updateProduct(): void {
    $body     = getRequestBody();
    $id       = (int) ($body['id'] ?? 0);
    $name     = trim($body['name'] ?? '');
    $category = trim($body['category'] ?? '');
    $price    = (int) ($body['price'] ?? 0);
    $desc     = trim($body['desc'] ?? '');
    $image    = trim($body['image'] ?? '');

    if ($id <= 0 || empty($name) || empty($category) || $price <= 0 || empty($image)) {
        jsonError('Data tidak valid atau field wajib kosong.');
    }

    $pdo  = getDB();
    $stmt = $pdo->prepare(
        'UPDATE products SET name=?, category=?, price=?, description=?, image=? WHERE id=?'
    );
    $stmt->execute([$name, $category, $price, $desc, $image, $id]);

    if ($stmt->rowCount() === 0) {
        jsonError('Produk tidak ditemukan.', 404);
    }

    jsonSuccess(['id' => $id], "Produk \"{$name}\" berhasil diubah!");
}

// ============================
// Hapus produk
// ============================
function deleteProduct(): void {
    $body = getRequestBody();
    $id   = (int) ($body['id'] ?? $_GET['id'] ?? 0);

    if ($id <= 0) {
        jsonError('ID produk tidak valid.');
    }

    $pdo  = getDB();
    // Ambil nama dulu untuk pesan
    $stmt = $pdo->prepare('SELECT name FROM products WHERE id = ?');
    $stmt->execute([$id]);
    $prod = $stmt->fetch();

    if (!$prod) {
        jsonError('Produk tidak ditemukan.', 404);
    }

    $stmt = $pdo->prepare('DELETE FROM products WHERE id = ?');
    $stmt->execute([$id]);

    jsonSuccess([], "Produk \"{$prod['name']}\" berhasil dihapus.");
}