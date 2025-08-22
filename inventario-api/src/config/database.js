const { Sequelize } = require('sequelize');
const logger = require('../utils/logger');

/**
 * Configuración de la conexión a la base de datos MySQL
 */
const sequelize = new Sequelize({
  dialect: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  database: process.env.DB_NAME || 'inventario_db',
  username: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  logging: (msg) => logger.debug(msg),
  
  pool: {
   max: 20,           // Aumentar conexiones máximas
    min: 5,            // Mantener conexiones mínimas
    acquire: 60000,    // Tiempo máximo para obtener conexión (60s)
    idle: 30000,       // Tiempo antes de liberar conexión inactiva (30s)
    evict: 10000       // Tiempo para verificar conexiones inactivas (10s)
  },
  define: {
    timestamps: true,
    underscored: true,
    freezeTableName: true
  }
});

/**
 * Función para probar la conexión a la base de datos
 */
const testConnection = async () => {
  try {
    await sequelize.authenticate();
    logger.info('Conexión a MySQL establecida correctamente');
    return true;
  } catch (error) {
    logger.error('Error al conectar con MySQL:', error);
    return false;
  }
};

module.exports = {
  sequelize,
  testConnection
};

