const express = require('express');
const { Op } = require('sequelize');
const { Product } = require('../models');
const { productSchema, updateProductSchema, queryParamsSchema } = require('../utils/validationSchemas');
const { authenticate, adminOnly } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * @api {get} /api/products Obtener lista de productos
 * @apiName GetProducts
 * @apiGroup Products
 * @apiHeader {String} Authorization Bearer token
 * 
 * @apiParam {Number} [page=1] Número de página
 * @apiParam {Number} [limit=10] Límite de resultados por página
 * @apiParam {String} [search] Término de búsqueda
 * @apiParam {String} [sortBy=created_at] Campo para ordenar
 * @apiParam {String} [order=DESC] Orden (ASC o DESC)
 * 
 * @apiSuccess {Boolean} success Estado de la operación
 * @apiSuccess {Object} data Datos de productos
 * @apiSuccess {Array} data.products Lista de productos
 * @apiSuccess {Object} data.pagination Información de paginación
 */
router.get('/', authenticate, async (req, res, next) => {
  try {
    // Validar parámetros de consulta
    const { error, value } = queryParamsSchema.validate(req.query);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Parámetros de consulta inválidos',
        errors: error.details.map(detail => detail.message)
      });
    }

    const { page, limit, search, sortBy, order } = value;
    const offset = (page - 1) * limit;

    // Construir condiciones de búsqueda
    const whereConditions = { activo: true };
    
    if (search) {
      whereConditions[Op.or] = [
        { nombre: { [Op.like]: `%${search}%` } },
        { numero_lote: { [Op.like]: `%${search}%` } }
      ];
    }

    // Obtener productos con paginación
    const { count, rows: products } = await Product.findAndCountAll({
      where: whereConditions,
      order: [[sortBy, order]],
      limit,
      offset,
      attributes: ['id', 'numero_lote', 'nombre', 'precio', 'cantidad_disponible', 'fecha_ingreso', 'descripcion']
    });

    const totalPages = Math.ceil(count / limit);

    res.json({
      success: true,
      data: {
        products,
        pagination: {
          currentPage: page,
          totalPages,
          totalItems: count,
          itemsPerPage: limit,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      }
    });
  } catch (error) {
    logger.error('Error al obtener productos:', error);
    next(error);
  }
});

/**
 * @api {get} /api/products/:id Obtener producto por ID
 * @apiName GetProduct
 * @apiGroup Products
 * @apiHeader {String} Authorization Bearer token
 * 
 * @apiParam {Number} id ID del producto
 * 
 * @apiSuccess {Boolean} success Estado de la operación
 * @apiSuccess {Object} data Datos del producto
 */
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;

    const product = await Product.findOne({
      where: { id, activo: true }
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Producto no encontrado'
      });
    }

    res.json({
      success: true,
      data: product
    });
  } catch (error) {
    logger.error('Error al obtener producto:', error);
    next(error);
  }
});

/**
 * @api {post} /api/products Crear producto
 * @apiName CreateProduct
 * @apiGroup Products
 * @apiHeader {String} Authorization Bearer token
 * @apiPermission admin
 * 
 * @apiParam {String} numero_lote Número de lote del producto
 * @apiParam {String} nombre Nombre del producto
 * @apiParam {Number} precio Precio del producto
 * @apiParam {Number} cantidad_disponible Cantidad disponible
 * @apiParam {String} [descripcion] Descripción del producto
 * 
 * @apiSuccess {Boolean} success Estado de la operación
 * @apiSuccess {String} message Mensaje de respuesta
 * @apiSuccess {Object} data Datos del producto creado
 */
router.post('/', authenticate, adminOnly, async (req, res, next) => {
  try {
    // Validar datos de entrada
    const { error, value } = productSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Error de validación',
        errors: error.details.map(detail => detail.message)
      });
    }

    // Crear producto
    const product = await Product.create(value);

    logger.info(`Producto creado exitosamente: ${product.nombre} por usuario ${req.user.email}`);

    res.status(201).json({
      success: true,
      message: 'Producto creado exitosamente',
      data: product
    });
  } catch (error) {
    logger.error('Error al crear producto:', error);
    next(error);
  }
});

/**
 * @api {put} /api/products/:id Actualizar producto
 * @apiName UpdateProduct
 * @apiGroup Products
 * @apiHeader {String} Authorization Bearer token
 * @apiPermission admin
 * 
 * @apiParam {Number} id ID del producto
 * @apiParam {String} [numero_lote] Número de lote del producto
 * @apiParam {String} [nombre] Nombre del producto
 * @apiParam {Number} [precio] Precio del producto
 * @apiParam {Number} [cantidad_disponible] Cantidad disponible
 * @apiParam {String} [descripcion] Descripción del producto
 * 
 * @apiSuccess {Boolean} success Estado de la operación
 * @apiSuccess {String} message Mensaje de respuesta
 * @apiSuccess {Object} data Datos del producto actualizado
 */
router.put('/:id', authenticate, adminOnly, async (req, res, next) => {
  try {
    const { id } = req.params;

    // Validar datos de entrada
    const { error, value } = updateProductSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Error de validación',
        errors: error.details.map(detail => detail.message)
      });
    }

    // Buscar producto
    const product = await Product.findOne({
      where: { id, activo: true }
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Producto no encontrado'
      });
    }

    // Actualizar producto
    await product.update(value);

    logger.info(`Producto actualizado exitosamente: ${product.nombre} por usuario ${req.user.email}`);

    res.json({
      success: true,
      message: 'Producto actualizado exitosamente',
      data: product
    });
  } catch (error) {
    logger.error('Error al actualizar producto:', error);
    next(error);
  }
});

/**
 * @api {delete} /api/products/:id Eliminar producto
 * @apiName DeleteProduct
 * @apiGroup Products
 * @apiHeader {String} Authorization Bearer token
 * @apiPermission admin
 * 
 * @apiParam {Number} id ID del producto
 * 
 * @apiSuccess {Boolean} success Estado de la operación
 * @apiSuccess {String} message Mensaje de respuesta
 */
router.delete('/:id', authenticate, adminOnly, async (req, res, next) => {
  try {
    const { id } = req.params;

    const product = await Product.findOne({
      where: { id, activo: true }
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Producto no encontrado'
      });
    }

    // Soft delete - marcar como inactivo
    await product.update({ activo: false });

    logger.info(`Producto eliminado exitosamente: ${product.nombre} por usuario ${req.user.email}`);

    res.json({
      success: true,
      message: 'Producto eliminado exitosamente'
    });
  } catch (error) {
    logger.error('Error al eliminar producto:', error);
    next(error);
  }
});

module.exports = router;