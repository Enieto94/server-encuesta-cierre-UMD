const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(cors({
  origin: ['https://encuesta-cierre-umd-front.onrender.com', 'https://encuesta-cierre-umd-front.onrender.com/'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  credentials: true,
}));
app.use(express.json());

const buildConnectionString = () => {
  const rawValue = process.env.DB_URL;

  if (!rawValue) {
    return null;
  }

  if (/^postgres(?:ql)?:\/\//i.test(rawValue)) {
    return rawValue;
  }

  const host = rawValue;
  const user = process.env.DB_USER || 'postgres';
  const password = process.env.DB_PASSWORD || '';
  const database = process.env.DB_NAME || 'postgres';
  const port = process.env.DB_PORT || '5432';

  if (host.includes('render.com')) {
    return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}?sslmode=require`;
  }

  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
};

const connectionString = buildConnectionString();
console.log(`Conectado a la base de datos en: ${connectionString || 'localhost'}`);

const poolConfig = connectionString
  ? {
    connectionString,
    ssl: connectionString.includes('render.com') || connectionString.includes('sslmode=require')
      ? { rejectUnauthorized: false }
      : false,
  }
  : {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  };

// Conexión a la base de datos PostgreSQL
const pool = new Pool(poolConfig);

// Verificar conexión al iniciar
pool.query('SELECT NOW()')
  .then(() => {
    console.log(`Conectado a la base de datos ${process.env.DB_NAME}`);
  })
  .catch((err) => {
    console.error('Error conectando a la base de datos:', err.message);
  });

const handleSaveResponse = async (req, res) => {
  try {
    const data = req.body;

    const toJSON = (val) => (Array.isArray(val) || (val && typeof val === 'object') ? JSON.stringify(val) : val);

    const consentValue = data.consentimiento === false ? 0 : 1;
    const { rows: idRows } = await pool.query('SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM respuestas');
    const nextId = idRows[0]?.next_id ?? 1;

    const fechaEnvio = new Date().toISOString();

    const values = [
      nextId,
      fechaEnvio,
      consentValue,
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
      data.q20 || null,
      toJSON(data.q21) || null,
      data.q22 || null,
      data.q23 || null,
      data.q24 || null,
      data.q25 || null,
      data.q26 || null,
      data.q27 || null,
      data.q28 || null,
      data.q29 || null,
      data.q30 || null,
      data.q31 || null,
      data.q32 || null,
      data.q33 || null,
      data.q34 || null,
      data.q35 || null,
      data.q36 || null,
      toJSON(data.q37) || null,
      toJSON(data.q38) || null,
      toJSON(data.q39) || null,
      data.q40 || null,
      data.q41 || null,
      data.q42 || null,
      data.q43 || null,
      data.q44 || null,
      data.q45 || null,
      data.q46 || null,
      data.q47 || null,
      data.q48 || null,
      data.q49 || null,
      data.q50 || null,
      data.q51 || null,
      data.q52 || null,
      data.q53 || null,
      data.q54 || null,
      data.q55 || null,
      data.q56 || null,
      data.q57 || null,
      data.q58 || null,
      data.q59 || null,
      data.q60 || null,
      data.q61 || null,
    ];

    const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
    const query = `
      INSERT INTO respuestas (
        id,
        fecha_envio,
        consentimiento,
        q8_apoyo_acertado, q9_beneficios, q10_otras_beneficios,
        q11_aspectos_positivos, q12_otros_aspectos_positivos,
        q13_profundizar, q14_otros_profundizar,
        q15_socializaron_servicios, q16_servicios_postulados, q17_otros_servicios,
        q18_servicios_accedidos, q19_recomendaria, q20_porque_no,
        q21_razones_recomendar, q22_otras_razones,
        q23_comentarios, q24_principal_reto,
        q25_temas_innovacion, q26_nuevos_productos, q27_inventario,
        q28_mejoro_productos, q29_nuevas_tecnologias,
        q30_plan_trabajo, q31_plan_estrategico,
        q32_temas_modelo, q33_principales_compradores,
        q34_base_clientes, q35_aprendizajes_modelo,
        q36_temas_mercadeo, q37_estrategias_venta,
        q38_redes_promocion, q39_redes_venta,
        q40_clientes_semanales, q41_clientes_recurrentes,
        q42_temas_formalizacion, q43_camara_comercio,
        q44_rut, q45_nit,
        q46_aportes_propietario, q47_aportes_empleados,
        q48_empleos_generados, q49_empleados_informales, q50_empleados_formales,
        q51_temas_financieros, q52_acceso_credito,
        q53_cuentas_ganancias, q54_promedio_ganancias,
        q55_rango_ventas, q56_mejoro_ventas,
        q57_rango_aumento, q58_razon_disminucion,
        q59_cuentas_gastos, q60_cuenta_bancaria, q61_capacidad_endeudamiento
      ) VALUES (${placeholders}) RETURNING id
    `;

    const result = await pool.query(query, values);

    res.status(201).json({
      message: 'Respuesta guardada exitosamente',
      id: result.rows[0]?.id,
    });
  } catch (error) {
    console.error('Error al guardar respuesta:', error);
    res.status(500).json({ error: 'Error al guardar la respuesta' });
  }
};

const handleGetResponses = async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM respuestas ORDER BY fecha_envio DESC');
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener respuestas:', error);
    res.status(500).json({ error: 'Error al obtener las respuestas' });
  }
};

// Endpoint para guardar respuestas
app.post(['/api/respuestas', '/pi/respuestas'], handleSaveResponse);

// Endpoint para obtener todas las respuestas
app.get(['/api/respuestas', '/pi/respuestas'], handleGetResponses);

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
