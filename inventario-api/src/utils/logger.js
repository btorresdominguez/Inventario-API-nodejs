const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Crear directorio de logs si no existe
const logDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Formato personalizado para logs
const customFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.prettyPrint()
);

// Formato para consola (más legible)
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'HH:mm:ss'
  }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let metaStr = '';
    if (Object.keys(meta).length > 0) {
      metaStr = `\n${JSON.stringify(meta, null, 2)}`;
    }
    return `[${timestamp}] ${level}: ${message}${metaStr}`;
  })
);

// Configuración de transports
const transports = [
  // Console transport
  new winston.transports.Console({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    format: consoleFormat,
    handleExceptions: true,
    handleRejections: true
  }),

  // Archivo para todos los logs
  new winston.transports.File({
    filename: path.join(logDir, 'app.log'),
    level: 'info',
    format: customFormat,
    maxsize: 5242880, // 5MB
    maxFiles: 10,
    tailable: true
  }),

  // Archivo solo para errores
  new winston.transports.File({
    filename: path.join(logDir, 'error.log'),
    level: 'error',
    format: customFormat,
    maxsize: 5242880, // 5MB
    maxFiles: 5,
    tailable: true
  })
];

// En producción, agregar transports adicionales
if (process.env.NODE_ENV === 'production') {
  // Archivo para logs de acceso (requests HTTP)
  transports.push(
    new winston.transports.File({
      filename: path.join(logDir, 'access.log'),
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      maxsize: 10485760, // 10MB
      maxFiles: 15,
      tailable: true
    })
  );

  // En producción podrías agregar transports para servicios externos
  // como CloudWatch, Elasticsearch, etc.
}

// Crear el logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  format: customFormat,
  transports,
  exitOnError: false,
  
  // Configuración para excepciones no capturadas
  exceptionHandlers: [
    new winston.transports.File({ 
      filename: path.join(logDir, 'exceptions.log'),
      maxsize: 5242880,
      maxFiles: 3
    })
  ],
  
  // Configuración para promesas rechazadas
  rejectionHandlers: [
    new winston.transports.File({ 
      filename: path.join(logDir, 'rejections.log'),
      maxsize: 5242880,
      maxFiles: 3
    })
  ]
});

// Métodos de utilidad adicionales
logger.logRequest = (req, res, duration) => {
  const logData = {
    method: req.method,
    url: req.originalUrl,
    statusCode: res.statusCode,
    responseTime: duration,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent'),
    contentLength: res.get('Content-Length'),
    referrer: req.get('Referrer')
  };

  // Si hay usuario autenticado, incluir información
  if (req.user) {
    logData.userId = req.user.id;
    logData.userRole = req.user.role;
  }

  const level = res.statusCode >= 400 ? 'warn' : 'info';
  logger[level](`${req.method} ${req.originalUrl} - ${res.statusCode} - ${duration}ms`, logData);
};

logger.logError = (error, req = null) => {
  const errorData = {
    name: error.name,
    message: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString()
  };

  if (req) {
    errorData.request = {
      method: req.method,
      url: req.originalUrl,
      headers: req.headers,
      body: req.body,
      params: req.params,
      query: req.query,
      ip: req.ip
    };

    if (req.user) {
      errorData.user = {
        id: req.user.id,
        email: req.user.email,
        role: req.user.role
      };
    }
  }

  logger.error('Error capturado:', errorData);
};

logger.logSecurity = (event, details = {}) => {
  logger.warn(`🔒 Evento de seguridad: ${event}`, {
    event,
    timestamp: new Date().toISOString(),
    ...details
  });
};

logger.logPerformance = (operation, duration, details = {}) => {
  const level = duration > 1000 ? 'warn' : 'info';
  logger[level](`⚡ Performance: ${operation} - ${duration}ms`, {
    operation,
    duration,
    ...details
  });
};

// Stream para Morgan
logger.stream = {
  write: (message) => {
    logger.info(message.trim());
  }
};

// En desarrollo, mostrar todos los logs
if (process.env.NODE_ENV !== 'production') {
  logger.debug('Logger inicializado en modo desarrollo');
  logger.debug(`Directorio de logs: ${logDir}`);
  logger.debug(`Nivel de log: ${logger.level}`);
}

module.exports = logger;