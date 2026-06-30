// ==========================================
// admin.js — Logika Dasbor Admin Toko Kue Tatang
// ==========================================

let activeTab = 'orders';
let activeOrderFilter = 'semua';

const STATUS_CONFIG = {
    'Menunggu Pembayaran': { color: '#E67E22', bg: '#FFF3E0', icon: 'fa-clock', label: 'Menunggu Pembayaran' },
    'Diproses': { color: '#2980B9', bg: '#EBF5FB', icon: 'fa-gears', label: 'Sedang Diproses' },
    'Dikirim': { color: '#8E44AD', bg: '#F4ECF7', icon: 'fa-truck', label: 'Dalam Pengiriman' },
    'Selesai': { color: '#27AE60', bg: '#E9F7EF', icon: 'fa-circle-check', label: 'Selesai' },
    'Dibatalkan': { color: '#C0392B', bg: '#FDEDEC', icon: 'fa-circle-xmark', label: 'Dibatalkan' }
};

// Formatter mata uang rupiah
function formatRupiah(number) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(number);
}

// Toast notification
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.innerHTML = '<i class="fa-solid ' + (type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation') + '"></i> ' + message;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, 3000);
}

document.addEventListener('authReady', async () => {
    // Safety check: hanya admin yang boleh
    const user = getCachedUser();
    if (!user || user.role !== 'admin') {
        window.location.href = 'login.html?redirect=admin.html';
        return;
    }

    // Render Data Awal
    await refreshDashboard();
});

async function refreshDashboard() {
    await Promise.all([renderStats(), renderOrders(), renderProductsList()]);
}

// ============================
// LOGIKA TAB & STATISTIK
// ============================
function switchAdminTab(tab) {
    activeTab = tab;
    
    const tabOrdersBtn = document.getElementById('tab-btn-orders');
    const tabProdBtn = document.getElementById('tab-btn-products');
    
    const secOrders = document.getElementById('admin-sec-orders');
    const secProducts = document.getElementById('admin-sec-products');
    
    if (tab === 'orders') {
        tabOrdersBtn.classList.add('active');
        tabProdBtn.classList.remove('active');
        secOrders.classList.remove('hidden');
        secProducts.classList.add('hidden');
    } else {
        tabOrdersBtn.classList.remove('active');
        tabProdBtn.classList.add('active');
        secOrders.classList.add('hidden');
        secProducts.classList.remove('hidden');
    }
}

async function renderStats() {
    try {
        const [ordersRes, productsRes] = await Promise.all([
            fetch(`${API_BASE}/orders.php?action=all`, { credentials: 'include' }),
            fetch(`${API_BASE}/products.php?action=list`),
        ]);
        const ordersJson   = await ordersRes.json();
        const productsJson = await productsRes.json();

        const orders      = ordersJson.success   ? ordersJson.data   : [];
        const productsList = productsJson.success ? productsJson.data : [];

        const revenue = orders
            .filter(o => o.status === 'Selesai')
            .reduce((sum, o) => sum + (o.total || 0), 0);

        document.getElementById('stat-total-orders').textContent    = orders.length;
        document.getElementById('stat-total-revenue').textContent   = formatRupiah(revenue);
        document.getElementById('stat-total-products').textContent  = productsList.length;
    } catch {
        console.error('Gagal memuat statistik.');
    }
}

// ============================
// MANAJEMEN PESANAN (ORDERS)
// ============================
function filterAdminOrders(status, btnEl) {
    activeOrderFilter = status;
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    if (btnEl) btnEl.classList.add('active');
    renderOrders();
}

async function renderOrders() {
    const ordersList  = document.getElementById('admin-orders-list');
    const emptyOrders = document.getElementById('empty-orders');
    const tableElement = document.getElementById('orders-table');
    
    if (!ordersList) return;
    
    let allOrders = [];
    try {
        const res  = await fetch(`${API_BASE}/orders.php?action=all`, { credentials: 'include' });
        const json = await res.json();
        if (json.success) allOrders = json.data;
    } catch {
        console.error('Gagal memuat pesanan.');
    }

    // Filter status
    if (activeOrderFilter !== 'semua') {
        allOrders = allOrders.filter(o => o.status === activeOrderFilter);
    }
    
    ordersList.innerHTML = '';
    
    if (allOrders.length === 0) {
        if (tableElement) tableElement.style.display = 'none';
        if (emptyOrders) emptyOrders.classList.remove('hidden');
        return;
    }
    
    if (tableElement) tableElement.style.display = 'table';
    if (emptyOrders) emptyOrders.classList.add('hidden');
    
    allOrders.forEach(order => {
        const date = new Date(order.createdAt);
        const dateStr = date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        
        const cfg = STATUS_CONFIG[order.status] || { color: '#888', bg: '#f5f5f5', icon: 'fa-circle', label: order.status };
        
        // Buat item list HTML
        const itemsListHTML = order.items.map(item => `
            <li><strong>${item.name}</strong> x${item.qty} <span>(${formatRupiah(item.price)})</span></li>
        `).join('');
        
        // Cek tombol aksi
        let actionHTML = '';
        if (order.status === 'Dikirim') {
            actionHTML = `
                <button class="btn-action-done" onclick="markAsArrived('${order.orderId}')">
                    <i class="fa-solid fa-circle-check"></i> Barang Sampai
                </button>
            `;
        } else {
            actionHTML = `<span class="btn-action-empty">-</span>`;
        }
        
        const address = order.address || {};
        const phone = address.phone || '—';
        const addressDetails = `${address.full || 'Alamat tidak lengkap'}, ${address.city || ''} ${address.postal || ''}`;
        
        ordersList.innerHTML += `
            <tr>
                <td>
                    <span class="order-id-sub">#${order.orderId}</span>
                    <span class="order-date-sub"><i class="fa-regular fa-calendar-days"></i> ${dateStr}</span>
                </td>
                <td>
                    <span class="cust-name">${address.name || 'Pelanggan'}</span>
                    <span class="cust-contact"><i class="fa-regular fa-envelope"></i> ${order.userEmail || 'guest@email.com'}</span>
                    <span class="cust-contact"><i class="fa-solid fa-phone" style="font-size:0.7rem;"></i> ${phone}</span>
                    <div class="cust-address">${addressDetails}</div>
                </td>
                <td>
                    <ul class="order-item-summary">
                        ${itemsListHTML}
                    </ul>
                    ${order.note ? `<div class="order-note-box"><strong>Catatan:</strong> "${order.note}"</div>` : ''}
                </td>
                <td>
                    <span class="total-tagihan">${formatRupiah(order.total)}</span>
                    <span class="courier-label-table"><i class="fa-solid fa-truck"></i> ${order.courier} (${order.courierEta || '—'})</span>
                </td>
                <td>
                    <span class="status-badge-admin" style="color:${cfg.color}; background:${cfg.bg};">
                        <i class="fa-solid ${cfg.icon}"></i> ${cfg.label}
                    </span>
                </td>
                <td>
                    ${actionHTML}
                </td>
            </tr>
        `;
    });
}

async function markAsArrived(orderId) {
    if (!confirm(`Tandai pesanan #${orderId} telah sampai ke tujuan?`)) return;

    try {
        const res  = await fetch(`${API_BASE}/orders.php?action=update_status`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId, status: 'Selesai' }),
        });
        const json = await res.json();
        if (!json.success) {
            showToast('Gagal update status: ' + json.message, 'error');
            return;
        }
    } catch {
        showToast('Gagal terhubung ke server.', 'error');
        return;
    }
    
    showToast(`Pesanan #${orderId} berhasil ditandai selesai/sampai!`, 'success');
    await refreshDashboard();
}

// ============================
// MANAJEMEN PRODUK (CRUD)
// ============================
async function renderProductsList() {
    const listContainer = document.getElementById('admin-products-list');
    const emptyProducts = document.getElementById('empty-products');
    if (!listContainer) return;

    let productsList = [];
    try {
        const res  = await fetch(`${API_BASE}/products.php?action=list`);
        const json = await res.json();
        if (json.success) productsList = json.data;
    } catch {
        console.error('Gagal memuat produk.');
    }

    listContainer.innerHTML = '';
    
    if (productsList.length === 0) {
        listContainer.classList.add('hidden');
        if (emptyProducts) emptyProducts.classList.remove('hidden');
        return;
    }
    
    listContainer.classList.remove('hidden');
    if (emptyProducts) emptyProducts.classList.add('hidden');
    
    productsList.forEach(product => {
        listContainer.innerHTML += `
            <div class="product-card-admin">
                <div class="product-img-wrap-admin">
                    <img src="${product.image}" alt="${product.name}">
                    <span class="prod-badge-admin">${product.category}</span>
                </div>
                <div class="product-info-admin">
                    <h4>${product.name}</h4>
                    <p class="desc">${product.desc}</p>
                    <div class="price-row">
                        <span class="price-val">${formatRupiah(product.price)}</span>
                        <div class="crud-actions">
                            <button class="btn-crud edit" title="Edit Kue" onclick="openProductModal(${product.id})">
                                <i class="fa-solid fa-pen"></i>
                            </button>
                            <button class="btn-crud delete" title="Hapus Kue" onclick="deleteProduct(${product.id})">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });
}

// Modal Form Operations
async function openProductModal(productId = null) {
    const modal      = document.getElementById('product-modal');
    const modalTitle = document.getElementById('modal-title');
    const form       = document.getElementById('product-form');

    form.reset();
    document.getElementById('prod-id').value = '';
    
    if (productId) {
        modalTitle.textContent = 'Edit Detail Kue';
        try {
            const res  = await fetch(`${API_BASE}/products.php?action=list`);
            const json = await res.json();
            if (json.success) {
                const prod = json.data.find(p => p.id === productId);
                if (prod) {
                    document.getElementById('prod-id').value       = prod.id;
                    document.getElementById('prod-name').value     = prod.name;
                    document.getElementById('prod-category').value = prod.category;
                    document.getElementById('prod-price').value    = prod.price;
                    document.getElementById('prod-desc').value     = prod.desc;
                    document.getElementById('prod-image').value    = prod.image;
                }
            }
        } catch {
            showToast('Gagal memuat data produk.', 'error');
            return;
        }
    } else {
        modalTitle.textContent = 'Tambah Produk Baru';
    }
    
    modal.classList.add('show');
}

function closeProductModal() {
    const modal = document.getElementById('product-modal');
    modal.classList.remove('show');
}

async function handleProductSubmit(e) {
    e.preventDefault();

    const id       = document.getElementById('prod-id').value;
    const name     = document.getElementById('prod-name').value.trim();
    const category = document.getElementById('prod-category').value;
    const price    = parseInt(document.getElementById('prod-price').value);
    const desc     = document.getElementById('prod-desc').value.trim();
    const image    = document.getElementById('prod-image').value.trim();

    const action   = id ? 'update' : 'create';
    const payload  = id ? { id: parseInt(id), name, category, price, desc, image } : { name, category, price, desc, image };

    try {
        const res  = await fetch(`${API_BASE}/products.php?action=${action}`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (json.success) {
            showToast(json.message, 'success');
        } else {
            showToast('Gagal: ' + json.message, 'error');
            return;
        }
    } catch {
        showToast('Gagal terhubung ke server.', 'error');
        return;
    }
    
    closeProductModal();
    await refreshDashboard();
}

async function deleteProduct(productId) {
    if (!confirm('Apakah Anda yakin ingin menghapus produk ini dari katalog?')) return;

    try {
        const res  = await fetch(`${API_BASE}/products.php?action=delete`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: productId }),
        });
        const json = await res.json();
        if (json.success) {
            showToast(json.message, 'error');
        } else {
            showToast('Gagal menghapus: ' + json.message, 'error');
            return;
        }
    } catch {
        showToast('Gagal terhubung ke server.', 'error');
        return;
    }

    await refreshDashboard();
}
