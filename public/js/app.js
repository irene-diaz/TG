// public/js/app.js (PARCHE: inicializar después de DOMContentLoaded)

// Init AOS (se inicializa dentro de DOMContentLoaded más abajo también por seguridad)
function safeInitAOS() {
    try {
        if (typeof AOS !== 'undefined' && AOS && typeof AOS.init === 'function') {
            AOS.init({ duration: 700, once: true, offset: 90 });
        } else {
            console.warn('AOS no está disponible (no se cargó).');
        }
    } catch (e) {
        console.error('Error inicializando AOS:', e);
    }
}

// Calculador (no requiere DOM)
function calcularMacros({ sex, age, weight, height, activityFactor, goal }) {
    const bmr = (sex === 'male') ? 10 * weight + 6.25 * height - 5 * age + 5 : 10 * weight + 6.25 * height - 5 * age - 161;
    const tdee = bmr * activityFactor;
    let calories = (goal === 'loss') ? Math.round(tdee * 0.85) : (goal === 'gain' ? Math.round(tdee * 1.15) : Math.round(tdee));
    const proteinG = Math.round(weight * 2.0);
    const proteinCal = proteinG * 4;
    const fatCal = Math.round(calories * 0.25);
    const fatG = Math.round(fatCal / 9);
    const remainingCal = calories - proteinCal - fatCal;
    const carbsG = Math.max(0, Math.round(remainingCal / 4));
    return { bmr: Math.round(bmr), tdee: Math.round(tdee), calories, proteinG, proteinCal, fatG, fatCal, carbsG };
}

// Helper seguro
function $id(id) { return document.getElementById(id) || null; }

document.addEventListener('DOMContentLoaded', () => {
    // Inicializa AOS si está disponible
    safeInitAOS();

    // Año en footer
    try {
        const yearEl = $id('year');
        if (yearEl) yearEl.textContent = new Date().getFullYear();
        else console.warn('#year no encontrado en DOM');
    } catch (e) { console.error('Error asignando year:', e); }

    // NAV: cambiar fondo al scrollear
    try {
        const nav = $id('siteNav');
        if (!nav) { console.warn('#siteNav no encontrado'); }
        else {
            function onScroll() {
                if (window.scrollY > 40) {
                    nav.classList.remove('default'); nav.classList.add('solid');
                } else {
                    nav.classList.remove('solid'); nav.classList.add('default');
                }
            }
            onScroll();
            window.addEventListener('scroll', onScroll, { passive: true });
        }
    } catch (e) { console.error('Navbar scroll error:', e); }

    // Parallax hero
    try {
        const bg = $id('heroBg');
        if (bg) {
            window.addEventListener('scroll', function () {
                try {
                    const sc = window.scrollY;
                    const y = Math.max(-30, -sc * 0.12);
                    bg.style.backgroundPosition = `center ${40 + y}%`;
                } catch (innerE) { console.error('Parallax error:', innerE); }
            }, { passive: true });
        }
    } catch (e) { console.error('Parallax setup error:', e); }

    // MACROS: listener de submit (si existe)
    try {
        const macrosForm = $id('macrosForm');
        if (macrosForm) {
            macrosForm.addEventListener('submit', async function (e) {
                e.preventDefault();
                try {
                    const sex = ($id('sex') && $id('sex').value) || 'male';
                    const goal = ($id('goal') && $id('goal').value) || 'maintain';
                    const age = Number(($id('age') && $id('age').value) || 0);
                    const weight = Number(($id('weight') && $id('weight').value) || 0);
                    const height = Number(($id('height') && $id('height').value) || 0);
                    const activityFactor = Number(($id('activity') && $id('activity').value) || 1.55);

                    if (!age || !weight || !height) { alert('Introduce edad, peso y altura válidos.'); return; }

                    const res = calcularMacros({ sex, age, weight, height, activityFactor, goal });

                    const html = `
              <div class="result-item"><div>Proteínas</div><div><strong>${res.proteinG} g</strong> · ${res.proteinCal} kcal</div></div>
              <div class="result-item"><div>Grasas</div><div><strong>${res.fatG} g</strong> · ${res.fatCal} kcal</div></div>
              <div class="result-item"><div>Carbohidratos</div><div><strong>${res.carbsG} g</strong> · ${Math.round(res.calories - (res.proteinCal + res.fatCal))} kcal</div></div>
            `;

                    const caloriesText = $id('caloriesText');
                    const macrosList = $id('macrosList');
                    const resultCard = $id('resultCard');

                    if (caloriesText) caloriesText.textContent = `Calorías diarias: ${res.calories} kcal · (TDEE aprox. ${res.tdee} kcal)`;
                    if (macrosList) macrosList.innerHTML = html;
                    if (resultCard) {
                        resultCard.classList.remove('d-none');
                        resultCard.scrollIntoView({ behavior: 'smooth' });
                    }

                    // intento de guardado
                    const token = getToken();
                    if (token) {
                        const ok = await saveProfile({ macros: { ...res, html } });
                        if (ok) console.log('Macros guardadas en perfil');
                    }
                } catch (innerE) { console.error('Error manejando macros submit:', innerE); }
            });
        } else {
            console.info('No hay formulario #macrosForm en esta página (no se añade listener).');
        }
    } catch (e) { console.error('Error asociado al listener del formulario macros:', e); }

    // Reset
    try {
        const resetBtn = $id('resetBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', function () {
                const f = $id('macrosForm'); if (f) f.reset();
                const rc = $id('resultCard'); if (rc) rc.classList.add('d-none');
            });
        }
    } catch (e) { console.error('ResetBtn error:', e); }

    // Contact fallback
    try {
        const form = $id('contactForm');
        if (form) {
            form.addEventListener('submit', function (e) {
                if (!form.action || form.action.indexOf('.php') === -1) {
                    e.preventDefault();
                    alert('Gracias — tu mensaje ha sido enviado (simulado).');
                    form.reset();
                }
            });
        }
    } catch (e) { console.error('Contact fallback error:', e); }

    // Collapse handlers mobile
    try {
        const navMain = $id('navMain');
        if (navMain) {
            navMain.addEventListener('show.bs.collapse', function () { navMain.classList.add('show'); });
            navMain.addEventListener('hidden.bs.collapse', function () { navMain.classList.remove('show'); });
        }
    } catch (e) { console.error('Collapse handlers error:', e); }

    // Auth + API helpers + register/login/save are defined below and can run safely since DOM is ready
    safeInitAuthAndApi(); // función definida más abajo
}); // end DOMContentLoaded

// ---------- API + Auth helpers (fuera de DOMContentLoaded, disponibles antes si hace falta) ----------
const API_BASE = 'http://localhost:4000/api';

function saveToken(token) { try { localStorage.setItem('miplan_token', token); } catch (e) { console.warn('No se pudo guardar token', e); } }
function getToken() { try { return localStorage.getItem('miplan_token'); } catch (e) { return null; } }
function logout() { try { localStorage.removeItem('miplan_token'); } catch (e) { } location.reload(); }

async function saveProfile(dataObj) {
    try {
        const token = getToken();
        if (!token) return false;
        const res = await fetch(`${API_BASE}/profile`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            body: JSON.stringify({ data: dataObj })
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Error guardando perfil');
        return true;
    } catch (err) {
        console.error('Error guardando perfil', err);
        return false;
    }
}

// Carga perfil y register/login: los enganchamos en una función y se ejecuta después del DOM
function safeInitAuthAndApi() {
    // Register
    try {
        const formRegister = $id('formRegister');
        if (formRegister) {
            formRegister.addEventListener('submit', async (e) => {
                e.preventDefault();
                try {
                    const name = ($id('regName') && $id('regName').value) || '';
                    const email = ($id('regEmail') && $id('regEmail').value) || '';
                    const password = ($id('regPassword') && $id('regPassword').value) || '';
                    const res = await fetch(`${API_BASE}/register`, {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name, email, password })
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || 'Error registro');
                    saveToken(data.token);
                    try { bootstrap.Modal.getInstance($id('modalRegister')).hide(); } catch (e) {/* ignore */ }
                    alert('Registrado y logueado correctamente');
                    loadProfileToUI();
                } catch (err) {
                    alert(err.message || err);
                }
            });
        }
    } catch (e) { console.error('Register listener error:', e); }

    // Login
    try {
        const formLogin = $id('formLogin');
        if (formLogin) {
            formLogin.addEventListener('submit', async (e) => {
                e.preventDefault();
                try {
                    const email = ($id('loginEmail') && $id('loginEmail').value) || '';
                    const password = ($id('loginPassword') && $id('loginPassword').value) || '';
                    const res = await fetch(`${API_BASE}/login`, {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email, password })
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || 'Error login');
                    saveToken(data.token);
                    try { bootstrap.Modal.getInstance($id('modalLogin')).hide(); } catch (e) {/* ignore */ }
                    alert('Bienvenido ' + (data.user.name || data.user.email));
                    loadProfileToUI();
                } catch (err) {
                    alert(err.message || err);
                }
            });
        }
    } catch (e) { console.error('Login listener error:', e); }

    // Cargar perfil al iniciar (si hay token)
    async function loadProfileToUI() {
        try {
            const token = getToken();
            if (!token) return;
            const res = await fetch(`${API_BASE}/profile`, { headers: { 'Authorization': 'Bearer ' + token } });
            if (!res.ok) throw new Error('No autorizado');
            const json = await res.json();
            if (json.data && json.data.macros) {
                const caloriesText = $id('caloriesText');
                const macrosList = $id('macrosList');
                const resultCard = $id('resultCard');
                if (caloriesText) caloriesText.textContent = `Calorías diarias: ${json.data.macros.calories} kcal · (TDEE aprox. ${json.data.macros.tdee} kcal)`;
                if (macrosList) macrosList.innerHTML = json.data.macros.html || '';
                if (resultCard) resultCard.classList.remove('d-none');
            }
            showLogoutInNav();
        } catch (err) {
            console.log('No se pudo cargar perfil', err);
        }
    }

    // Mostrar botón logout en nav
    function showLogoutInNav() {
        try {
            const ul = document.querySelector('.navbar-nav');
            if (!ul) return;
            if ($id('navLogout')) return;
            const li = document.createElement('li');
            li.className = 'nav-item';
            li.innerHTML = '<a id="navLogout" class="nav-link" href="#">Mi cuenta / Salir</a>';
            ul.appendChild(li);
            $id('navLogout').addEventListener('click', (e) => {
                e.preventDefault();
                logout();
            });
        } catch (e) { console.error('showLogoutInNav error:', e); }
    }

    // Ejecutar carga inicial de perfil (si hay token)
    try { loadProfileToUI(); } catch (e) { console.error('loadProfileToUI error', e); }
}
