// public/js/app.js (PARCHE: inicializar después de DOMContentLoaded)

// Cargar foodData desde JSON
let foodData = {}; // Variable global para almacenar los datos
async function loadFoodData() {
    try {
        const response = await fetch('foodData.json'); // Ruta relativa desde public/
        if (!response.ok) throw new Error('No se pudo cargar foodData.json');
        foodData = await response.json();
        console.log('foodData cargado:', Object.keys(foodData).length, 'platos');
    } catch (error) {
        console.error('Error cargando foodData:', error);
        // Fallback: datos básicos si falla
        foodData = {
            pollo_arroz_espinacas: { categoria: 'almuerzo', protein: 35, fat: 8, carbs: 45, kcal: 380 },
            // aqui podriamos añadir mas
        };
    }
}

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

// Función para generar un menú diario basado en macros objetivo
function generarMenuDiario(macrosObjetivo, dia) {
    // Distribución aproximada: 30% desayuno, 40% almuerzo, 20% cena, 10% snacks
    const distribucion = {
        desayuno: { protein: macrosObjetivo.proteinG * 0.3, fat: macrosObjetivo.fatG * 0.3, carbs: macrosObjetivo.carbsG * 0.3 },
        almuerzo: { protein: macrosObjetivo.proteinG * 0.4, fat: macrosObjetivo.fatG * 0.4, carbs: macrosObjetivo.carbsG * 0.4 },
        cena: { protein: macrosObjetivo.proteinG * 0.2, fat: macrosObjetivo.fatG * 0.2, carbs: macrosObjetivo.carbsG * 0.2 },
        snacks: { protein: macrosObjetivo.proteinG * 0.1, fat: macrosObjetivo.fatG * 0.1, carbs: macrosObjetivo.carbsG * 0.1 }
    };

    // Función auxiliar para seleccionar un plato completo por categoría
    function seleccionarPlato(categoria) {
        // Acceder directamente a la categoría en foodData (nueva estructura)
        const platosEnCategoria = foodData[categoria];
        if (!platosEnCategoria) {
            console.warn(`No hay platos para la categoría: ${categoria}`);
            return { nombre: 'Plato no disponible', porcion: 200, macros: { protein: 0, fat: 0, carbs: 0, kcal: 0 } };
        }

        const platoKeys = Object.keys(platosEnCategoria);
        const platoKey = platoKeys[Math.floor(Math.random() * platoKeys.length)];
        const data = platosEnCategoria[platoKey];
        const porcion = 200; // g, asumiendo un plato estándar
        return { nombre: platoKey.replace(/_/g, ' '), porcion, macros: data };
    }
    // Generar comidas
    // Generar comidas (cada una es un plato completo)
    const menu = {
        desayuno: [seleccionarPlato('desayuno')],
        almuerzo: [seleccionarPlato('almuerzo')],
        media_manana: [seleccionarPlato('media_manana')],  // Corregido: sin ñ
        cena: [seleccionarPlato('cena')],
        merienda: [seleccionarPlato('merienda')],
        snacks: [seleccionarPlato('snacks')]
    };

    return menu;
}

// Función para generar menú semanal (7 días)
function generarMenuSemanal(macrosObjetivo) {
    const semana = {};
    for (let dia = 1; dia <= 7; dia++) {
        semana[`Día ${dia}`] = generarMenuDiario(macrosObjetivo, dia);
    }
    return semana;
}

// Nueva función: generar plan de entrenamiento semanal personalizado
function generarPlanEntrenamiento(formData) {
    const { goal, activityFactor, age, weight, height, sex } = formData;
    const semana = {};

    // Ajustes basados en datos
    const esSedentario = activityFactor <= 1.375;
    const esActivo = activityFactor >= 1.725;
    const esJoven = age < 30;
    const esPesado = weight > 80;
    const esMujer = sex === 'female';
    const impactoBajo = !esJoven || esPesado; // Baja impacto para mayores o pesados

    // Función auxiliar para ajustar intensidad
    const ajustarIntensidad = (ejercicio) => {
        if (impactoBajo) return ejercicio.replace('pesos libres', 'máquina o banda elástica');
        if (esActivo) return ejercicio + ' (aumenta peso si es fácil)';
        return ejercicio;
    };

    for (let dia = 1; dia <= 7; dia++) {
        let entrenamiento = '';

        if (dia === 4 || dia === 7) {
            // Días de descanso: movilidad o recuperación
            entrenamiento = 'Descanso / Movilidad: Estiramientos dinámicos (10 min), yoga ligero o caminata suave (20-30 min).';
        } else {
            let ejercicios = [];
            let foco = '';

            switch (goal) {
                case 'loss':
                    // Énfasis en cardio y fuerza ligera para quemar calorías
                    foco = 'Pérdida de peso: Cardio + fuerza ligera';
                    if (dia === 1) {
                        ejercicios = [
                            ajustarIntensidad('Sentadillas: 3 series de 12 repeticiones (sin peso o con mancuernas ligeras)'),
                            'Burpees: 3 series de 10 repeticiones',
                            'Plancha: 3 series de 30 segundos',
                            'Caminadora o bici: 20-30 min a ritmo moderado'
                        ];
                    } else if (dia === 2) {
                        ejercicios = [
                            'Saltos de cuerda: 3 series de 2 min',
                            ajustarIntensidad('Flexiones de brazos: 3 series de 10 repeticiones'),
                            'Mountain climbers: 3 series de 20 repeticiones por pierna',
                            'Cardio HIIT: 20 min (alternar 30 seg sprint / 30 seg descanso)'
                        ];
                    } else if (dia === 3) {
                        ejercicios = [
                            ajustarIntensidad('Peso muerto rumano: 3 series de 10 repeticiones'),
                            'Remo con banda elástica: 3 series de 12 repeticiones',
                            'Abdominales: 3 series de 15 repeticiones',
                            'Caminata rápida: 30 min'
                        ];
                    } else if (dia === 5) {
                        ejercicios = [
                            'Circuito: Saltos, flexiones, sentadillas (3 rondas de 10 cada uno)',
                            'Plancha lateral: 3 series de 20 seg por lado',
                            'Bicicleta estática: 25 min'
                        ];
                    } else if (dia === 6) {
                        ejercicios = [
                            ajustarIntensidad('Press de hombros: 3 series de 12 repeticiones'),
                            'Elevaciones laterales: 3 series de 12 repeticiones',
                            'Cardio mixto: 30 min (correr/caminar)'
                        ];
                    }
                    break;
                case 'gain':
                    // Énfasis en fuerza e hipertrofia para ganar masa
                    foco = 'Ganancia muscular: Fuerza + hipertrofia';
                    if (dia === 1) {
                        ejercicios = [
                            ajustarIntensidad('Sentadillas: 4 series de 8-10 repeticiones (con barra o mancuernas)'),
                            ajustarIntensidad('Press de banca: 4 series de 8 repeticiones'),
                            'Remo con barra: 3 series de 10 repeticiones',
                            'Fondos en paralelas: 3 series de 10 repeticiones'
                        ];
                    } else if (dia === 2) {
                        ejercicios = [
                            ajustarIntensidad('Peso muerto: 4 series de 6-8 repeticiones'),
                            'Elevaciones de talones: 3 series de 12 repeticiones',
                            'Curl de bíceps: 3 series de 10 repeticiones',
                            'Extensiones de tríceps: 3 series de 10 repeticiones'
                        ];
                    } else if (dia === 3) {
                        ejercicios = [
                            ajustarIntensidad('Press militar: 4 series de 8 repeticiones'),
                            'Dominadas asistidas: 3 series de 8 repeticiones',
                            'Abdominales con peso: 3 series de 12 repeticiones',
                            'Puente de glúteos: 3 series de 15 repeticiones'
                        ];
                    } else if (dia === 5) {
                        ejercicios = [
                            ajustarIntensidad('Sentadillas frontales: 4 series de 8 repeticiones'),
                            'Press inclinado: 3 series de 10 repeticiones',
                            'Tirón a una mano: 3 series de 10 repeticiones por lado'
                        ];
                    } else if (dia === 6) {
                        ejercicios = [
                            'Circuito de fuerza: Sentadillas, press, remo (3 rondas de 8-10 cada uno)',
                            'Cardio ligero: 15 min para recuperación'
                        ];
                    }
                    break;
                case 'maintain':
                default:
                    // Mix equilibrado
                    foco = 'Mantenimiento: Mix de fuerza y cardio';
                    if (dia === 1) {
                        ejercicios = [
                            ajustarIntensidad('Sentadillas: 3 series de 10 repeticiones'),
                            ajustarIntensidad('Press de banca: 3 series de 10 repeticiones'),
                            'Plancha: 3 series de 45 segundos',
                            'Caminata: 20 min'
                        ];
                    } else if (dia === 2) {
                        ejercicios = [
                            'Burpees modificados: 3 series de 8 repeticiones',
                            ajustarIntensidad('Remo: 3 series de 12 repeticiones'),
                            'Abdominales: 3 series de 20 repeticiones',
                            'Bicicleta: 25 min'
                        ];
                    } else if (dia === 3) {
                        ejercicios = [
                            ajustarIntensidad('Peso muerto: 3 series de 10 repeticiones'),
                            'Flexiones: 3 series de 12 repeticiones',
                            'Elevaciones laterales: 3 series de 12 repeticiones'
                        ];
                    } else if (dia === 5) {
                        ejercicios = [
                            ajustarIntensidad('Press de hombros: 3 series de 10 repeticiones'),
                            'Dominadas: 3 series de 6-8 repeticiones',
                            'Circuito cardio: 20 min'
                        ];
                    } else if (dia === 6) {
                        ejercicios = [
                            'Circuito mixto: Saltos, flexiones, sentadillas (3 rondas)',
                            'Estiramientos: 10 min'
                        ];
                    }
                    break;
            }

            // Ajustes adicionales por sexo
            if (esMujer && goal === 'gain') {
                // Más foco en glúteos/core para mujeres
                ejercicios.push('Puente de glúteos: 3 series de 15 repeticiones');
            }

            // Ajustes por actividad
            if (esSedentario) {
                ejercicios.push('Añade 10-15 min de cardio extra al final');
            }

            // Formatear el día
            entrenamiento = `${foco}\n- ${ejercicios.join('\n- ')}\nNota: Calienta 5 min antes. Descansa 60-90 seg entre series. Consulta a un entrenador si eres principiante.`;
        }

        semana[`Día ${dia}`] = entrenamiento;
    }

    return semana;
}


// Helper seguro
function $id(id) { return document.getElementById(id) || null; }

document.addEventListener('DOMContentLoaded', async () => {
    await loadFoodData(); // Cargar datos antes de inicializar
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

                    // Generar menú semanal basado en res
                    const menuSemanal = generarMenuSemanal(res);

                    // Generar plan de entrenamiento personalizado
                    const formData = { sex, goal, age, weight, height, activityFactor };
                    const planEntrenamiento = generarPlanEntrenamiento(formData);

                    // Construir HTML para el menú
                    let menuHtml = '<h6>Menú semanal sugerido</h6><div class="menu-semanal">';
                    for (const [dia, comidas] of Object.entries(menuSemanal)) {
                        menuHtml += `<div class="dia-menu"><h7>${dia}</h7>`;
                        for (const [comida, platos] of Object.entries(comidas)) {
                            const plato = platos[0];
                            menuHtml += `<p><strong>${comida.charAt(0).toUpperCase() + comida.slice(1)}:</strong> ${plato.nombre} (${plato.porcion}g).</p>`;
                        }
                        menuHtml += '</div>';
                    }
                    menuHtml += '</div>';

                    // Construir HTML para el plan de entrenamiento
                    let entrenamientoHtml = '<h6>Plan de entrenamiento semanal</h6><ul class="small mb-0">';
                    for (const [dia, actividad] of Object.entries(planEntrenamiento)) {
                        entrenamientoHtml += `<li><strong>${dia}:</strong> ${actividad}</li>`;
                    }
                    entrenamientoHtml += '</ul>';

                    // Añadir al HTML de resultCard
                    const resultCard = $id('resultCard');
                    if (resultCard) {
                        const existingMenu = resultCard.querySelector('.menu-semanal');
                        if (existingMenu) existingMenu.remove();
                        resultCard.insertAdjacentHTML('beforeend', menuHtml);
                        const existingPlan = resultCard.querySelector('h6 + ul');
                        if (existingPlan) existingPlan.outerHTML = entrenamientoHtml;
                        else resultCard.insertAdjacentHTML('beforeend', entrenamientoHtml);
                    }

                    // Guardar en localStorage
                    const lastPlan = {
                        form: formData,
                        macros: res,
                        menu: menuSemanal,
                        entrenamiento: planEntrenamiento,
                        html: html + menuHtml + entrenamientoHtml
                    };
                    localStorage.setItem('miplan_lastPlan', JSON.stringify(lastPlan));

                    const caloriesText = $id('caloriesText');
                    const macrosList = $id('macrosList');

                    if (caloriesText) caloriesText.textContent = `Calorías diarias: ${res.calories} kcal · (TDEE aprox. ${res.tdee} kcal)`;
                    if (macrosList) macrosList.innerHTML = html;
                    if (resultCard) {
                        resultCard.classList.remove('d-none');
                        resultCard.scrollIntoView({ behavior: 'smooth' });
                    }

                    // Guardado en perfil
                    const token = getToken();
                    if (token) {
                        const ok = await saveProfile({ macros: { ...res, html } });
                        if (ok) console.log('Macros guardadas en perfil');
                    }
                } catch (innerE) {
                    console.error('Error manejando macros submit:', innerE);
                    alert('Error calculando el plan. Revisa la consola para detalles.');
                }
            });
        } else {
            console.info('No hay formulario #macrosForm en esta página (no se añade listener).');
        }
    } catch (e) {
        console.error('Error asociado al listener del formulario macros:', e);
    }

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

    // --- Añadir botón "Guardar plan" en resultCard y manejar envío a /api/results (con debug) ---
    (function installSavePlanFeature() {
        const resultCard = $id('resultCard');
        if (!resultCard) return;

        // Buscar el botón existente o crearlo si no existe
        let btn = resultCard.querySelector('.save-plan-btn');
        if (!btn) {
            btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'btn btn-outline-dark btn-sm save-plan-btn mt-3';
            btn.textContent = 'Guardar plan';
            resultCard.appendChild(btn);  // Solo si no existía
        }

        // Añadir el listener (siempre, independientemente de si existía o no)
        btn.addEventListener('click', async () => {
            // Evitar múltiples envíos
            if (btn.disabled) return;

            // Recuperar plan calculado guardado en localStorage
            const raw = localStorage.getItem('miplan_lastPlan');
            if (!raw) {
                console.warn('No hay plan en localStorage');
                return alert('Calcula un plan primero antes de guardarlo.');
            }

            let lastPlan;
            try { lastPlan = JSON.parse(raw); }
            catch (e) {
                console.error('Error parseando lastPlan:', e);
                return alert('Plan corrupto en localStorage. Calcula de nuevo.');
            }

            const token = getToken();
            if (!token) {
                console.warn('No hay token de usuario');
                return alert('Para guardar un plan debes iniciar sesión.');
            }

            btn.disabled = true;
            const previousText = btn.textContent;
            btn.textContent = 'Guardando...';

            const payload = {
                resultData: lastPlan,
                summary: `Plan ${lastPlan.form.goal} — ${new Date().toLocaleString()}`
            };
            console.log('Guardar plan payload:', payload);
            console.log('Token:', token);

            try {
                const resp = await fetch(`${API_BASE}/results`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify(payload)
                });

                console.log('Respuesta fetch:', resp.status, resp.statusText);
                const json = await resp.json().catch(() => ({}));
                console.log('JSON devuelto:', json);

                if (!resp.ok) throw new Error(json.error || `Error ${resp.status}`);

                // Guardado correcto
                localStorage.setItem('miplan_lastSavedResultId', json.id || '');
                resultCard.setAttribute('data-saved', 'true');
                alert('Plan guardado correctamente.');
                btn.textContent = 'Guardado';
            } catch (err) {
                console.error('Error guardando plan:', err);
                alert('No se pudo guardar el plan. Revisa consola para detalles.');
                btn.textContent = previousText;
            } finally {
                btn.disabled = false;
            }
        });
    })();


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

// ---------- Mis planes: listar, ver y eliminar (integrar en public/js/app.js) ----------
(function initMyPlansFeature() {
    // Referencias
    const modalEl = document.getElementById('modalMyPlans');
    const myPlansList = document.getElementById('myPlansList');
    if (!modalEl || !myPlansList) return; // nada que hacer si no existe el modal en HTML

    // Utility: formatea fecha ISO -> legible
    function fmtDate(iso) {
        try {
            const d = new Date(iso);
            return d.toLocaleString();
        } catch (e) { return iso; }
    }

    // Muestra aviso central cuando no hay token
    function renderNotAuth() {
        myPlansList.innerHTML = `
        <div class="text-center py-4">
          <p class="mb-2 small text-muted">Debes iniciar sesión para ver tus planes guardados.</p>
          <div><button class="btn btn-cta btn-sm" data-bs-toggle="modal" data-bs-target="#modalLogin">Entrar</button></div>
        </div>
      `;
    }

    // Renderiza un item de plan en la lista
    function renderPlanItem(item) {
        // item: { id, summary, created_at }
        const container = document.createElement('div');
        container.className = 'myplan-item d-flex flex-column gap-2 py-2 border-bottom';

        const top = document.createElement('div');
        top.className = 'd-flex align-items-center justify-content-between';

        const left = document.createElement('div');
        left.innerHTML = `<strong>${item.summary ? escapeHtml(item.summary) : 'Plan #' + item.id}</strong>
                        <div class="small text-muted">${fmtDate(item.created_at)}</div>`;

        const right = document.createElement('div');
        right.className = 'd-flex gap-2 align-items-center';

        const viewBtn = document.createElement('button');
        viewBtn.className = 'btn btn-sm btn-outline-dark';
        viewBtn.textContent = 'Ver';
        viewBtn.type = 'button';

        const delBtn = document.createElement('button');
        delBtn.className = 'btn btn-sm btn-outline-danger';
        delBtn.textContent = 'Eliminar';
        delBtn.type = 'button';

        right.appendChild(viewBtn);
        right.appendChild(delBtn);

        top.appendChild(left);
        top.appendChild(right);

        // Area para detalle (oculto inicialmente)
        const detailArea = document.createElement('div');
        detailArea.className = 'myplan-detail mt-2 small';
        detailArea.style.display = 'none';
        detailArea.innerHTML = '<div class="text-muted">Cargando...</div>';

        container.appendChild(top);
        container.appendChild(detailArea);

        // Ver -> fetch detalle y mostrar (toggle)
        viewBtn.addEventListener('click', async () => {
            if (detailArea.style.display === 'block') {
                detailArea.style.display = 'none';
                viewBtn.textContent = 'Ver';
                return;
            }

            const token = getToken();
            if (!token) {
                alert('Debes iniciar sesión para ver los detalles.');
                return;
            }

            viewBtn.disabled = true;
            viewBtn.textContent = 'Cargando...';
            try {
                const resp = await fetch(`${API_BASE}/results/${item.id}`, {
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                if (!resp.ok) {
                    const err = await resp.json().catch(() => ({}));
                    throw new Error(err.error || ('Error ' + resp.status));
                }
                const json = await resp.json();

                const rd = json.result_data;
                const pretty = escapeHtml(JSON.stringify(rd, null, 2));

                // construir vista amigable: resumen del formulario y resultados
                let inner = '<h6>Resumen del plan:</h6>';

                // Resumen del formulario
                if (rd.form) {
                    inner += '<div class="mb-3"><strong>Datos del formulario:</strong><br>';
                    inner += `Sexo: ${rd.form.sex === 'male' ? 'Hombre' : 'Mujer'}<br>`;
                    inner += `Objetivo: ${rd.form.goal === 'loss' ? 'Perder peso' : rd.form.goal === 'gain' ? 'Ganar masa' : 'Mantener'}<br>`;
                    inner += `Edad: ${rd.form.age} años<br>`;
                    inner += `Peso: ${rd.form.weight} kg<br>`;
                    inner += `Altura: ${rd.form.height} cm<br>`;
                    inner += `Nivel de actividad: ${rd.form.activityFactor === '1.2' ? 'Sedentario' : rd.form.activityFactor === '1.375' ? 'Ligero' : rd.form.activityFactor === '1.55' ? 'Moderado' : rd.form.activityFactor === '1.725' ? 'Activo' : 'Muy activo'}</div>`;
                }

                // Resumen de macros
                if (rd.macros) {
                    inner += '<div class="mb-3"><strong>Resultados calculados:</strong><br>';
                    inner += `Calorías diarias: ${rd.macros.calories} kcal (TDEE aprox. ${rd.macros.tdee} kcal)<br>`;
                    inner += `Proteínas: ${rd.macros.proteinG} g (${rd.macros.proteinCal} kcal)<br>`;
                    inner += `Grasas: ${rd.macros.fatG} g (${rd.macros.fatCal} kcal)<br>`;
                    inner += `Carbohidratos: ${Math.round((rd.macros.calories - rd.macros.proteinCal - rd.macros.fatCal) / 4)} g (${Math.round(rd.macros.calories - rd.macros.proteinCal - rd.macros.fatCal)} kcal)</div>`;
                }

                // Añadir menú si existe
                if (rd.menu) {
                    inner += '<h6>Menú semanal sugerido:</h6>';
                    for (const [dia, comidas] of Object.entries(rd.menu)) {
                        inner += `<div><strong>${dia}:</strong>`;
                        for (const [comida, platos] of Object.entries(comidas)) {
                            inner += `<p>${comida}: ${platos[0].nombre} (${platos[0].porcion}g).</p>`;
                        }
                        inner += '</div>';
                    }
                }

                // Añadir entrenamiento si existe
                if (rd.entrenamiento) {
                    inner += '<h6>Plan de entrenamiento semanal:</h6>';
                    for (const [dia, actividad] of Object.entries(rd.entrenamiento)) {
                        inner += `<div><strong>${dia}:</strong><br>${actividad.replace(/\n/g, '<br>')}</div>`;
                    }
                }

                inner += `<div class="mt-2 d-flex gap-2"><button class="btn btn-sm btn-outline-secondary download-json">Descargar JSON completo</button>
<button class="btn btn-sm btn-outline-dark copy-json">Copiar JSON completo</button></div>`;
                detailArea.innerHTML = inner;

                // handlers for download / copy
                detailArea.querySelector('.download-json').addEventListener('click', () => {
                    const blob = new Blob([JSON.stringify(rd, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `miplan_result_${item.id}.json`;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    URL.revokeObjectURL(url);
                });
                detailArea.querySelector('.copy-json').addEventListener('click', async () => {
                    try {
                        await navigator.clipboard.writeText(JSON.stringify(rd, null, 2));
                        alert('JSON completo copiado al portapapeles.');
                    } catch (e) { alert('No se pudo copiar al portapapeles.'); }
                });

                detailArea.style.display = 'block';
                viewBtn.textContent = 'Ocultar';
            } catch (err) {
                console.error('Ver plan error', err);
                alert('No se pudo cargar el detalle del plan.');
                detailArea.innerHTML = '<div class="text-danger small">Error cargando detalle.</div>';
            } finally {
                viewBtn.disabled = false;
            }
        });

        // Eliminar -> confirm y DELETE
        delBtn.addEventListener('click', async () => {
            const ok = confirm('¿Eliminar este plan? Esta acción no se puede deshacer.');
            if (!ok) return;
            const token = getToken();
            if (!token) {
                alert('Debes iniciar sesión para eliminar planes.');
                return;
            }
            delBtn.disabled = true;
            delBtn.textContent = 'Eliminando...';
            try {
                const resp = await fetch(`${API_BASE}/results/${item.id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                if (!resp.ok) {
                    const err = await resp.json().catch(() => ({}));
                    throw new Error(err.error || ('Error ' + resp.status));
                }
                // refrescar lista
                await loadMyPlans();
            } catch (err) {
                console.error('Eliminar plan error', err);
                alert('No se pudo eliminar el plan.');
                delBtn.disabled = false;
                delBtn.textContent = 'Eliminar';
            }
        });

        return container;
    }

    // Escape HTML (básico) para evitar inyección al renderizar strings
    function escapeHtml(str) {
        if (!str && str !== 0) return '';
        return String(str)
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');
    }

    // Cargar lista de planes desde API y renderizar
    async function loadMyPlans(page = 1) {
        myPlansList.innerHTML = '<div class="text-center py-4"><div class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></div> Cargando planes...</div>';
        const token = getToken();
        if (!token) {
            renderNotAuth();
            return;
        }

        try {
            const resp = await fetch(`${API_BASE}/results?page=${page}&perPage=20`, {
                headers: { 'Authorization': 'Bearer ' + token }
            });
            if (!resp.ok) {
                if (resp.status === 401) { renderNotAuth(); return; }
                const err = await resp.json().catch(() => ({}));
                throw new Error(err.error || ('Error ' + resp.status));
            }
            const json = await resp.json();
            const rows = Array.isArray(json.results) ? json.results : [];
            if (rows.length === 0) {
                myPlansList.innerHTML = `<div class="text-center py-4 small text-muted">No tienes planes guardados.</div>`;
                return;
            }
            // Render list
            myPlansList.innerHTML = '';
            rows.forEach(r => {
                const node = renderPlanItem(r);
                myPlansList.appendChild(node);
            });

            // Si hay más páginas podrías añadir paginador aquí (no implementado por simplicidad)
        } catch (err) {
            console.error('loadMyPlans error', err);
            myPlansList.innerHTML = `<div class="text-danger small py-3">Error cargando planes.</div>`;
        }
    }

    // Hook: cuando se abre el modal, cargar la lista
    modalEl.addEventListener('show.bs.modal', function () {
        loadMyPlans();
    });

    // Exponer función para abrir modal desde la UI si se requiere
    window.openMyPlans = function () {
        const bsModal = new bootstrap.Modal(modalEl);
        bsModal.show();
    };

})();

