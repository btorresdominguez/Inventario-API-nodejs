const logger = require('../utils/logger');

const errorHandler = (error, req, res, next) => {
  let statusCode = error.status || 500;
  let message = error.message || 'Error interno del servidor';
  let errors = [];

  // Log del error
  logger.error(`Error en ${req.method} ${req.originalUrl}: ${error.message}`, {
    stack: error.stack,
    userId: req.user ? req.user.id : null,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    body: req.body,
  });

// Manejar diferentes tipos de errores
  if (error.name === 'ValidationError') {
    // Errores de validación de Joi o Sequelize
    statusCode = 400;
    message = 'Error de validación';
    
    if (error.details) {
      // Error de Joi
      errors = error.details.map(detail => detail.message);
    } else if (error.errors) {
      // Error de Sequelize
      errors = error.errors.map(err => err.message);
    }
  } else if (error.name === 'SequelizeValidationError') {
    statusCode = 400;
    message = 'Error de validación de datos';
    errors = error.errors.map(err => `${err.path}: ${err.message}`);
  } else if (error.name === 'SequelizeUniqueConstraintError') {
    statusCode = 409;
    message = 'Conflicto: El recurso ya existe';
    errors = error.errors.map(err => {
      if (err.path === 'email') {
        return 'El email ya está registrado';
      }
      return `${err.path} ya existe`;
    });
  } else if (error.name === 'SequelizeForeignKeyConstraintError') {
    statusCode = 400;
    message = 'Error de integridad referencial';
    errors = ['El recurso referenciado no existe'];
  } else if (error.name === 'SequelizeDatabaseError') {
    statusCode = 500;
    message = 'Error de base de datos';
    if (process.env.NODE_ENV === 'development') {
      errors = [error.parent?.detail || error.message];
    }
  } else if (error.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Token inválido';
    errors = ['El token de autenticación es inválido'];
  } else if (error.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expirado';
    errors = ['El token de autenticación ha expirado'];
  } else if (error.name === 'MulterError') {
    statusCode = 400;
    message = 'Error en la subida de archivo';
    if (error.code === 'LIMIT_FILE_SIZE') {
      errors = ['El archivo es demasiado grande'];
    } else if (error.code === 'LIMIT_FILE_COUNT') {
      errors = ['Demasiados archivos'];
    } else {
      errors = [error.message];
    }
  } else if (error.code === 'ECONNREFUSED') {
    statusCode = 503;
    message = 'Servicio no disponible';
    errors = ['No se puede conectar a la base de datos'];
  } else if (error.type === 'entity.parse.failed') {
    statusCode = 400;
    message = 'JSON malformado';
    errors = ['El formato del JSON es inválido'];
  } else if (error.type === 'entity.too.large') {
    statusCode = 413;
    message = 'Payload demasiado grande';
    errors = ['El tamaño de la petición excede el límite permitido'];
  } else if (error.code === 'EBADCSRFTOKEN') {
    statusCode = 403;
    message = 'Token CSRF inválido';
    errors = ['Token de seguridad inválido'];
  } else if (error.status || error.statusCode) {
    statusCode = error.status || error.statusCode;
    message = error.message || message;
    if (error.errors) {
      errors = Array.isArray(error.errors) ? error.errors : [error.errors];
    }
  }

  res.status(statusCode).json({
    success: false,
    message,
    errors,
    timestamp: new Date().toISOString(),
    path: req.originalUrl,
  });
};

module.exports = errorHandler;