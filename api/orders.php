<?php
// ==========================================
// api/orders.php — Manajemen Pesanan
// ==========================================

require_once __DIR__ . '/../config/database.php';

setApiHeaders();
session_start();

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

switch ($action) {
    case 'create':
        requireLogin();
        if ($method !== 'POST') jsonError('Method not allowed', 405);
        createOrder();
        break;

    case 'list':
        requireLogin();
        listOrders();
        break;

    case 'all':
        requireAdmin();
        listAllOrders();
        break;

    case 'get':
        requireLogin();
        getOrder();
        break;

    case 'update_status':
        requireLogin();
        if ($method !== 'POST') jsonError('Method not allowed', 405);
        updateStatus();
        break;

    case 'inject_demo':
        requireLogin();
        if ($method !== 'POST') jsonError('Method not allowed', 405);
        injectDemoOrders();
        break;

    default:
        jsonError('Action tidak dikenali', 404);
}

// ============================
// Guard helpers
// ============================
function requireLogin(): void {
    if (empty($_SESSION['user'])) {
        jsonError('Silakan login terlebih dahulu.', 401);
    }
}

function requireAdmin(): void {
    if (empty($_SESSION['user']) || ($_SESSION['user']['role'] ?? '') !== 'admin') {
        jsonError('Akses ditolak. Hanya admin yang diizinkan.', 403);
    }
}

// ============================
// Buat pesanan baru
// ============================
function createOrder(): void {
    $body    = getRequestBody();
    $user    = $_SESSION['user'];
    $userId  = (int) $user['id'];

    $orderId     = $body['orderId']     ?? '';
    $items       = $body['items']       ?? [];
    $subtotal    = (int) ($body['subtotal']    ?? 0);
    $shipping    = (int) ($body['shipping']    ?? 0);
    $serviceFee  = (int) ($body['serviceFee']  ?? 2000);
    $discount    = (int) ($body['discount']    ?? 0);
    $total       = (int) ($body['total']       ?? 0);
    $courier     = $body['courier']     ?? '';
    $courierEta  = $body['courierEta']  ?? '';
    $address     = $body['address']     ?? [];
    $note        = $body['note']        ?? '';
    $countdownEnd = $body['countdownEnd'] ?? date('Y-m-d H:i:s', strtotime('+2 hours'));

    if (empty($orderId) || empty($items) || $total <= 0) {
        jsonError('Data pesanan tidak lengkap.');
    }

    $pdo = getDB();

    // Simpan header pesanan
    $stmt = $pdo->prepare(
        'INSERT INTO orders
         (order_id, user_id, user_email, subtotal, shipping, service_fee, discount, total,
          courier, courier_eta, addr_name, addr_phone, addr_full, addr_city, addr_postal,
          note, status, countdown_end)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
    );
    $stmt->execute([
        $orderId,
        $userId,
        $user['email'],
        $subtotal,
        $shipping,
        $serviceFee,
        $discount,
        $total,
        $courier,
        $courierEta,
        $address['name']   ?? '',
        $address['phone']  ?? '',
        $address['full']   ?? '',
        $address['city']   ?? '',
        $address['postal'] ?? '',
        $note,
        'Menunggu Pembayaran',
        date('Y-m-d H:i:s', strtotime($countdownEnd)),
    ]);

    // Simpan item pesanan
    $stmtItem = $pdo->prepare(
        'INSERT INTO order_items (order_id, product_id, name, price, qty, image) VALUES (?,?,?,?,?,?)'
    );
    foreach ($items as $item) {
        $stmtItem->execute([
            $orderId,
            $item['id'] ?? null,
            $item['name'] ?? '',
            (int) ($item['price'] ?? 0),
            (int) ($item['qty']   ?? 1),
            $item['image'] ?? '',
        ]);
    }

    jsonSuccess(['orderId' => $orderId], 'Pesanan berhasil dibuat!', 201);
}

// ============================
// Daftar pesanan milik user
// ============================
function listOrders(): void {
    $userId = (int) $_SESSION['user']['id'];
    $pdo    = getDB();

    $stmt = $pdo->prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC');
    $stmt->execute([$userId]);
    $orders = $stmt->fetchAll();

    jsonSuccess(formatOrders($orders, $pdo));
}

// ============================
// Semua pesanan (admin)
// ============================
function listAllOrders(): void {
    $pdo  = getDB();
    $stmt = $pdo->query('SELECT * FROM orders ORDER BY created_at DESC');
    $orders = $stmt->fetchAll();

    jsonSuccess(formatOrders($orders, $pdo));
}

// ============================
// Detail satu pesanan
// ============================
function getOrder(): void {
    $orderId = $_GET['order_id'] ?? '';
    if (empty($orderId)) jsonError('order_id wajib diisi.');

    $user   = $_SESSION['user'];
    $pdo    = getDB();

    $stmt = $pdo->prepare('SELECT * FROM orders WHERE order_id = ? LIMIT 1');
    $stmt->execute([$orderId]);
    $order = $stmt->fetch();

    if (!$order) jsonError('Pesanan tidak ditemukan.', 404);

    // Non-admin hanya bisa lihat pesanan milik sendiri
    if ($user['role'] !== 'admin' && (int)$order['user_id'] !== (int)$user['id']) {
        jsonError('Akses ditolak.', 403);
    }

    $formatted = formatOrders([$order], $pdo);
    jsonSuccess($formatted[0] ?? []);
}

// ============================
// Update status pesanan
// ============================
function updateStatus(): void {
    $body     = getRequestBody();
    $orderId  = $body['orderId']   ?? '';
    $newStatus = $body['status']   ?? '';
    $user     = $_SESSION['user'];

    $allowed = ['Menunggu Pembayaran','Diproses','Dikirim','Selesai','Dibatalkan'];
    if (!in_array($newStatus, $allowed, true)) {
        jsonError('Status tidak valid.');
    }

    $pdo  = getDB();
    $stmt = $pdo->prepare('SELECT * FROM orders WHERE order_id = ? LIMIT 1');
    $stmt->execute([$orderId]);
    $order = $stmt->fetch();

    if (!$order) jsonError('Pesanan tidak ditemukan.', 404);

    // Non-admin hanya bisa update pesanan milik sendiri
    if ($user['role'] !== 'admin' && (int)$order['user_id'] !== (int)$user['id']) {
        jsonError('Akses ditolak.', 403);
    }

    $paidAt = null;
    if (in_array($newStatus, ['Diproses', 'Dikirim'], true)) {
        $paidAt = date('Y-m-d H:i:s');
    }

    if ($paidAt) {
        $stmt = $pdo->prepare('UPDATE orders SET status=?, paid_at=? WHERE order_id=?');
        $stmt->execute([$newStatus, $paidAt, $orderId]);
    } else {
        $stmt = $pdo->prepare('UPDATE orders SET status=? WHERE order_id=?');
        $stmt->execute([$newStatus, $orderId]);
    }

    jsonSuccess(['orderId' => $orderId, 'status' => $newStatus], 'Status berhasil diperbarui.');
}

// ============================
// Inject demo orders (untuk user baru tanpa riwayat)
// ============================
function injectDemoOrders(): void {
    $user   = $_SESSION['user'];
    $userId = (int) $user['id'];
    $pdo    = getDB();

    // Cek apakah sudah ada pesanan
    $stmt = $pdo->prepare('SELECT COUNT(*) as cnt FROM orders WHERE user_id = ?');
    $stmt->execute([$userId]);
    $row = $stmt->fetch();
    if ((int)$row['cnt'] > 0) {
        jsonSuccess([], 'Sudah ada pesanan.');
    }

    $demoOrders = [
        [
            'orderId'     => '8472639104',
            'subtotal'    => 205000,
            'shipping'    => 15000,
            'serviceFee'  => 2000,
            'discount'    => 0,
            'total'       => 222000,
            'courier'     => 'JNE',
            'courierEta'  => '2-3 hari kerja',
            'status'      => 'Selesai',
            'createdAt'   => date('Y-m-d H:i:s', strtotime('-7 days')),
            'paidAt'      => date('Y-m-d H:i:s', strtotime('-7 days +30 minutes')),
            'items'       => [
                ['id'=>1,'name'=>'Kue Lapis Legit Premium','qty'=>1,'price'=>75000,'image'=>'https://i.pinimg.com/1200x/d4/f3/c7/d4f3c7eaad1620801712318684b6b534.jpg'],
                ['id'=>2,'name'=>'Nastar Keju','qty'=>2,'price'=>65000,'image'=>'https://i.pinimg.com/736x/88/da/c3/88dac3899943f02c51fe6c95ce664b2f.jpg'],
            ],
        ],
        [
            'orderId'     => '3819204756',
            'subtotal'    => 185000,
            'shipping'    => 25000,
            'serviceFee'  => 2000,
            'discount'    => 10000,
            'total'       => 202000,
            'courier'     => 'J&T',
            'courierEta'  => '1-2 hari kerja',
            'status'      => 'Dikirim',
            'createdAt'   => date('Y-m-d H:i:s', strtotime('-2 days')),
            'paidAt'      => date('Y-m-d H:i:s', strtotime('-2 days +45 minutes')),
            'items'       => [
                ['id'=>4,'name'=>'Kue Black Forest Klasik','qty'=>1,'price'=>185000,'image'=>'https://i.pinimg.com/736x/fd/2f/d4/fd2fd4ce9503a7dd5e8e9209d1806911.jpg'],
            ],
        ],
        [
            'orderId'     => '5604817239',
            'subtotal'    => 54000,
            'shipping'    => 15000,
            'serviceFee'  => 2000,
            'discount'    => 0,
            'total'       => 71000,
            'courier'     => 'JNE',
            'courierEta'  => '2-3 hari kerja',
            'status'      => 'Menunggu Pembayaran',
            'createdAt'   => date('Y-m-d H:i:s', strtotime('-20 minutes')),
            'paidAt'      => null,
            'countdownEnd'=> date('Y-m-d H:i:s', strtotime('+100 minutes')),
            'items'       => [
                ['id'=>3,'name'=>'Croissant Cokelat Pastry','qty'=>3,'price'=>18000,'image'=>'https://i.pinimg.com/webp87/1200x/34/a0/59/34a059a12664dcae118986a011cd897c.webp'],
            ],
        ],
    ];

    $stmtOrder = $pdo->prepare(
        'INSERT IGNORE INTO orders
         (order_id, user_id, user_email, subtotal, shipping, service_fee, discount, total,
          courier, courier_eta, addr_name, addr_phone, addr_full, addr_city, addr_postal,
          note, status, paid_at, countdown_end, created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
    );
    $stmtItem = $pdo->prepare(
        'INSERT IGNORE INTO order_items (order_id, product_id, name, price, qty, image) VALUES (?,?,?,?,?,?)'
    );

    foreach ($demoOrders as $o) {
        $stmtOrder->execute([
            $o['orderId'], $userId, $user['email'],
            $o['subtotal'], $o['shipping'], $o['serviceFee'], $o['discount'], $o['total'],
            $o['courier'], $o['courierEta'],
            $user['name'], $user['phone'] ?? '', $user['address'] ?? '', $user['city'] ?? '', $user['postal'] ?? '',
            '', $o['status'],
            $o['paidAt'],
            $o['countdownEnd'] ?? null,
            $o['createdAt'],
        ]);
        foreach ($o['items'] as $item) {
            $stmtItem->execute([$o['orderId'], $item['id'], $item['name'], $item['price'], $item['qty'], $item['image']]);
        }
    }

    jsonSuccess([], 'Demo orders berhasil diinjeksi.');
}

// ============================
// Helper: format array orders dari DB ke format JS
// ============================
function formatOrders(array $orders, PDO $pdo): array {
    if (empty($orders)) return [];

    $orderIds    = array_column($orders, 'order_id');
    $placeholders = implode(',', array_fill(0, count($orderIds), '?'));

    $stmtItems = $pdo->prepare("SELECT * FROM order_items WHERE order_id IN ({$placeholders})");
    $stmtItems->execute($orderIds);
    $allItems  = $stmtItems->fetchAll();

    // Kelompokkan items per order_id
    $itemsMap = [];
    foreach ($allItems as $item) {
        $itemsMap[$item['order_id']][] = [
            'id'    => (int) $item['product_id'],
            'name'  => $item['name'],
            'price' => (int) $item['price'],
            'qty'   => (int) $item['qty'],
            'image' => $item['image'],
        ];
    }

    return array_map(function ($o) use ($itemsMap) {
        return [
            'orderId'      => $o['order_id'],
            'userId'       => (int) $o['user_id'],
            'userEmail'    => $o['user_email'],
            'subtotal'     => (int) $o['subtotal'],
            'shipping'     => (int) $o['shipping'],
            'serviceFee'   => (int) $o['service_fee'],
            'discount'     => (int) $o['discount'],
            'total'        => (int) $o['total'],
            'courier'      => $o['courier'],
            'courierEta'   => $o['courier_eta'],
            'address'      => [
                'name'   => $o['addr_name'],
                'phone'  => $o['addr_phone'],
                'full'   => $o['addr_full'],
                'city'   => $o['addr_city'],
                'postal' => $o['addr_postal'],
            ],
            'note'         => $o['note'],
            'status'       => $o['status'],
            'paidAt'       => $o['paid_at'],
            'countdownEnd' => $o['countdown_end'],
            'createdAt'    => $o['created_at'],
            'items'        => $itemsMap[$o['order_id']] ?? [],
        ];
    }, $orders);
}