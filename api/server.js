// =============================================
// API serverless para Vercel
// Maneja todas las rutas /api/*
// =============================================
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

const app = express();

app.use(cors({
    origin: ['https://encuesta-cierre-umd-front.onrender.com/'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
}));
app.use(express.json({ limit: '2mb' }));

// =============================================
// Configuración
// =============================================
const JWT_SECRET = process.env.JWT_SECRET || 'cambia-este-secreto-en-produccion';
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
    console.error('Falta variable de entorno DATABASE_URL');
}

// Pool reutilizable entre invocaciones (cached por la VM serverless)
let pool;
function getPool() {
    if (!pool) {
        pool = new Pool({
            connectionString: DATABASE_URL,
            ssl: { rejectUnauthorized: false },
            max: 5,
        });
    }
    return pool;
}

// =============================================
// Helpers
// =============================================
function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

function signToken(userData) {
    return jwt.sign(userData, JWT_SECRET, { expiresIn: '7d' });
}

function requireAuth(req, res, next) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'No autorizado' });
    try {
        const payload = jwt.verify(token, JWT_SECRET);
        req.user = payload;
        next();
    } catch (e) {
        return res.status(401).json({ error: 'No autorizado' });
    }
}

function requireAdmin(req, res, next) {
    requireAuth(req, res, () => {
        if (!req.user.es_admin) {
            return res.status(403).json({ error: 'Acceso denegado' });
        }
        next();
    });
}

// =============================================
// AUTENTICACIÓN
// =============================================
app.post('/api/auth/register', async (req, res) => {
    try {
        const { email, password, nombre } = req.body;
        if (!email || !password || !nombre) {
            return res.status(400).json({ error: 'Todos los campos son requeridos' });
        }
        if (password.length < 6) {
            return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
        }

        const db = getPool();
        const existing = await db.query('SELECT id FROM usuarios WHERE email = $1', [email]);
        if (existing.rows.length > 0) {
            return res.status(409).json({ error: 'Ya existe una cuenta con este correo' });
        }

        const passwordHash = hashPassword(password);
        const result = await db.query(
            'INSERT INTO usuarios (email, password_hash, nombre, es_admin) VALUES ($1, $2, $3, FALSE) RETURNING id',
            [email, passwordHash, nombre]
        );

        const userData = { id: result.rows[0].id, email, nombre, es_admin: false };
        const token = signToken(userData);
        res.status(201).json({ token, user: userData });
    } catch (error) {
        console.error('Error en registro:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Correo y contraseña son requeridos' });
        }

        const passwordHash = hashPassword(password);
        const db = getPool();
        const result = await db.query(
            'SELECT id, email, nombre, es_admin FROM usuarios WHERE email = $1 AND password_hash = $2',
            [email, passwordHash]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
        }

        const user = result.rows[0];
        const userData = {
            id: user.id,
            email: user.email,
            nombre: user.nombre,
            es_admin: !!user.es_admin,
        };
        const token = signToken(userData);
        res.json({ token, user: userData });
    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
});

app.post('/api/auth/logout', (req, res) => {
    // Con JWT no hay estado server-side. El frontend descarta el token.
    res.json({ message: 'Sesión cerrada' });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
    res.json({ user: req.user });
});

// =============================================
// RESPUESTAS
// =============================================
app.post('/api/respuestas', requireAuth, async (req, res) => {
    try {
        const data = req.body;

        const toJSON = (val) =>
            Array.isArray(val) || (val && typeof val === 'object')
                ? JSON.stringify(val)
                : val;

        const query = `
      INSERT INTO respuestas (
        consentimiento, usuario_id, nrc, nombre_facilitador,
        q8_apoyo_acertado, q9_beneficios, q10_otras_beneficios,
        q11_aspectos_positivos, q12_otros_aspectos_positivos,
        q13_profundizar, q14_otros_profundizar,
        q15_socializaron_servicios, q16_servicios_postulados, q17_otros_servicios,
        q18_servicios_accedidos, q19_recomendaria,
        q20_razones_recomendar, q20_porque_no, q21_comentarios,
        q22_temas_innovacion, q23_nuevos_productos, q24_mejoro_productos,
        q25_nuevas_tecnologias, q26_plan_metas, q27_inventario,
        q28_temas_modelo, q29_plan_estrategico, q30_principales_compradores,
        q31_ofrece_vende, q32_paga_contado, q33_aprendizajes_modelo,
        q34_temas_financieros, q35_cuentas_ganancias, q36_rango_ventas,
        q37_mejoro_ventas, q38_rango_aumento_ventas, q39_cuentas_gastos,
        q40_punto_equilibrio, q41_cuenta_bancaria, q42_estados_financieros,
        q43_acceso_credito,
        q44_temas_mercadeo, q45_estrategias_dar_conocer, q46_aviso_logo,
        q47_marca_logo, q48_estrategias_atraer, q49_vende_redes,
        q50_clientes_semanales, q51_clientes_recurrentes,
        q52_temas_formalizacion, q53_camara_comercio, q54_rut, q55_nit,
        q56_aportes_propietario, q57_aportes_empleados
      ) VALUES (
        $1,$2,$3,$4,
        $5,$6,$7,
        $8,$9,
        $10,$11,
        $12,$13,$14,
        $15,$16,
        $17,$18,$19,
        $20,$21,$22,
        $23,$24,$25,
        $26,$27,$28,
        $29,$30,$31,
        $32,$33,$34,
        $35,$36,$37,
        $38,$39,$40,
        $41,
        $42,$43,$44,
        $45,$46,$47,
        $48,$49,
        $50,$51,$52,$53,
        $54,$55
      ) RETURNING id
    `;

        const values = [
            true,
            req.user.id,
            data.nrc || null,
            data.nombre_facilitador || null,
            // Módulo 1
            data.q8 || null,
            toJSON(data.q9) || null,
            data.q10 || null,
            toJSON(data.q11) || null,
            data.q12 || null,
            toJSON(data.q13) || null,
            data.q14 || null,
            data.q15 || null,
            toJSON(data.q16) || null,
            data.q17 || null,
            toJSON(data.q18) || null,
            data.q19 || null,
            toJSON(data.q20_si) || null,
            data.q20_no || null,
            data.q21 || null,
            // Módulo 2 - Innovación
            data.q22 || null,
            data.q23 || null,
            data.q24 || null,
            data.q25 || null,
            data.q26 || null,
            data.q27 || null,
            // Módulo 2 - Modelo de Negocios
            data.q28 || null,
            data.q29 || null,
            data.q30 || null,
            toJSON(data.q31) || null,
            data.q32 || null,
            data.q33 || null,
            // Módulo 2 - Financiero
            data.q34 || null,
            data.q35 || null,
            data.q36 || null,
            data.q37 || null,
            data.q38 || null,
            data.q39 || null,
            data.q40 || null,
            data.q41 || null,
            data.q42 || null,
            data.q43 || null,
            // Módulo 2 - Mercadeo
            data.q44 || null,
            toJSON(data.q45) || null,
            data.q46 || null,
            data.q47 || null,
            data.q48 || null,
            data.q49 || null,
            data.q50 || null,
            data.q51 || null,
            // Módulo 2 - Formalización
            data.q52 || null,
            data.q53 || null,
            data.q54 || null,
            data.q55 || null,
            data.q56 || null,
            data.q57 || null,
        ];

        const db = getPool();
        const result = await db.query(query, values);

        res.status(201).json({
            message: 'Respuesta guardada exitosamente',
            id: result.rows[0].id,
        });
    } catch (error) {
        console.error('Error al guardar respuesta:', error);
        res.status(500).json({ error: 'Error al guardar la respuesta' });
    }
});

app.get('/api/respuestas/nrc/:nrc', async (req, res) => {
    try {
        const db = getPool();
        const result = await db.query(
            'SELECT * FROM respuestas WHERE nrc = $1 ORDER BY fecha_envio DESC',
            [req.params.nrc]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error al obtener respuestas por NRC:', error);
        res.status(500).json({ error: 'Error al obtener las respuestas' });
    }
});

app.get('/api/admin/respuestas', requireAdmin, async (req, res) => {
    try {
        const db = getPool();
        const result = await db.query(
            'SELECT id, nombre_facilitador, nrc, fecha_envio FROM respuestas ORDER BY fecha_envio DESC'
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error al obtener respuestas admin:', error);
        res.status(500).json({ error: 'Error al obtener las respuestas' });
    }
});

app.get('/api/admin/respuestas/:id', requireAdmin, async (req, res) => {
    try {
        const db = getPool();
        const result = await db.query(
            'SELECT * FROM respuestas WHERE id = $1',
            [req.params.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Respuesta no encontrada' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error al obtener detalle de respuesta:', error);
        res.status(500).json({ error: 'Error al obtener la respuesta' });
    }
});

// Healthcheck (útil para verificar el deploy)
app.get('/api/health', async (req, res) => {
    try {
        const db = getPool();
        await db.query('SELECT 1');
        res.json({ status: 'ok', database: 'connected' });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// Puerto local opcional (no se usa en Vercel)
if (process.env.LOCAL_DEV === 'true') {
    const PORT = process.env.PORT || 3001;
    app.listen(PORT, () => {
        console.log(`Servidor local corriendo en http://localhost:${PORT}`);
    });
}

module.exports = app;
