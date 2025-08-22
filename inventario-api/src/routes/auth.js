const express = require('express');
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { registerSchema, loginSchema } = require('../utils/validationSchemas');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * @api {post} /api/auth/register Registrar usuario
 * @apiName RegisterUser
 * @apiGroup Auth
 * 
 * @apiParam {String} nombre Nombre del usuario
 * @apiParam {String} email Email del usuario
 * @apiParam {String} password Contraseña del usuario
 * @apiParam {String} [role=cliente] Rol del usuario (admin o cliente)
 * 
 * @apiSuccess {Boolean} success Estado de la operación
 * @apiSuccess {String} message Mensaje de respuesta
 * @apiSuccess {Object} data Datos del usuario registrado
 * @apiSuccess {String} token Token JWT de autenticación
 * 
 * @apiError {Boolean} success=false Estado de error
 * @apiError {String} message Mensaje de error
 * @apiError {Array} [errors] Lista de errores de validación
 */
router.post('/register', async (req, res, next) => {
  try {
    // Validar datos de entrada
    const { error, value } = registerSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Error de validación',
        errors: error.details.map(detail => detail.message)
      });
    }

    const { nombre, email, password, role } = value;

    // Verificar si el usuario ya existe
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'El email ya está registrado'
      });
    }

    // Crear usuario
    const user = await User.create({
      nombre,
      email,
      password,
      role
    });

    // Generar token JWT
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    logger.info(`Usuario registrado exitosamente: ${email} con rol ${role}`);

    res.status(201).json({
      success: true,
      message: 'Usuario registrado exitosamente',
      data: user,
      token
    });
  } catch (error) {
    logger.error('Error en registro de usuario:', error);
    next(error);
  }
});

/**
 * @api {post} /api/auth/login Iniciar sesión
 * @apiName LoginUser
 * @apiGroup Auth
 * 
 * @apiParam {String} email Email del usuario
 * @apiParam {String} password Contraseña del usuario
 * 
 * @apiSuccess {Boolean} success Estado de la operación
 * @apiSuccess {String} message Mensaje de respuesta
 * @apiSuccess {Object} data Datos del usuario
 * @apiSuccess {String} token Token JWT de autenticación
 * 
 * @apiError {Boolean} success=false Estado de error
 * @apiError {String} message Mensaje de error
 */
router.post('/login', async (req, res, next) => {
  try {
    // Validar datos de entrada
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Error de validación',
        errors: error.details.map(detail => detail.message)
      });
    }

    const { email, password } = value;

    // Buscar usuario por email
    const user = await User.findOne({ where: { email, activo: true } });
    if (!user) {
      logger.warn(`Intento de login con email no registrado: ${email}`);
      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas'
      });
    }

    // Verificar contraseña
    const isValidPassword = await user.comparePassword(password);
    if (!isValidPassword) {
      logger.warn(`Intento de login con contraseña incorrecta para: ${email}`);
      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas'
      });
    }

    // Generar token JWT
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    logger.info(`Login exitoso para usuario: ${email}`);

    res.json({
      success: true,
      message: 'Login exitoso',
      data: user,
      token
    });
  } catch (error) {
    logger.error('Error en login:', error);
    next(error);
  }
});

/**
 * @api {get} /api/auth/me Obtener perfil del usuario actual
 * @apiName GetProfile
 * @apiGroup Auth
 * @apiHeader {String} Authorization Bearer token
 * 
 * @apiSuccess {Boolean} success Estado de la operación
 * @apiSuccess {Object} data Datos del usuario actual
 */
router.get('/me', require('../middleware/auth').authenticate, async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: req.user
    });
  } catch (error) {
    logger.error('Error al obtener perfil:', error);
    next(error);
  }
});

module.exports = router;