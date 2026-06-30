// ==========================================
// payment.js — Halaman Pembayaran (PHP API)
// ==========================================

let countdownInterval = null;
let currentOrder = null;

const BANK_VA_NUMBERS = {
    'BCA':     '7004 5812 3901 2345',
    'Mandiri': '8888 0001 2345 6789',
    'BNI':     '9888 1234 5678 9012',
    'BRI':     '6004 4321 9876 5432'
};

document.addEventListener('authReady', async () => {
    // Guard: harus login
    if (!isLoggedIn()) {
        window.location.href = 'login.html?redirect=payment.html';
        return;
    }

    // Ambil data pesanan dari localStorage
    const orderJson = localStorage.getItem('toko_kue_current_order');
    if (!orderJson) {
        window.location.href = 'index.html';
        return;
    }

    currentOrder = JSON.parse(orderJson);

    // Sinkronisasi status terbaru dari server
    try {
        const res  = await fetch(`${API_BASE}/orders.php?action=get&order_id=${currentOrder.orderId}`, { credentials: 'include' });
        const json = await res.json();
        if (json.success && json.data) {
            currentOrder.status = json.data.status;
            localStorage.setItem('toko_kue_current_order', JSON.stringify(currentOrder));
        }
    } catch { /* gunakan data localStorage jika server tidak tersedia */ }

    // Render semua bagian
    renderOrderId();
    renderPaymentSummary();
    renderOrderItems();
    startCountdown();
    updateVATotal();

    // Cek jika sudah dibayar sebelumnya
    if (currentOrder.status === 'Diproses' || currentOrder.status === 'Dikirim' || currentOrder.status === 'Selesai') {
        showPaidState();
    }
});

function renderOrderId() {
    const idDisplay = document.getElementById('order-id-display');
    const title = document.getElementById('order-id-title');
    if (idDisplay && currentOrder) {
        idDisplay.textContent = currentOrder.orderId;
    }
}

function renderPaymentSummary() {
    if (!currentOrder) return;

    const paySubtotal = document.getElementById('pay-subtotal');
    const payShipping = document.getElementById('pay-shipping');
    const payTotal = document.getElementById('pay-total');
    const payCourier = document.getElementById('pay-courier');
    const payDeliveryName = document.getElementById('pay-delivery-name');
    const payDeliveryEta = document.getElementById('pay-delivery-eta');
    const payDeliveryAddr = document.getElementById('pay-delivery-address');

    if (paySubtotal) paySubtotal.textContent = formatRupiah(currentOrder.subtotal);
    if (payShipping) payShipping.textContent = formatRupiah(currentOrder.shipping);
    if (payTotal) payTotal.textContent = formatRupiah(currentOrder.total);
    if (payCourier) payCourier.textContent = currentOrder.courier;
    if (payDeliveryName) payDeliveryName.textContent = `${currentOrder.courier}`;
    if (payDeliveryEta) payDeliveryEta.textContent = `Estimasi tiba ${currentOrder.courierEta}`;

    if (payDeliveryAddr && currentOrder.address) {
        const addr = currentOrder.address;
        payDeliveryAddr.textContent = `${addr.name} · ${addr.phone}\n${addr.full}, ${addr.city} ${addr.postal}`;
    }

    // Diskon promo jika ada
    if (currentOrder.discount > 0) {
        const discRow = document.getElementById('pay-discount-row');
        const discEl = document.getElementById('pay-discount');
        if (discRow) discRow.style.display = 'flex';
        if (discEl) discEl.textContent = `— ${formatRupiah(currentOrder.discount)}`;
    }

    // Tampilkan total di metode bayar
    updateVATotal();
}

function renderOrderItems() {
    const container = document.getElementById('payment-order-summary');
    if (!container || !currentOrder) return;

    container.innerHTML = '';
    currentOrder.items.forEach(item => {
        container.innerHTML += `
            <div class="pay-order-item">
                <img src="${item.image}" alt="${item.name}" class="pay-item-img">
                <div class="pay-item-detail">
                    <p>${item.name}</p>
                    <small>x${item.qty}</small>
                </div>
                <span>${formatRupiah(item.price * item.qty)}</span>
            </div>
        `;
    });
}

function startCountdown() {
    if (!currentOrder) return;

    const endTime = new Date(currentOrder.countdownEnd).getTime();
    const timerEl = document.getElementById('countdown-timer');

    function tick() {
        const now = Date.now();
        const diff = endTime - now;

        if (diff <= 0) {
            clearInterval(countdownInterval);
            if (timerEl) timerEl.textContent = '00:00:00';
            handleExpired();
            return;
        }

        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        if (timerEl) {
            timerEl.textContent =
                String(hours).padStart(2, '0') + ':' +
                String(minutes).padStart(2, '0') + ':' +
                String(seconds).padStart(2, '0');
        }

        // Warna kuning jika kurang dari 30 menit
        if (diff < 30 * 60 * 1000) {
            timerEl?.classList.add('urgent');
        }
    }

    tick();
    countdownInterval = setInterval(tick, 1000);
}

async function handleExpired() {
    const banner  = document.getElementById('payment-status-banner');
    const actions = document.getElementById('payment-actions');

    if (banner) banner.className = 'payment-status-banner expired';

    const labelEl = document.getElementById('status-label');
    const titleEl = document.getElementById('order-id-title');
    const iconEl  = document.getElementById('status-icon');

    if (labelEl) labelEl.textContent = 'PESANAN KADALUARSA';
    if (titleEl) titleEl.innerHTML = `ID <span id="order-id-display">${currentOrder.orderId}</span> telah kadaluarsa`;
    if (iconEl)  iconEl.className = 'fa-solid fa-circle-xmark';

    if (actions) actions.innerHTML = `
        <a href="index.html" class="btn-bayar" style="text-decoration:none; text-align:center;">
            <i class="fa-solid fa-shop"></i> Kembali Belanja
        </a>
    `;

    await updateOrderStatus(currentOrder.orderId, 'Dibatalkan');
    showToast('Pesanan kadaluarsa karena melewati batas waktu pembayaran.', 'error');
}

function showPaymentMethod(method) {
    const instructions = ['instruction-va', 'instruction-rek', 'instruction-qris'];
    instructions.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });

    const active = document.getElementById('instruction-' + method);
    if (active) active.classList.remove('hidden');

    updateVATotal();
}

function updateVATotal() {
    if (!currentOrder) return;
    const totalFormatted = formatRupiah(currentOrder.total);

    const vaTotal = document.getElementById('va-total-display');
    const rekTotal = document.getElementById('rek-total-display');
    const qrisTotal = document.getElementById('qris-total-display');
    const qrisAmt = document.getElementById('qris-amount-text');

    if (vaTotal) vaTotal.textContent = totalFormatted;
    if (rekTotal) rekTotal.textContent = totalFormatted;
    if (qrisTotal) qrisTotal.textContent = totalFormatted;
    if (qrisAmt) qrisAmt.textContent = totalFormatted;
}

function selectBank(bankName, btnEl) {
    // Update active button
    document.querySelectorAll('.bank-btn').forEach(b => b.classList.remove('active'));
    btnEl.classList.add('active');

    // Update VA number
    const vaNumber = document.getElementById('va-number');
    const vaBankName = document.getElementById('va-bank-name');
    if (vaNumber) vaNumber.textContent = BANK_VA_NUMBERS[bankName] || '—';
    if (vaBankName) vaBankName.textContent = bankName;
}

function copyText(elementId) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const text = el.textContent.replace(/\s/g, '');
    navigator.clipboard.writeText(text).then(() => {
        showToast('Nomor berhasil disalin!', 'success');
    }).catch(() => {
        // Fallback
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showToast('Nomor berhasil disalin!', 'success');
    });
}

async function confirmPayment() {
    if (!currentOrder) return;

    clearInterval(countdownInterval);

    // Update status ke Dikirim via API
    await updateOrderStatus(currentOrder.orderId, 'Dikirim');

    currentOrder.status = 'Dikirim';
    currentOrder.paidAt = new Date().toISOString();
    localStorage.setItem('toko_kue_current_order', JSON.stringify(currentOrder));

    showPaidState();
    showToast('Pembayaran dikonfirmasi! Pesanan Anda sedang diproses. 🎉', 'success');
}

function showPaidState() {
    const banner = document.getElementById('payment-status-banner');
    const actions = document.getElementById('payment-actions');
    const paidBanner = document.getElementById('paid-banner');

    if (banner) banner.className = 'payment-status-banner paid';

    const labelEl = document.getElementById('status-label');
    const titleEl = document.getElementById('order-id-title');
    const iconEl = document.getElementById('status-icon');
    const countdown = document.getElementById('status-countdown');

    if (labelEl) labelEl.textContent = 'PEMBAYARAN DITERIMA';
    if (titleEl) titleEl.innerHTML = `ID <span>${currentOrder.orderId}</span> sudah dibayar ✓`;
    if (iconEl) {
        iconEl.className = 'fa-solid fa-circle-check';
    }
    if (countdown) countdown.style.display = 'none';

    if (actions) actions.classList.add('hidden');
    if (paidBanner) paidBanner.classList.remove('hidden');
}

async function cancelOrder() {
    if (!confirm('Apakah Anda yakin ingin membatalkan pesanan ini?')) return;

    clearInterval(countdownInterval);
    await updateOrderStatus(currentOrder.orderId, 'Dibatalkan');

    showToast('Pesanan berhasil dibatalkan.', 'error');
    setTimeout(() => {
        window.location.href = 'history.html';
    }, 1500);
}

async function updateOrderStatus(orderId, newStatus) {
    try {
        const res  = await fetch(`${API_BASE}/orders.php?action=update_status`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId, status: newStatus }),
        });
        const json = await res.json();
        if (!json.success) {
            console.error('Gagal update status:', json.message);
        }
    } catch {
        console.error('Gagal terhubung ke server saat update status.');
    }
}
