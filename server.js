// server.js
const express = require('express');
const sqlite3 = require('sqlite3');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

const DB_FILE = path.join(__dirname, 'data.db');
const JWT_SECRET = process.env.JWT_SECRET || 'CAMBIA_ESTE_SECRETO_EN_PRODUC'; // cambia en producción
const TOKEN_EXPIRES = '7d';

const db = new sqlite3.Database(DB_FILE);

// Inicializar tablas
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

const app = express();
app.use(cors());
app.use(bodyParser.json());

// servir archivos estáticos desde la carpeta "public" (css, js, img, index.html)
app.use(express.static(path.join(__dirname, 'public')));

// Forzar entrega de public/index.html en la raíz (útil para SPA / fallback)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


// Util: crear token
function createToken(user) {
    return jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: TOKEN_EXPIRES });
}

// Middleware auth
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

// Registro
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

// Login
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

// Obtener perfil (protected)
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

// Guardar/actualizar perfil (protected)
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
                // fallback: ver si hay fila y actualizar/inserter manualmente
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

// (Opcional) endpoint para obtener info del usuario
app.get('/api/me', authMiddleware, (req, res) => {
    db.get('SELECT id, email, name, created_at FROM users WHERE id = ?', [req.user.id], (err, row) => {
        if (err) return res.status(500).json({ error: 'Error DB' });
        res.json({ user: row });
    });
});

const PORT = process.env.PORT || 4000;
// ------------------ RESULTS endpoints (protected) ------------------

// Crear resultado (guardar plan)
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

// Listar resultados del usuario (paginado)
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

// Obtener detalle de un resultado (comprueba owner)
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

// Eliminar resultado (owner only)
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

app.listen(PORT, () => console.log(`API escuchando en http://localhost:${PORT}`));
