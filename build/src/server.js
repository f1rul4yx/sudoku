const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const path = require('path');
const SudokuLib = require('../public/js/sudoku.js');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'sudoku_secret_key_change_in_production';
const SALT_ROUNDS = 10;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// PostgreSQL connection pool
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'sudoku',
    password: process.env.DB_PASSWORD || 'sudoku123',
    database: process.env.DB_NAME || 'sudoku',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

// Initialize database tables
async function initDatabase() {
    const client = await pool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS games (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                difficulty VARCHAR(20) NOT NULL,
                puzzle VARCHAR(81) NOT NULL,
                solution VARCHAR(81) NOT NULL,
                progress VARCHAR(81),
                status VARCHAR(20) DEFAULT 'in_progress',
                seconds_spent INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                completed_at TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
            CREATE INDEX IF NOT EXISTS idx_games_user ON games(user_id);
            CREATE INDEX IF NOT EXISTS idx_games_completed ON games(completed_at);
        `);
        console.log('✅ Database tables initialized');
    } catch (error) {
        console.error('❌ Database initialization error:', error);
        throw error;
    } finally {
        client.release();
    }
}

// Auth middleware
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Token requerido' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Token inválido' });
        }
        req.user = user;
        next();
    });
}

function mapGame(row) {
    return {
        id: row.id,
        difficulty: row.difficulty,
        puzzle: row.puzzle,
        solution: row.solution,
        progress: row.progress || row.puzzle,
        status: row.status,
        secondsSpent: row.seconds_spent || 0,
        createdAt: row.created_at,
        completedAt: row.completed_at
    };
}

// ==================== AUTH ROUTES ====================

// Register
app.post('/api/auth/register', async (req, res) => {
    const client = await pool.connect();
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
        }

        if (username.length < 3) {
            return res.status(400).json({ error: 'Usuario mínimo 3 caracteres' });
        }

        if (password.length < 4) {
            return res.status(400).json({ error: 'Contraseña mínimo 4 caracteres' });
        }

        const normalizedUsername = username.toLowerCase().trim();

        const existingUser = await client.query(
            'SELECT id FROM users WHERE username = $1',
            [normalizedUsername]
        );

        if (existingUser.rows.length > 0) {
            return res.status(409).json({ error: 'El usuario ya existe' });
        }

        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

        const result = await client.query(
            'INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id',
            [normalizedUsername, hashedPassword]
        );

        const userId = result.rows[0].id;

        const token = jwt.sign(
            { id: userId, username: normalizedUsername },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(201).json({
            message: 'Usuario creado correctamente',
            token,
            user: { id: userId, username: normalizedUsername }
        });

    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    } finally {
        client.release();
    }
});

// Login
app.post('/api/auth/login', async (req, res) => {
    const client = await pool.connect();
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
        }

        const normalizedUsername = username.toLowerCase().trim();

        const userResult = await client.query(
            'SELECT * FROM users WHERE username = $1',
            [normalizedUsername]
        );

        if (userResult.rows.length === 0) {
            return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
        }

        const user = userResult.rows[0];

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
        }

        const token = jwt.sign(
            { id: user.id, username: user.username },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            message: 'Login correcto',
            token,
            user: { id: user.id, username: user.username }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    } finally {
        client.release();
    }
});

// Verify token & get user data
app.get('/api/auth/me', authenticateToken, async (req, res) => {
    const client = await pool.connect();
    try {
        const userResult = await client.query(
            'SELECT id, username FROM users WHERE id = $1',
            [req.user.id]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        res.json({ user: userResult.rows[0] });

    } catch (error) {
        console.error('Auth me error:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    } finally {
        client.release();
    }
});

// ==================== GAME ROUTES ====================

// Create a new random game
app.post('/api/games', authenticateToken, async (req, res) => {
    const client = await pool.connect();
    try {
        const { difficulty } = req.body;
        const userId = req.user.id;

        if (!SudokuLib.DIFFICULTIES[difficulty]) {
            return res.status(400).json({ error: 'Dificultad no válida' });
        }

        const generated = SudokuLib.generate(difficulty);

        const result = await client.query(
            `INSERT INTO games (user_id, difficulty, puzzle, solution, progress)
             VALUES ($1, $2, $3, $4, $3)
             RETURNING *`,
            [userId, difficulty, generated.puzzle, generated.solution]
        );

        res.status(201).json({ game: mapGame(result.rows[0]) });

    } catch (error) {
        console.error('Create game error:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    } finally {
        client.release();
    }
});

// List user games (in progress first, then completed)
app.get('/api/games', authenticateToken, async (req, res) => {
    const client = await pool.connect();
    try {
        const result = await client.query(
            `SELECT * FROM games
             WHERE user_id = $1
             ORDER BY (status = 'in_progress') DESC, created_at DESC
             LIMIT 200`,
            [req.user.id]
        );

        res.json({ games: result.rows.map(mapGame) });

    } catch (error) {
        console.error('List games error:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    } finally {
        client.release();
    }
});

// Get a single game (ownership required)
app.get('/api/games/:id', authenticateToken, async (req, res) => {
    const client = await pool.connect();
    try {
        const result = await client.query(
            'SELECT * FROM games WHERE id = $1 AND user_id = $2',
            [req.params.id, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Partida no encontrada' });
        }

        res.json({ game: mapGame(result.rows[0]) });

    } catch (error) {
        console.error('Get game error:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    } finally {
        client.release();
    }
});

// Save progress of an in-progress game
app.put('/api/games/:id', authenticateToken, async (req, res) => {
    const client = await pool.connect();
    try {
        const { progress, secondsSpent } = req.body;
        const userId = req.user.id;

        if (!progress || progress.length !== 81) {
            return res.status(400).json({ error: 'Progreso no válido' });
        }
        if (typeof secondsSpent !== 'number' || secondsSpent < 0) {
            return res.status(400).json({ error: 'Tiempo no válido' });
        }

        const result = await client.query(
            `UPDATE games
             SET progress = $1, seconds_spent = $2
             WHERE id = $3 AND user_id = $4 AND status = 'in_progress'
             RETURNING *`,
            [progress, Math.floor(secondsSpent), req.params.id, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Partida no encontrada o ya terminada' });
        }

        res.json({ game: mapGame(result.rows[0]) });

    } catch (error) {
        console.error('Save progress error:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    } finally {
        client.release();
    }
});

// Delete a game
app.delete('/api/games/:id', authenticateToken, async (req, res) => {
    const client = await pool.connect();
    try {
        const result = await client.query(
            'DELETE FROM games WHERE id = $1 AND user_id = $2',
            [req.params.id, req.user.id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Partida no encontrada' });
        }

        res.json({ message: 'Partida eliminada' });

    } catch (error) {
        console.error('Delete game error:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    } finally {
        client.release();
    }
});

// Mark a game as completed
app.post('/api/games/:id/complete', authenticateToken, async (req, res) => {
    const client = await pool.connect();
    try {
        const { secondsSpent } = req.body;
        const userId = req.user.id;

        const result = await client.query(
            `UPDATE games
             SET status = 'completed',
                 completed_at = CURRENT_TIMESTAMP,
                 seconds_spent = $1
             WHERE id = $2 AND user_id = $3 AND status = 'in_progress'
             RETURNING *`,
            [Math.floor(secondsSpent || 0), req.params.id, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Partida no encontrada o ya terminada' });
        }

        res.json({ game: mapGame(result.rows[0]) });

    } catch (error) {
        console.error('Complete game error:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    } finally {
        client.release();
    }
});

// ==================== HISTORY ====================

app.get('/api/history', authenticateToken, async (req, res) => {
    const client = await pool.connect();
    try {
        const result = await client.query(
            `SELECT * FROM games
             WHERE user_id = $1 AND status = 'completed'
             ORDER BY completed_at DESC
             LIMIT 200`,
            [req.user.id]
        );

        res.json({ history: result.rows.map(mapGame) });

    } catch (error) {
        console.error('History error:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    } finally {
        client.release();
    }
});

// ==================== PRINT (no guarda nada) ====================

app.post('/api/print', async (req, res) => {
    try {
        const { difficulty, count } = req.body;

        if (!SudokuLib.DIFFICULTIES[difficulty]) {
            return res.status(400).json({ error: 'Dificultad no válida' });
        }

        const n = Math.min(Math.max(parseInt(count) || 1, 1), 100);
        const puzzles = [];
        for (let i = 0; i < n; i++) {
            const g = SudokuLib.generate(difficulty);
            puzzles.push({ puzzle: g.puzzle, solution: g.solution });
        }

        res.json({ puzzles });

    } catch (error) {
        console.error('Print generate error:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Health check
app.get('/api/health', async (req, res) => {
    try {
        await pool.query('SELECT 1');
        res.json({ status: 'ok', database: 'connected' });
    } catch (error) {
        res.status(500).json({ status: 'error', database: 'disconnected' });
    }
});

// Serve frontend for any other route
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Start server
async function start() {
    try {
        console.log('🔄 Connecting to PostgreSQL...');
        await initDatabase();

        app.listen(PORT, '0.0.0.0', () => {
            console.log(`🧩 Sudoku server running on port ${PORT}`);
            console.log(`📦 Database: ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`);
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

start();