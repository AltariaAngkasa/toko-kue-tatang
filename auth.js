// ==========================================
// auth.js — Sistem Autentikasi via PHP API
// ==========================================

// Deteksi environment: Vercel pakai /api, lokal PHP pakai api/
const API_BASE = window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1') || window.location.hostname.includes('laragon')
    ? 'api'
    : '/api';

// ============================
// Cek session dari server
// ============================
async function getCurrentUser() {
    try {
        const res = await fetch(`${API_BASE}/auth.php?action=session`, { credentials: 'include' });
        const json = await res.json();
        if (json.success) return json.data;
        return null;
    } catch {
        return null;
    }
}

// Cache user aktif
let _currentUser = null;

function getCachedUser() {
    return _currentUser;
}

function isLoggedIn() {
    return _currentUser !== null;
}

// ============================
// Login Handler
// ============================
async function handleLogin(e) {
    e.preventDefault();
    const email    = document.getElementById('login-email').value.trim().toLowerCase();
    const password = document.getElementById('login-password').value;

    const btn = document.getElementById('btn-login');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Memproses...';

    try {
        const res  = await fetch(`${API_BASE}/auth.php?action=login`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });
        const json = await res.json();

        if (json.success) {
            _currentUser = json.data;
            showAuthAlert('success', `${json.message} 🎉`);
            setTimeout(() => {
                const params = new URLSearchParams(window.location.search);
                let redirect = params.get('redirect');
                if (!redirect) {
                    redirect = json.data.role === 'admin' ? 'admin.html' : 'index.html';
                }
                window.location.href = redirect;
            }, 1200);
        } else {
            showAuthAlert('error', json.message);
            btn.disabled = false;
            btn.innerHTML = '<span>Masuk Sekarang</span><i class="fa-solid fa-arrow-right"></i>';
        }
    } catch {
        showAuthAlert('error', 'Gagal terhubung ke server. Coba lagi.');
        btn.disabled = false;
        btn.innerHTML = '<span>Masuk Sekarang</span><i class="fa-solid fa-arrow-right"></i>';
    }
}

// ============================
// Signup Handler
// ============================
async function handleSignup(e) {
    e.preventDefault();
    const name     = document.getElementById('signup-name').value.trim();
    const email    = document.getElementById('signup-email').value.trim().toLowerCase();
    const phone    = document.getElementById('signup-phone').value.trim();
    const password = document.getElementById('signup-password').value;

    const btn = document.getElementById('btn-signup');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Memproses...';

    try {
        const res  = await fetch(`${API_BASE}/auth.php?action=register`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, phone, password }),
        });
        const json = await res.json();

        if (json.success) {
            _currentUser = json.data;
            showAuthAlert('success', `${json.message} 🎉`);
            setTimeout(() => {
                const params  = new URLSearchParams(window.location.search);
                const redirect = params.get('redirect') || 'index.html';
                window.location.href = redirect;
            }, 1200);
        } else {
            showAuthAlert('error', json.message);
            btn.disabled = false;
            btn.innerHTML = '<span>Buat Akun</span><i class="fa-solid fa-user-plus"></i>';
        }
    } catch {
        showAuthAlert('error', 'Gagal terhubung ke server. Coba lagi.');
        btn.disabled = false;
        btn.innerHTML = '<span>Buat Akun</span><i class="fa-solid fa-user-plus"></i>';
    }
}

// ============================
// Logout
// ============================
async function logout() {
    try {
        await fetch(`${API_BASE}/auth.php?action=logout`, { credentials: 'include' });
    } catch { /* abaikan */ }
    _currentUser = null;
    window.location.href = 'index.html';
}

// ============================
// Render UI User di Navbar
// ============================
function renderNavbarUser() {
    const area = document.getElementById('user-nav-area');
    if (!area) return;

    const user = getCachedUser();
    if (user) {
        const initial = user.name.charAt(0).toUpperCase();
        const isAdmin = user.role === 'admin';
        area.innerHTML = `
            <div class="user-nav-group">
                ${isAdmin ? `
                <a href="admin.html" class="nav-link-btn admin-btn">
                    <i class="fa-solid fa-user-shield"></i> Admin Panel
                </a>
                ` : `
                <a href="history.html" class="nav-link-btn hist-btn">
                    <i class="fa-solid fa-clock-rotate-left"></i> Pesanan
                </a>
                `}
                <div class="user-avatar-btn" id="user-trigger" onclick="toggleUserDropdown()">
                    <div class="user-avatar">${initial}</div>
                    <span class="user-name-short">${user.name.split(' ')[0]}</span>
                    <i class="fa-solid fa-chevron-down" style="font-size:0.75rem;"></i>
                </div>
                <div class="user-dropdown" id="user-dropdown">
                    <div class="dropdown-header">
                        <div class="dropdown-avatar">${initial}</div>
                        <div>
                            <strong>${user.name}</strong>
                            <small>${user.email}</small>
                        </div>
                    </div>
                    ${isAdmin ? `
                    <a href="admin.html" class="dropdown-item"><i class="fa-solid fa-user-shield"></i> Admin Panel</a>
                    ` : `
                    <a href="history.html" class="dropdown-item"><i class="fa-solid fa-clock-rotate-left"></i> Riwayat Pesanan</a>
                    `}
                    <div class="dropdown-divider"></div>
                    <button class="dropdown-item logout-btn" onclick="logout()"><i class="fa-solid fa-right-from-bracket"></i> Keluar</button>
                </div>
            </div>
        `;
    } else {
        area.innerHTML = `
            <a href="login.html" class="btn-login-nav">
                <i class="fa-solid fa-right-to-bracket"></i> Masuk
            </a>
        `;
    }
}

function toggleUserDropdown() {
    const dd = document.getElementById('user-dropdown');
    if (dd) dd.classList.toggle('show');
}

// ============================
// Helper untuk halaman Login
// ============================
function showAuthAlert(type, message) {
    const el = document.getElementById('auth-alert');
    if (!el) return;
    el.style.display = 'flex';
    el.className = 'auth-alert auth-alert-' + type;
    el.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'}"></i> ${message}`;
}

function switchTab(tab) {
    const loginForm  = document.getElementById('form-login');
    const signupForm = document.getElementById('form-signup');
    const tabLogin   = document.getElementById('tab-login');
    const tabSignup  = document.getElementById('tab-signup');
    const alertEl    = document.getElementById('auth-alert');

    if (alertEl) alertEl.style.display = 'none';

    if (tab === 'login') {
        if (loginForm) loginForm.classList.remove('hidden');
        if (signupForm) signupForm.classList.add('hidden');
        if (tabLogin) tabLogin.classList.add('active');
        if (tabSignup) tabSignup.classList.remove('active');
    } else {
        if (loginForm) loginForm.classList.add('hidden');
        if (signupForm) signupForm.classList.remove('hidden');
        if (tabLogin) tabLogin.classList.remove('active');
        if (tabSignup) tabSignup.classList.add('active');
    }
}

function togglePassword(inputId, iconEl) {
    const input = document.getElementById(inputId);
    if (!input) return;
    if (input.type === 'password') {
        input.type = 'text';
        iconEl.classList.replace('fa-eye', 'fa-eye-slash');
    } else {
        input.type = 'password';
        iconEl.classList.replace('fa-eye-slash', 'fa-eye');
    }
}

function fillDemo(email, password) {
    const emailEl = document.getElementById('login-email');
    const passEl = document.getElementById('login-password');
    if (emailEl) emailEl.value = email;
    if (passEl) passEl.value = password;
    switchTab('login');
}

// ============================
// Init saat halaman load
// ============================
document.addEventListener('DOMContentLoaded', async () => {
    // Ambil session dari server
    _currentUser = await getCurrentUser();

    renderNavbarUser();

    // Protect halaman
    const protectedPages = ['checkout.html', 'payment.html', 'history.html'];
    const currentPage    = window.location.pathname.split('/').pop() || 'index.html';
    const user           = getCachedUser();

    if (currentPage === 'admin.html') {
        if (!user || user.role !== 'admin') {
            window.location.href = 'login.html?redirect=admin.html';
            return;
        }
    } else if (protectedPages.includes(currentPage) && !isLoggedIn()) {
        window.location.href = `login.html?redirect=${currentPage}`;
        return;
    }

    // Close dropdown saat klik luar
    document.addEventListener('click', (e) => {
        const trigger  = document.getElementById('user-trigger');
        const dropdown = document.getElementById('user-dropdown');
        if (dropdown && trigger && !trigger.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.remove('show');
        }
    });

    // Dispatch event agar script lain tahu auth sudah siap
    document.dispatchEvent(new CustomEvent('authReady', { detail: { user: _currentUser } }));
});
