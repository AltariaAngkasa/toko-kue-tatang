// ==========================================
// history.js — Halaman Riwayat Pesanan
// ==========================================

let allOrders = [];
let currentFilter = 'semua';

const STATUS_CONFIG = {
    'Menunggu Pembayaran': {
        color: '#E67E22',
        bg: '#FFF3E0',
        icon: 'fa-clock',
        label: 'Menunggu Pembayaran'
    },
    'Diproses': {
        color: '#2980B9',
        bg: '#EBF5FB',
        icon: 'fa-gears',
        label: 'Sedang Diproses'
    },
    'Dikirim': {
        color: '#8E44AD',
        bg: '#F4ECF7',
        icon: 'fa-truck',
        label: 'Dalam Pengiriman'
    },
    'Selesai': {
        color: '#27AE60',
        bg: '#E9F7EF',
        icon: 'fa-circle-check',
        label: 'Selesai'
    },
    'Dibatalkan': {
        color: '#C0392B',
        bg: '#FDEDEC',
        icon: 'fa-circle-xmark',
        label: 'Dibatalkan'
    }
};

document.addEventListener('authReady', async () => {
    // Guard: harus login
    if (!isLoggedIn()) {
        window.location.href = 'login.html?redirect=history.html';
        return;
    }

    await loadOrders();
    renderOrders(allOrders);

    // Inject demo orders jika riwayat kosong
    if (allOrders.length === 0) {
        await injectDemoOrders();
        await loadOrders();
        renderOrders(allOrders);
    }
});

async function loadOrders() {
    try {
        const res  = await fetch(`${API_BASE}/orders.php?action=list`, { credentials: 'include' });
        const json = await res.json();
        if (json.success) {
            allOrders = json.data;
            return;
        }
    } catch { /* fallback ke localStorage */ }
    allOrders = [];
}

async function injectDemoOrders() {
    try {
        await fetch(`${API_BASE}/orders.php?action=inject_demo`, {
            method: 'POST',
            credentials: 'include',
        });
    } catch { /* abaikan */ }
}

function filterOrders(status, tabEl) {
    currentFilter = status;
    document.querySelectorAll('.hist-tab').forEach(t => t.classList.remove('active'));
    if (tabEl) tabEl.classList.add('active');
    const filtered = status === 'semua' ? allOrders : allOrders.filter(o => o.status === status);
    renderOrders(filtered);
}

function renderOrders(orders) {
    const list = document.getElementById('history-list');
    const empty = document.getElementById('empty-history');
    if (!list) return;

    list.innerHTML = '';

    if (orders.length === 0) {
        list.style.display = 'none';
        if (empty) empty.classList.remove('hidden');
        return;
    }

    list.style.display = 'flex';
    if (empty) empty.classList.add('hidden');

    orders.forEach(order => {
        const cfg = STATUS_CONFIG[order.status] || { color: '#888', bg: '#f5f5f5', icon: 'fa-circle', label: order.status };
        const date = new Date(order.createdAt);
        const dateStr = date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

        const previewItems = order.items.slice(0, 3);
        const itemsHTML = previewItems.map(item => `
            <div class="hist-item-row">
                <img src="${item.image}" alt="${item.name}" class="hist-item-img">
                <div class="hist-item-info">
                    <p>${item.name}</p>
                    <small>${item.qty} item × ${formatRupiah(item.price)}</small>
                </div>
            </div>
        `).join('');

        const moreCount = order.items.length - 3;

        const isPending = order.status === 'Menunggu Pembayaran';
        const isSelesai = order.status === 'Selesai';

        let actionsHTML = '';
        if (isPending) {
            actionsHTML = `
                <a href="payment.html" class="hist-action-btn primary" onclick="setCurrentOrder('${order.orderId}')">
                    <i class="fa-solid fa-credit-card"></i> Bayar Sekarang
                </a>
                <button class="hist-action-btn danger" onclick="cancelFromHistory('${order.orderId}')">
                    <i class="fa-solid fa-xmark"></i> Batalkan
                </button>
            `;
        } else if (isSelesai) {
            actionsHTML = `
                <button class="hist-action-btn secondary" onclick="buyAgain('${order.orderId}')">
                    <i class="fa-solid fa-rotate-right"></i> Beli Lagi
                </button>
            `;
        }

        list.innerHTML += `
            <div class="history-card" id="order-${order.orderId}">
                <div class="hist-card-header">
                    <div class="hist-order-meta">
                        <span class="hist-order-date"><i class="fa-regular fa-calendar"></i> ${dateStr}</span>
                        <span class="hist-order-id">ID: #${order.orderId}</span>
                    </div>
                    <span class="hist-status-badge" style="color:${cfg.color}; background:${cfg.bg};">
                        <i class="fa-solid ${cfg.icon}"></i> ${cfg.label}
                    </span>
                </div>

                <div class="hist-courier-row">
                    <i class="fa-solid fa-truck" style="color:#888;"></i>
                    <span>${order.courier} · Estimasi ${order.courierEta || '—'}</span>
                </div>

                <div class="hist-items-list">
                    ${itemsHTML}
                    ${moreCount > 0 ? `<p class="hist-more-items">+${moreCount} produk lainnya</p>` : ''}
                </div>

                <div class="hist-card-footer">
                    <div class="hist-total-wrap">
                        <span>Total Pesanan</span>
                        <strong class="hist-total">${formatRupiah(order.total)}</strong>
                    </div>
                    ${actionsHTML ? `<div class="hist-actions">${actionsHTML}</div>` : ''}
                </div>

                ${isPending ? renderMiniCountdown(order.countdownEnd, order.orderId) : ''}
            </div>
        `;
    });

    // Start mini countdowns
    document.querySelectorAll('[data-countdown]').forEach(el => {
        startMiniCountdown(el);
    });
}

function renderMiniCountdown(endTime, orderId) {
    return `
        <div class="hist-countdown" data-countdown="${endTime}" data-order="${orderId}">
            <i class="fa-regular fa-clock"></i>
            Bayar sebelum: <strong class="hist-timer">—</strong>
        </div>
    `;
}

function startMiniCountdown(el) {
    const endTime = new Date(el.getAttribute('data-countdown')).getTime();
    const timerEl = el.querySelector('.hist-timer');

    function tick() {
        const diff = endTime - Date.now();
        if (diff <= 0) {
            if (timerEl) timerEl.textContent = 'Kadaluarsa';
            el.style.color = '#C0392B';
            return;
        }
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        if (timerEl) timerEl.textContent = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    }

    tick();
    setInterval(tick, 1000);
}

function setCurrentOrder(orderId) {
    const order = allOrders.find(o => o.orderId === orderId);
    if (order) {
        localStorage.setItem('toko_kue_current_order', JSON.stringify(order));
    }
}

async function cancelFromHistory(orderId) {
    if (!confirm('Batalkan pesanan ini?')) return;

    try {
        const res  = await fetch(`${API_BASE}/orders.php?action=update_status`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId, status: 'Dibatalkan' }),
        });
        const json = await res.json();
        if (!json.success) {
            showToast('Gagal membatalkan pesanan: ' + json.message, 'error');
            return;
        }
    } catch {
        showToast('Gagal terhubung ke server.', 'error');
        return;
    }

    await loadOrders();
    filterOrders(currentFilter, null);
    showToast('Pesanan berhasil dibatalkan.', 'error');
}

async function buyAgain(orderId) {
    const order = allOrders.find(o => o.orderId === orderId);
    if (!order) return;

    // Load cart terbaru dulu
    await loadCart();

    order.items.forEach(item => {
        const existing = cart.find(c => c.id === item.id);
        if (existing) {
            existing.qty += item.qty;
        } else {
            cart.push({ ...item });
        }
    });
    await saveCart();
    showToast('Item telah ditambahkan ke keranjang!', 'success');
    setTimeout(() => {
        window.location.href = 'index.html';
    }, 1200);
}
