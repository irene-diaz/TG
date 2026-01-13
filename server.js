// server.js
const express = require('express'); //framework para crear el servidor y las rutas
const sqlite3 = require('sqlite3'); //permite conectar con la base de datos
const bcrypt = require('bcrypt'); //cifra contraseñas (seguridad)
const jwt = require('jsonwebtoken'); //crea tokens para la autenticación
const bodyParser = require('body-parser'); //lee datos JSON enviados desde el frontend
const cors = require('cors'); //permite que el frontend se comunique con el backend
const path = require('path'); //gestiona rutas de archivos

const DB_FILE = path.join(__dirname, 'data.db'); //Define dónde está la base de datos
const JWT_SECRET = process.env.JWT_SECRET || 'CAMBIA_ESTE_SECRETO_EN_PRODUC'; //Define la clave secreta para firmar los tokens
const TOKEN_EXPIRES = '7d'; //establece el tiempo que dura la sesion

//abrimos la base de datos para poder hacer consultas SQL
const db = new sqlite3.Database(DB_FILE);

// Inicializar tablas(por si acaso la base de datos esta vacia, la inicializamos desde el backend)
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
    db.run(`CREATE TABLE IF NOT EXISTS profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    data TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id)
  )`);
    db.run(`CREATE TABLE IF NOT EXISTS results(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        result_data TEXT NOT NULL, --JSON con resultados del análisis
    summary TEXT, --opcional: texto corto para listados
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_results_user_id ON results(user_id)`);
});


const app = express(); //crea el servidor
app.use(cors()); //permite peticiones desde el frontend
app.use(bodyParser.json()); //permite recibir datos en formato JSON

// servir archivos estáticos desde la carpeta "public" (css, js, img, index.html), html, css y js
app.use(express.static(path.join(__dirname, 'public')));

// Forzar entrega de public/index.html en la raíz (útil para SPA / fallback)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


// crear token(Genera un JWT con datos del usuario (ID y email), firmado con la clave secreta y con expiración de 7 días.)
function createToken(user) {
    return jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: TOKEN_EXPIRES });
}

// Middleware auth(Comprueba si el usuario ha enviado un token, verifica que el token sea válido, permite o bloquea el acceso a rutas protegidas)
function authMiddleware(req, res, next) {
    const auth = req.headers['authorization'];
    if (!auth) return res.status(401).json({ error: 'No token' });
    const parts = auth.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') return res.status(401).json({ error: 'Formato token inválido' });
    const token = parts[1];
    jwt.verify(token, JWT_SECRET, (err, payload) => {
        if (err) return res.status(401).json({ error: 'Token inválido' });
        req.user = payload;
        next();
    });
}

//MANEJO DE ENDPOINTS

/* Registro(Recibe email, contraseña y nombre. Encripta la contraseña con bcrypt (10 rondas de sal para seguridad), inserta en la BD y 
devuelve un token si es exitoso. Maneja errores como email duplicado.)*/
app.post('/api/register', async (req, res) => {
    try {
        const { email, password, name } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Email y contraseña requeridos' });

        const saltRounds = 10;
        const hash = await bcrypt.hash(password, saltRounds);

        const stmt = db.prepare('INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)');
        stmt.run(email, hash, name || null, function (err) {
            if (err) {
                if (err.code === 'SQLITE_CONSTRAINT') return res.status(409).json({ error: 'Email ya registrado' });
                return res.status(500).json({ error: 'Error en DB' });
            }
            const user = { id: this.lastID, email, name };
            const token = createToken(user);
            return res.json({ token, user });
        });
    } catch (e) {
        return res.status(500).json({ error: 'Server error' });
    }
});

// Login(Busca el usuario por email, compara la contraseña encriptada y devuelve un token si coincide. Devuelve error si no existe o no coincide.)
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email y contraseña requeridos' });

    db.get('SELECT id, email, password_hash, name FROM users WHERE email = ?', [email], async (err, row) => {
        if (err) return res.status(500).json({ error: 'Error DB' });
        if (!row) return res.status(401).json({ error: 'Credenciales inválidas' });

        const match = await bcrypt.compare(password, row.password_hash);
        if (!match) return res.status(401).json({ error: 'Credenciales inválidas' });

        const user = { id: row.id, email: row.email, name: row.name };
        const token = createToken(user);
        res.json({ token, user });
    });
});

// Obtener perfil del usuario(recupera los datos del formulario(BD), usa JSON para flexibilidad y protegido por autenticación)
app.get('/api/profile', authMiddleware, (req, res) => {
    const userId = req.user.id;
    db.get('SELECT data, updated_at FROM profiles WHERE user_id = ?', [userId], (err, row) => {
        if (err) return res.status(500).json({ error: 'Error DB' });
        if (!row) return res.json({ data: null });
        try {
            const data = JSON.parse(row.data);
            return res.json({ data, updated_at: row.updated_at });
        } catch (e) {
            return res.status(500).json({ error: 'Error parseando datos' });
        }
    });
});

// Guarda planes personalizados( Guarda o actualiza el perfil (datos en JSON). Usa INSERT OR UPDATE para manejar si ya existe.)
app.post('/api/profile', authMiddleware, (req, res) => {
    const userId = req.user.id;
    const dataObj = req.body.data || {};
    const dataJSON = JSON.stringify(dataObj);

    // Intentar UPDATE, si no existe -> INSERT
    db.run(
        `INSERT INTO profiles (user_id, data) 
     VALUES (?, ?)
     ON CONFLICT(user_id) DO UPDATE SET data=excluded.data, updated_at=CURRENT_TIMESTAMP;`,
        [userId, dataJSON],
        function (err) {
            // Not all SQLite versions accept ON CONFLICT with user_id unless unique; safe approach: try get+insert/update
            if (err) {
                // fallback: ver si hay fila y actualizar/insertasr manualmente
                db.get('SELECT id FROM profiles WHERE user_id = ?', [userId], (e, row) => {
                    if (e) return res.status(500).json({ error: 'Error DB' });
                    if (row) {
                        db.run('UPDATE profiles SET data = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?', [dataJSON, userId], (err2) => {
                            if (err2) return res.status(500).json({ error: 'Error DB' });
                            return res.json({ ok: true });
                        });
                    } else {
                        db.run('INSERT INTO profiles (user_id, data) VALUES (?, ?)', [userId, dataJSON], (err3) => {
                            if (err3) return res.status(500).json({ error: 'Error DB' });
                            return res.json({ ok: true });
                        });
                    }
                });
            } else {
                return res.json({ ok: true });
            }
        }
    );
});

// endpoint para obtener info del usuario(Devuelve información básica del usuario autenticado (ID, email, nombre, fecha de creación).
app.get('/api/me', authMiddleware, (req, res) => {
    db.get('SELECT id, email, name, created_at FROM users WHERE id = ?', [req.user.id], (err, row) => {
        if (err) return res.status(500).json({ error: 'Error DB' });
        res.json({ user: row });
    });
});

//Define el puerto (4000 por defecto o desde variable de entorno)
const PORT = process.env.PORT || 4000;

// ------------------ RESULTS endpoints (protected) ------------------

// Crear resultado (Guarda un nuevo resultado (datos en JSON, resumen opcional)
app.post('/api/results', authMiddleware, (req, res) => {
    try {
        const userId = req.user.id;
        const { resultData, summary } = req.body || {};
        if (!resultData) return res.status(400).json({ error: 'Faltan datos: resultData' });

        let json;
        try { json = JSON.stringify(resultData); } catch (e) {
            return res.status(400).json({ error: 'resultData no serializable a JSON' });
        }

        const stmt = db.prepare('INSERT INTO results (user_id, result_data, summary) VALUES (?, ?, ?)');
        stmt.run(userId, json, summary || null, function (err) {
            if (err) {
                console.error('INSERT results error', err);
                return res.status(500).json({ error: 'Error guardando resultado' });
            }
            return res.status(201).json({ id: this.lastID, created_at: new Date().toISOString() });
        });
    } catch (err) {
        console.error('POST /api/results', err);
        res.status(500).json({ error: 'Error interno' });
    }
});

// Lista resultados del usuario con paginación (página y límite por página).
app.get('/api/results', authMiddleware, (req, res) => {
    try {
        const userId = req.user.id;
        const page = Math.max(parseInt(req.query.page || '1', 10), 1);
        const perPage = Math.min(parseInt(req.query.perPage || '20', 10), 100);
        const offset = (page - 1) * perPage;

        db.all(
            'SELECT id, summary, created_at FROM results WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
            [userId, perPage, offset],
            (err, rows) => {
                if (err) {
                    console.error('GET /api/results db.all error', err);
                    return res.status(500).json({ error: 'Error leyendo resultados' });
                }
                res.json({ results: rows || [], page });
            }
        );
    } catch (err) {
        console.error('GET /api/results', err);
        res.status(500).json({ error: 'Error interno' });
    }
});

// Obtiene detalles de un resultado específico (solo si pertenece al usuario).
app.get('/api/results/:id', authMiddleware, (req, res) => {
    try {
        const userId = req.user.id;
        const id = req.params.id;
        db.get('SELECT * FROM results WHERE id = ? AND user_id = ?', [id, userId], (err, row) => {
            if (err) {
                console.error('GET /api/results/:id error', err);
                return res.status(500).json({ error: 'Error DB' });
            }
            if (!row) return res.status(404).json({ error: 'No encontrado' });
            try { row.result_data = JSON.parse(row.result_data); } catch (e) { /* dejar string si corrupto */ }
            res.json(row);
        });
    } catch (err) {
        console.error('GET /api/results/:id', err);
        res.status(500).json({ error: 'Error interno' });
    }
});

//  Elimina un resultado (solo si pertenece al usuario).
app.delete('/api/results/:id', authMiddleware, (req, res) => {
    try {
        const userId = req.user.id;
        const id = req.params.id;
        db.run('DELETE FROM results WHERE id = ? AND user_id = ?', [id, userId], function (err) {
            if (err) {
                console.error('DELETE /api/results/:id error', err);
                return res.status(500).json({ error: 'Error DB' });
            }
            if (this.changes === 0) return res.status(404).json({ error: 'No encontrado o sin permiso' });
            res.json({ ok: true });
        });
    } catch (err) {
        console.error('DELETE /api/results/:id', err);
        res.status(500).json({ error: 'Error interno' });
    }
});

//Arranca la API en el puerto indicado(variable la cual hemos definido antes), y muestra ese mensaje por consola
app.listen(PORT, () => console.log(`API escuchando en http://localhost:${PORT}`));
