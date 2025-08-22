const jwt = require('jsonwebtoken');
const { User } = require('../models');
const logger = require('../utils/logger');

/**
 * Middleware para verificar autenticación JWT
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next middleware function
 */
const authenticate = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token de acceso requerido'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findByPk(decoded.userId);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Usuario no válido'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    logger.error('Error en autenticación:', error);
    next(error);
  }
};

/**
 * Middleware para verificar roles específicos
 * @param {...string} roles - Roles permitidos
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Usuario no autenticado'
      });
    }

    if (!roles.includes(req.user.role)) {
      logger.warn(`Acceso denegado para usuario ${req.user.email} con rol ${req.user.role}`);
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para realizar esta acción'
      });
    }

    next();
  };
};

/**
 * Middleware específico para administradores
 */
const adminOnly = authorize('admin');

/**
 * Middleware específico para clientes
 */
const clientOnly = authorize('cliente');

module.exports = {
  authenticate,
  authorize,
  adminOnly,
  clientOnly
};