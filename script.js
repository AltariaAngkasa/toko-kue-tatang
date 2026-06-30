// ==========================================
// Toko Kue Tatang — Main Script
// ==========================================

// Produk diisi setelah fetch dari API
let products = [];

// Keranjang belanja — di-sync ke server jika login, fallback localStorage jika belum login
let cart = JSON.parse(localStorage.getItem('toko_kue_cart') || '[]');

// Simpan cart: ke server jika login, ke localStorage sebagai fallback
async function saveCart() {
    localStorage.setItem('toko_kue_cart', JSON.stringify(cart));
    if (isLoggedIn()) {
        try {
            await fetch(`${API_BASE}/cart.php?action=save`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items: cart }),
            });
        } catch { /* abaikan error jaringan */ }
    }
}

// Load cart dari server jika login
async function loadCart() {
    if (isLoggedIn()) {
        try {
            const res  = await fetch(`${API_BASE}/cart.php?action=get`, { credentials: 'include' });
            const json = await res.json();
            if (json.success && Array.isArray(json.data) && json.data.length > 0) {
                cart = json.data;
                localStorage.setItem('toko_kue_cart', JSON.stringify(cart));
                return;
            }
        } catch { /* fallback ke localStorage */ }
    }
    // Fallback: pakai localStorage
    cart = JSON.parse(localStorage.getItem('toko_kue_cart') || '[]');
}

// Helper mengubah angka biasa menjadi format mata uang Rupiah
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

// ==========================================
// DOM Ready — tunggu authReady dari auth.js
// ==========================================
document.addEventListener('authReady', async () => {
    const productsContainer = document.getElementById('products-container');
    const searchInput       = document.getElementById('search-input');
    const categoryButtons   = document.querySelectorAll('.cat-btn');
    const cartToggle        = document.getElementById('cart-toggle');
    const cartClose         = document.getElementById('cart-close');
    const sidebarOverlay    = document.getElementById('sidebar-overlay');
    const checkoutBtn       = document.getElementById('checkout-btn');
    const menuCartLink      = document.getElementById('menu-cart-link');

    // Load produk dari API
    try {
        const res  = await fetch(`${API_BASE}/products.php?action=list`);
        const json = await res.json();
        if (json.success) products = json.data;
    } catch {
        showToast('Gagal memuat produk. Coba refresh halaman.', 'error');
    }

    // Load cart dari server/localStorage
    await loadCart();

    // Render products jika di halaman index
    if (productsContainer) {
        displayProducts(products);
    }

    // Category filter
    if (categoryButtons.length > 0) {
        categoryButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                categoryButtons.forEach(btn => btn.classList.remove('active'));
                e.target.classList.add('active');
                const category = e.target.getAttribute('data-category');
                if (category === 'semua') {
                    displayProducts(products);
                } else {
                    displayProducts(products.filter(p => p.category === category));
                }
            });
        });
    }

    // Live search
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const keyword  = e.target.value.toLowerCase();
            const filtered = products.filter(p =>
                p.name.toLowerCase().includes(keyword) ||
                p.desc.toLowerCase().includes(keyword)
            );
            displayProducts(filtered);
        });
    }

    // Cart sidebar toggle
    if (cartToggle)    cartToggle.addEventListener('click', openCart);
    if (cartClose)     cartClose.addEventListener('click', closeCart);
    if (sidebarOverlay) sidebarOverlay.addEventListener('click', closeCart);
    if (menuCartLink)  menuCartLink.addEventListener('click', (e) => { e.preventDefault(); openCart(); });

    // Checkout button — cek login
    if (checkoutBtn) {
        checkoutBtn.addEventListener('click', () => {
            if (cart.length === 0) {
                showToast('Keranjang masih kosong!', 'error');
                return;
            }
            if (!isLoggedIn()) {
                closeCart();
                showToast('Silakan login terlebih dahulu untuk checkout!', 'error');
                setTimeout(() => {
                    window.location.href = 'login.html?redirect=checkout.html';
                }, 1200);
                return;
            }
            closeCart();
            window.location.href = 'checkout.html';
        });
    }

    // Update cart UI on load
    updateCartUI();
});

// Mencetak produk kue ke dalam layout grid
function displayProducts(productsToRender) {
    const productsContainer = document.getElementById('products-container');
    if (!productsContainer) return;

    productsContainer.innerHTML = "";
    if (productsToRender.length === 0) {
        productsContainer.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: #888; margin: 20px 0;">Menu kue tidak ditemukan...</p>`;
        return;
    }

    productsToRender.forEach(product => {
        const productCard = document.createElement('div');
        productCard.classList.add('product-card');
        productCard.innerHTML = `
            <img src="${product.image}" alt="${product.name}" class="product-img">
            <div class="product-info">
                <h3>${product.name}</h3>
                <p class="product-desc">${product.desc}</p>
                <div class="product-meta">
                    <span class="price">${formatRupiah(product.price)}</span>
                    <button class="btn-add-cart" onclick="addToCart(${product.id})">
                        <i class="fa-solid fa-plus"></i>
                    </button>
                </div>
            </div>
        `;
        productsContainer.appendChild(productCard);
    });
}

// Memasukkan barang ke dalam keranjang belanja
async function addToCart(id) {
    const product  = products.find(p => p.id === id);
    const cartItem = cart.find(item => item.id === id);

    if (cartItem) {
        cartItem.qty++;
    } else {
        cart.push({ ...product, qty: 1 });
    }
    await saveCart();
    updateCartUI();
    openCart();
    showToast(product.name + ' ditambahkan ke keranjang!');
}

// Menambah atau mengurangi jumlah pcs item
async function changeQty(id, action) {
    const cartItem = cart.find(item => item.id === id);
    if (action === 'increase') {
        cartItem.qty++;
    } else if (action === 'decrease') {
        cartItem.qty--;
        if (cartItem.qty === 0) {
            cart = cart.filter(item => item.id !== id);
        }
    }
    await saveCart();
    updateCartUI();
}

// Mengupdate visual tampilan kalkulasi keranjang belanja
function updateCartUI() {
    const cartItemsContainer = document.getElementById('cart-items-container');
    const cartCount = document.getElementById('cart-count');
    const cartTotal = document.getElementById('cart-total');

    if (!cartCount) return;

    const totalItems = cart.reduce((acc, item) => acc + item.qty, 0);
    cartCount.innerText = totalItems;

    if (!cartItemsContainer) return;

    cartItemsContainer.innerHTML = "";
    if (cart.length === 0) {
        cartItemsContainer.innerHTML = `<p style="text-align: center; color: #888; margin-top: 35px;">Keranjang Anda kosong</p>`;
        if (cartTotal) cartTotal.innerText = formatRupiah(0);
        return;
    }

    cart.forEach(item => {
        const itemRow = document.createElement('div');
        itemRow.classList.add('cart-item');
        itemRow.innerHTML = `
            <img src="${item.image}" alt="${item.name}" class="cart-item-img">
            <div class="cart-item-details">
                <h4>${item.name}</h4>
                <span class="item-price">${formatRupiah(item.price * item.qty)}</span>
                <div class="cart-item-qty">
                    <button onclick="changeQty(${item.id}, 'decrease')">-</button>
                    <span>${item.qty}</span>
                    <button onclick="changeQty(${item.id}, 'increase')">+</button>
                </div>
            </div>
        `;
        cartItemsContainer.appendChild(itemRow);
    });

    const totalPrice = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
    if (cartTotal) cartTotal.innerText = formatRupiah(totalPrice);
}

// Buka - Tutup Sidebar Drawer Keranjang
function openCart() {
    const cartSidebar = document.getElementById('cart-sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    if (cartSidebar) cartSidebar.classList.add('open');
    if (sidebarOverlay) sidebarOverlay.classList.add('show');
}

function closeCart() {
    const cartSidebar = document.getElementById('cart-sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    if (cartSidebar) cartSidebar.classList.remove('open');
    if (sidebarOverlay) sidebarOverlay.classList.remove('show');
}