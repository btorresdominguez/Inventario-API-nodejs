require('dotenv').config(); // 1️⃣ Cargar variables de entorno

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const path = require('path');
const { sequelize } = require('./config/database');
const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');

// Rutas
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const purchaseRoutes = require('./routes/purchases');

const app = express();
const PORT = process.env.PORT || 3000;

// Swagger con fallback
let swaggerDocument;
try {
  swaggerDocument = YAML.load(path.join(__dirname, '../docs/swagger.yaml'));
  swaggerDocument.servers = [{ url: `http://localhost:${PORT}`, description: 'Servidor local' }];
  logger.info('Documentación Swagger cargada desde YAML');
} catch (err) {
  logger.warn('No se encontró swagger.yaml, usando fallback mínimo');
  swaggerDocument = { openapi: '3.0.3', info: { title: 'API Inventario', version: '1.0.0' }, servers: [{ url: `http://localhost:${PORT}` }] };
}

// Configuración de CORS
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*', // Permitir múltiples orígenes
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true // Habilitar el uso de cookies
}));

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: "API Inventario - Documentación"
}));

// Middlewares
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('combined', { stream: { write: msg => logger.info(msg.trim()) } }));

// Logging request
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => logger.info(`${req.method} ${req.originalUrl} - ${res.statusCode} - ${Date.now() - start}ms`));
  next();
});

// Rutas
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/purchases', purchaseRoutes);

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'OK', timestamp: new Date().toISOString(), uptime: process.uptime(), environment: process.env.NODE_ENV || 'development', version: '1.0.0' }));

// Middleware de errores y rutas no encontradas
app.use(errorHandler);
app.use('*', (req, res) => res.status(404).json({ success: false, message: 'Ruta no encontrada', path: req.originalUrl }));

// Shutdown graceful
const shutdown = async () => {
  logger.info('Cerrando servidor...');
  await sequelize.close();
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Iniciar servidor
const startServer = async () => {
  try {
    await sequelize.authenticate();
    logger.info('Conexión a la base de datos establecida correctamente');

    if (process.env.NODE_ENV === 'development') {
      await sequelize.sync({ alter: true });
      logger.info('Modelos sincronizados con la base de datos');
    }

    const server = app.listen(PORT, () => {
      logger.info(`🚀 Servidor iniciado en http://localhost:${PORT}`);
      logger.info(`📚 Docs en http://localhost:${PORT}/api-docs`);
      logger.info(`🏥 Health check en http://localhost:${PORT}/api/health`);
    });

    server.timeout = 30000;
  } catch (error) {
    logger.error('Error al iniciar servidor:', error);
    process.exit(1);
  }
};

process.on('uncaughtException', err => { logger.error('Excepción no capturada:', err); process.exit(1); });
process.on('unhandledRejection', (reason, promise) => { logger.error('Rechazo no manejado en:', promise, 'razón:', reason); process.exit(1); });

startServer();
