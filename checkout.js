// ==========================================
// checkout.js — Halaman Checkout (PHP API)
// ==========================================

const SERVICE_FEE = 2000;
let selectedShippingCost = 0;
let baseShippingCost = 0;
let selectedCourier = 'JNE';
let promoDiscount = 0;
let currentCity = '';

// Ongkir per kurir (multiplier dari harga dasar)
const COURIER_MULTIPLIER = {
    'JNE': 1.0,
    'J&T': 1.2,
    'SiCepat': 1.35
};

const BANK_VA = {
    'BCA':     '7004 5812 3901 2345',
    'Mandiri': '8888 0001 2345 6789',
    'BNI':     '9888 1234 5678 9012',
    'BRI':     '6004 4321 9876 5432'
};

document.addEventListener('authReady', async () => {
    // Guard: harus login
    if (!isLoggedIn()) {
        window.location.href = 'login.html?redirect=checkout.html';
        return;
    }

    // Load cart dari server
    await loadCart();

    // Guard: cart tidak boleh kosong
    if (cart.length === 0) {
        window.location.href = 'index.html';
        return;
    }

    // Isi data user dari sesi
    const user = getCachedUser();
    if (user) {
        prefillUserAddress(user);
    }

    renderCheckoutItems();
    updateSummary();
});

function prefillUserAddress(user) {
    const nameEl = document.getElementById('addr-name');
    const phoneEl = document.getElementById('addr-phone');
    const fullEl = document.getElementById('addr-full');
    const cityEl = document.getElementById('addr-city');
    const postalEl = document.getElementById('addr-postal');

    if (nameEl) nameEl.value = user.name || '';
    if (phoneEl) phoneEl.value = user.phone || '';
    if (fullEl) fullEl.value = user.address || '';
    if (postalEl) postalEl.value = user.postal || '';

    if (cityEl && user.city) {
        const options = cityEl.querySelectorAll('option');
        options.forEach(opt => {
            if (opt.value === user.city) {
                opt.selected = true;
            }
        });
        updateShipping();
    }

    // Tampilkan di preview jika ada data
    if (user.name && user.address) {
        updateAddressDisplay(user.name, user.phone, user.address, user.city, user.postal);
    }
}

function updateAddressDisplay(name, phone, address, city, postal) {
    const dispName = document.getElementById('disp-name');
    const dispPhone = document.getElementById('disp-phone');
    const dispAddr = document.getElementById('disp-address');
    if (dispName) dispName.textContent = name;
    if (dispPhone) dispPhone.textContent = phone;
    if (dispAddr) dispAddr.textContent = `${address}, ${city} ${postal}`;
}

function toggleAddressForm() {
    const form = document.getElementById('address-form');
    if (form) form.classList.toggle('hidden');
}

function saveAddress() {
    const name = document.getElementById('addr-name').value.trim();
    const phone = document.getElementById('addr-phone').value.trim();
    const full = document.getElementById('addr-full').value.trim();
    const cityEl = document.getElementById('addr-city');
    const city = cityEl.value;
    const postal = document.getElementById('addr-postal').value.trim();

    if (!name || !phone || !full || !city) {
        showToast('Harap lengkapi semua data alamat!', 'error');
        return;
    }

    updateAddressDisplay(name, phone, full, city, postal);
    currentCity = city;

    const form = document.getElementById('address-form');
    if (form) form.classList.add('hidden');

    updateShipping();
    showToast('Alamat berhasil disimpan!', 'success');
}

function updateShipping() {
    const cityEl = document.getElementById('addr-city');
    if (!cityEl) return;

    const selectedOption = cityEl.options[cityEl.selectedIndex];
    const ongkirBase = parseInt(selectedOption.getAttribute('data-ongkir') || '0');
    baseShippingCost = ongkirBase;
    currentCity = cityEl.value;

    if (ongkirBase === 0) {
        // Reset courier harga
        ['jne', 'jt', 'sicepat'].forEach(k => {
            const el = document.getElementById('price-' + k);
            if (el) el.textContent = '—';
        });
        const note = document.getElementById('courier-note');
        if (note) note.style.display = 'flex';
        return;
    }

    const note = document.getElementById('courier-note');
    if (note) note.style.display = 'none';

    // Update harga kurir
    const jnePrice = Math.round(ongkirBase * COURIER_MULTIPLIER['JNE']);
    const jtPrice = Math.round(ongkirBase * COURIER_MULTIPLIER['J&T']);
    const sicepatPrice = Math.round(ongkirBase * COURIER_MULTIPLIER['SiCepat']);

    const elJne = document.getElementById('price-jne');
    const elJt = document.getElementById('price-jt');
    const elSicepat = document.getElementById('price-sicepat');
    if (elJne) elJne.textContent = formatRupiah(jnePrice);
    if (elJt) elJt.textContent = formatRupiah(jtPrice);
    if (elSicepat) elSicepat.textContent = formatRupiah(sicepatPrice);

    // Set ongkir sesuai kurir yang dipilih saat ini
    selectedShippingCost = Math.round(ongkirBase * (COURIER_MULTIPLIER[selectedCourier] || 1));
    updateSummary();
}

function updateCourier(radioEl) {
    selectedCourier = radioEl.value;
    if (baseShippingCost > 0) {
        selectedShippingCost = Math.round(baseShippingCost * (COURIER_MULTIPLIER[selectedCourier] || 1));
        updateSummary();
    }
}

function renderCheckoutItems() {
    const container = document.getElementById('checkout-items-list');
    if (!container) return;

    container.innerHTML = '';
    cart.forEach(item => {
        container.innerHTML += `
            <div class="checkout-item">
                <img src="${item.image}" alt="${item.name}" class="checkout-item-img">
                <div class="checkout-item-details">
                    <p class="checkout-item-name">${item.name}</p>
                    <p class="checkout-item-qty">x${item.qty}</p>
                </div>
                <span class="checkout-item-price">${formatRupiah(item.price * item.qty)}</span>
            </div>
        `;
    });
}

function updateSummary() {
    const subtotal = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
    const shipping = selectedShippingCost;
    const total = subtotal + shipping + SERVICE_FEE - promoDiscount;

    const subtotalEl = document.getElementById('summary-subtotal');
    const shippingEl = document.getElementById('summary-shipping');
    const totalEl = document.getElementById('summary-total');

    if (subtotalEl) subtotalEl.textContent = formatRupiah(subtotal);
    if (shippingEl) shippingEl.textContent = shipping > 0 ? formatRupiah(shipping) : '— (pilih kota)';
    if (totalEl) totalEl.textContent = formatRupiah(total);

    if (promoDiscount > 0) {
        const discRow = document.getElementById('discount-row');
        const discEl = document.getElementById('summary-discount');
        if (discRow) discRow.style.display = 'flex';
        if (discEl) discEl.textContent = `— ${formatRupiah(promoDiscount)}`;
    }
}

function applyPromo() {
    const input = document.getElementById('promo-code');
    if (!input) return;
    const code = input.value.trim().toUpperCase();

    const PROMO_CODES = {
        'TATANG10': 10000,
        'KUEHEMAT': 15000,
        'NEWUSER':  5000
    };

    if (PROMO_CODES[code]) {
        promoDiscount = PROMO_CODES[code];
        showToast(`Kode promo "${code}" berhasil! Hemat ${formatRupiah(promoDiscount)} 🎉`, 'success');
        updateSummary();
        input.disabled = true;
    } else {
        showToast('Kode promo tidak valid atau sudah kadaluarsa.', 'error');
    }
}

async function proceedToPayment() {
    const name  = document.getElementById('addr-name')?.value.trim();
    const phone = document.getElementById('addr-phone')?.value.trim();
    const full  = document.getElementById('addr-full')?.value.trim();
    const city  = document.getElementById('addr-city')?.value;

    if (!name || !phone || !full || !city) {
        showToast('Harap lengkapi alamat pengiriman terlebih dahulu!', 'error');
        const addressCard = document.getElementById('address-card');
        if (addressCard) addressCard.scrollIntoView({ behavior: 'smooth' });
        toggleAddressForm();
        return;
    }

    if (selectedShippingCost === 0) {
        showToast('Harap pilih kota & ekspedisi pengiriman!', 'error');
        return;
    }

    // Generate order ID (10 digit random)
    const orderId = Math.floor(1000000000 + Math.random() * 9000000000).toString();

    const subtotal = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
    const total    = subtotal + selectedShippingCost + SERVICE_FEE - promoDiscount;

    // Tentukan estimasi hari kurir
    const etaMap = { 'JNE': '2-3 hari kerja', 'J&T': '1-2 hari kerja', 'SiCepat': '1 hari kerja' };
    const countdownEnd = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

    const orderData = {
        orderId,
        items: [...cart],
        subtotal,
        shipping: selectedShippingCost,
        serviceFee: SERVICE_FEE,
        discount: promoDiscount,
        total,
        courier: selectedCourier,
        courierEta: etaMap[selectedCourier] || '',
        address: { name, phone, full, city, postal: document.getElementById('addr-postal')?.value || '' },
        note: document.getElementById('order-note')?.value || '',
        countdownEnd,
    };

    // Simpan ke server via API
    try {
        const res  = await fetch(`${API_BASE}/orders.php?action=create`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderData),
        });
        const json = await res.json();
        if (!json.success) {
            showToast('Gagal membuat pesanan: ' + json.message, 'error');
            return;
        }
    } catch {
        showToast('Gagal terhubung ke server. Coba lagi.', 'error');
        return;
    }

    // Simpan data pesanan ke localStorage untuk halaman payment
    const currentOrderData = {
        ...orderData,
        userId: getCachedUser()?.id,
        userEmail: getCachedUser()?.email || '',
        status: 'Menunggu Pembayaran',
        createdAt: new Date().toISOString(),
    };
    localStorage.setItem('toko_kue_current_order', JSON.stringify(currentOrderData));

    // Kosongkan keranjang
    cart = [];
    await saveCart();
    try {
        await fetch(`${API_BASE}/cart.php?action=clear`, { method: 'POST', credentials: 'include' });
    } catch { /* abaikan */ }

    window.location.href = 'payment.html';
}
