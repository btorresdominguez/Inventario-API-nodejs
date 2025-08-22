const express = require('express');
const { Op } = require('sequelize');
const { sequelize, User, Product, Purchase, PurchaseDetail } = require('../models');
const { purchaseSchema, queryParamsSchema } = require('../utils/validationSchemas');
const { authenticate, adminOnly, authorize } = require('../middleware/auth');
const { generateInvoiceNumber } = require('../models/Purchase');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * @api {post} /api/purchases Crear compra
 * @apiName CreatePurchase
 * @apiGroup Purchases
 * @apiHeader {String} Authorization Bearer token
 * @apiPermission cliente
 */
router.post('/', authenticate, authorize('cliente'), async (req, res, next) => {
  const transaction = await sequelize.transaction();
  
  try {
    // Validar datos de entrada
    const { error, value } = purchaseSchema.validate(req.body);
    if (error) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Error de validación de datos',
        errors: error.details.map(detail => detail.message),
        timestamp: new Date().toISOString(),
        path: req.path
      });
    }

    const { productos } = value;
    let total = 0;
    const detalles = [];

    logger.info(`Iniciando compra para usuario ${req.user.id} con ${productos.length} productos`);

    // ============================================
    // PASO 1: Verificar y bloquear productos (FOR UPDATE)
    // ============================================
    const productIds = productos.map(item => item.product_id);
    const availableProducts = await Product.findAll({
      where: { 
        id: { [Op.in]: productIds }, 
        activo: true 
      },
      lock: true, // FOR UPDATE - Bloquear filas para evitar race conditions
      transaction
    });

    // Verificar que todos los productos existen
    if (availableProducts.length !== productIds.length) {
      await transaction.rollback();
      const foundIds = availableProducts.map(p => p.id);
      const missingIds = productIds.filter(id => !foundIds.includes(id));
      
      return res.status(404).json({
        success: false,
        message: `Productos no encontrados o inactivos: ${missingIds.join(', ')}`,
        timestamp: new Date().toISOString(),
        path: req.path
      });
    }

    // ============================================
    // PASO 2: Validar stock y calcular totales
    // ============================================
    for (const item of productos) {
      const product = availableProducts.find(p => p.id === item.product_id);
      
      if (product.cantidad_disponible < item.cantidad) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: `Stock insuficiente para ${product.nombre}. Disponible: ${product.cantidad_disponible}, Solicitado: ${item.cantidad}`,
          timestamp: new Date().toISOString(),
          path: req.path
        });
      }

      const precioUnitario = parseFloat(product.precio);
      const subtotal = precioUnitario * item.cantidad;
      total += subtotal;

      detalles.push({
        product_id: product.id,
        cantidad: item.cantidad,
        precio_unitario: precioUnitario,
        subtotal: subtotal.toFixed(2),
        product
      });
    }

    // ============================================
    // PASO 3: Generar número de factura único
    // ============================================
    let numeroFactura;
    let attempts = 0;
    const maxAttempts = 5;

    do {
      numeroFactura = generateInvoiceNumber();
      const existingInvoice = await Purchase.findOne({
        where: { numero_factura: numeroFactura },
        transaction
      });
      
      if (!existingInvoice) break;
      
      attempts++;
      if (attempts >= maxAttempts) {
        await transaction.rollback();
        return res.status(500).json({
          success: false,
          message: 'Error generando número de factura único',
          timestamp: new Date().toISOString(),
          path: req.path
        });
      }
      
      // Esperar un poco antes del siguiente intento
      await new Promise(resolve => setTimeout(resolve, 10));
    } while (attempts < maxAttempts);

    logger.info(`Número de factura generado: ${numeroFactura}`);

    // ============================================
    // PASO 4: Crear la compra
    // ============================================
    const purchase = await Purchase.create({
      user_id: req.user.id,
      total: total.toFixed(2),
      numero_factura: numeroFactura,
      estado: 'completada',
      fecha_compra: new Date()
    }, { transaction });

    logger.info(`Compra creada con ID: ${purchase.id}, Factura: ${purchase.numero_factura}`);

    // ============================================
    // PASO 5: Crear detalles y actualizar stock EN LOTE
    // ============================================
    const detallesCreados = [];
    const stockUpdates = [];

    for (const detalle of detalles) {
      // Crear detalle
      const purchaseDetail = await PurchaseDetail.create({
        purchase_id: purchase.id,
        product_id: detalle.product_id,
        cantidad: detalle.cantidad,
        precio_unitario: detalle.precio_unitario,
        subtotal: detalle.subtotal
      }, { transaction });

      detallesCreados.push(purchaseDetail);

      // Preparar actualización de stock
      const newStock = detalle.product.cantidad_disponible - detalle.cantidad;
      stockUpdates.push({
        id: detalle.product.id,
        cantidad_disponible: newStock
      });
    }

    // Actualizar stock de todos los productos en una sola operación
    for (const update of stockUpdates) {
      await Product.update(
        { cantidad_disponible: update.cantidad_disponible },
        { 
          where: { id: update.id },
          transaction
        }
      );
      
      logger.info(`Stock actualizado para producto ${update.id}: ${update.cantidad_disponible} restantes`);
    }

    // ============================================
    // PASO 6: Confirmar transacción
    // ============================================
    await transaction.commit();

    // ============================================
    // PASO 7: Obtener datos completos para respuesta
    // ============================================
    const completePurchase = await Purchase.findByPk(purchase.id, {
      include: [
        {
          model: PurchaseDetail,
          as: 'details',
          include: [
            {
              model: Product,
              as: 'product',
              attributes: ['id', 'nombre', 'numero_lote', 'precio']
            }
          ]
        },
        {
          model: User,
          as: 'user',
          attributes: ['id', 'nombre', 'email']
        }
      ]
    });

    logger.info(`Compra completada exitosamente: ${purchase.numero_factura} por usuario ${req.user.email} - Total: $${purchase.total}`);

    res.status(201).json({
      success: true,
      message: 'Compra realizada exitosamente',
      data: completePurchase,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    await transaction.rollback();
    
    logger.error('Error al crear compra:', {
      error: error.message,
      stack: error.stack,
      userId: req.user?.id,
      productos: req.body?.productos
    });

    // Manejar errores específicos
    if (error.name === 'SequelizeTimeoutError' || error.message.includes('Lock wait timeout')) {
      return res.status(503).json({
        success: false,
        message: 'El sistema está ocupado, intente nuevamente en unos segundos',
        timestamp: new Date().toISOString(),
        path: req.path
      });
    }

    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Error de validación de datos',
        errors: error.errors.map(e => `${e.path}: ${e.message}`),
        timestamp: new Date().toISOString(),
        path: req.path
      });
    }

    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({
        success: false,
        message: 'Conflicto de datos únicos - intente nuevamente',
        timestamp: new Date().toISOString(),
        path: req.path
      });
    }

    next(error);
  }
});

/**
 * @api {get} /api/purchases Obtener compras
 */
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { error, value } = queryParamsSchema.validate(req.query);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Parámetros de consulta inválidos',
        errors: error.details.map(detail => detail.message),
        timestamp: new Date().toISOString(),
        path: req.path
      });
    }

    const { page, limit } = value;
    const offset = (page - 1) * limit;

    const whereConditions = {};
    const includeUser = [];

    if (req.user.role === 'cliente') {
      whereConditions.user_id = req.user.id;
    } else {
      includeUser.push({
        model: User,
        as: 'user',
        attributes: ['id', 'nombre', 'email']
      });
    }

    const { count, rows: purchases } = await Purchase.findAndCountAll({
      where: whereConditions,
      include: [
        ...includeUser,
        {
          model: PurchaseDetail,
          as: 'details',
          include: [
            {
              model: Product,
              as: 'product',
              attributes: ['id', 'nombre', 'numero_lote', 'precio']
            }
          ]
        }
      ],
      order: [['created_at', 'DESC']],
      limit,
      offset
    });

    const totalPages = Math.ceil(count / limit);

    res.json({
      success: true,
      data: {
        purchases,
        pagination: {
          currentPage: page,
          totalPages,
          totalItems: count,
          itemsPerPage: limit,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error al obtener compras:', error);
    next(error);
  }
});

/**
 * @api {get} /api/purchases/history Obtener historial de compras del usuario
 */
router.get('/history', authenticate, authorize('cliente'), async (req, res, next) => {
  try {
    const purchases = await Purchase.findAll({
      where: { user_id: req.user.id },
      include: [
        {
          model: PurchaseDetail,
          as: 'details',
          include: [
            {
              model: Product,
              as: 'product',
              attributes: ['id', 'nombre', 'numero_lote', 'descripcion', 'precio']
            }
          ]
        }
      ],
      order: [['created_at', 'DESC']]
    });

    const productHistory = [];
    purchases.forEach(purchase => {
      purchase.details.forEach(detail => {
        productHistory.push({
          compra_id: purchase.id,
          numero_factura: purchase.numero_factura,
          fecha_compra: purchase.fecha_compra,
          estado: purchase.estado,
          producto: detail.product,
          cantidad: detail.cantidad,
          precio_unitario: detail.precio_unitario,
          subtotal: detail.subtotal,
          created_at: detail.created_at
        });
      });
    });

    res.json({
      success: true,
      data: productHistory,
      summary: {
        total_compras: purchases.length,
        total_productos: productHistory.length,
        total_gastado: purchases.reduce((sum, p) => sum + parseFloat(p.total), 0).toFixed(2)
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error al obtener historial:', error);
    next(error);
  }
});

/**
 * @api {get} /api/purchases/:id Obtener factura de compra
 */
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    
    if (!id || isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID de compra inválido',
        timestamp: new Date().toISOString(),
        path: req.path
      });
    }
    
    const whereConditions = { id: parseInt(id) };
    
    if (req.user.role === 'cliente') {
      whereConditions.user_id = req.user.id;
    }

    const purchase = await Purchase.findOne({
      where: whereConditions,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'nombre', 'email']
        },
        {
          model: PurchaseDetail,
          as: 'details',
          include: [
            {
              model: Product,
              as: 'product',
              attributes: ['id', 'nombre', 'numero_lote', 'precio', 'descripcion']
            }
          ]
        }
      ]
    });

    if (!purchase) {
      return res.status(404).json({
        success: false,
        message: 'Compra no encontrada o no tiene permisos para verla',
        timestamp: new Date().toISOString(),
        path: req.path
      });
    }

    res.json({
      success: true,
      data: purchase,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error al obtener factura:', error);
    next(error);
  }
});

/**
 * @api {get} /api/purchases/admin/sales Obtener reporte de ventas (Solo Admin)
 */
router.get('/admin/sales', authenticate, adminOnly, async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const whereConditions = {};

    if (startDate || endDate) {
      whereConditions.fecha_compra = {};
      if (startDate) {
        whereConditions.fecha_compra[Op.gte] = new Date(startDate);
      }
      if (endDate) {
        const endDateTime = new Date(endDate + ' 23:59:59');
        whereConditions.fecha_compra[Op.lte] = endDateTime;
      }
    }

    const purchases = await Purchase.findAll({
      where: whereConditions,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'nombre', 'email']
        },
        {
          model: PurchaseDetail,
          as: 'details',
          include: [
            {
              model: Product,
              as: 'product',
              attributes: ['id', 'nombre', 'numero_lote', 'precio']
            }
          ]
        }
      ],
      order: [['fecha_compra', 'DESC']]
    });

    const totalVentas = purchases.reduce((sum, purchase) => sum + parseFloat(purchase.total), 0);
    const totalCompras = purchases.length;
    const clientesUnicos = new Set(purchases.map(p => p.user_id)).size;
    
    const productosVendidos = {};
    purchases.forEach(purchase => {
      purchase.details.forEach(detail => {
        const productId = detail.product.id;
        if (!productosVendidos[productId]) {
          productosVendidos[productId] = {
            producto: detail.product,
            cantidad_total: 0,
            ingresos_total: 0,
            veces_vendido: 0
          };
        }
        productosVendidos[productId].cantidad_total += detail.cantidad;
        productosVendidos[productId].ingresos_total += parseFloat(detail.subtotal);
        productosVendidos[productId].veces_vendido += 1;
      });
    });

    const topProductos = Object.values(productosVendidos)
      .sort((a, b) => b.cantidad_total - a.cantidad_total)
      .slice(0, 5);

    res.json({
      success: true,
      data: {
        resumen: {
          total_ventas: totalVentas.toFixed(2),
          total_compras: totalCompras,
          clientes_unicos: clientesUnicos,
          promedio_por_compra: totalCompras > 0 ? (totalVentas / totalCompras).toFixed(2) : '0.00',
          fecha_inicio: startDate || 'Sin límite',
          fecha_fin: endDate || 'Sin límite'
        },
        top_productos: topProductos,
        compras: purchases
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error al obtener reporte de ventas:', error);
    next(error);
  }
});

module.exports = router;