const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * Función utilitaria para generar números de factura únicos
 */
const generateInvoiceNumber = () => {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `FAC-${timestamp}-${random}`;
};

/**
 * Modelo de Compra
 * Representa las compras realizadas por los clientes
 */
const Purchase = sequelize.define('Purchase', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  fecha_compra: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  total: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    validate: {
      isDecimal: {
        msg: 'El total debe ser un número válido'
      },
      min: {
        args: [0.01],
        msg: 'El total debe ser mayor a 0'
      }
    }
  },
  estado: {
    type: DataTypes.ENUM('pendiente', 'completada', 'cancelada'),
    defaultValue: 'completada'
  },
  numero_factura: {
    type: DataTypes.STRING(50),
    allowNull: true, // Permitir null temporalmente para que el hook funcione
    unique: true
  }
}, {
  tableName: 'purchases',
  timestamps: true,
  indexes: [
    {
      fields: ['user_id']
    },
    {
      fields: ['fecha_compra']
    },
    {
      fields: ['numero_factura']
    },
    {
      fields: ['estado']
    }
  ]
});

/**
 * Modelo de Detalle de Compra
 * Representa los productos incluidos en cada compra
 */
const PurchaseDetail = sequelize.define('PurchaseDetail', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  purchase_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'purchases',
      key: 'id'
    }
  },
  product_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'products',
      key: 'id'
    }
  },
  cantidad: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      isInt: {
        msg: 'La cantidad debe ser un número entero'
      },
      min: {
        args: [1],
        msg: 'La cantidad debe ser mayor a 0'
      }
    }
  },
  precio_unitario: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    validate: {
      isDecimal: {
        msg: 'El precio unitario debe ser un número válido'
      },
      min: {
        args: [0.01],
        msg: 'El precio unitario debe ser mayor a 0'
      }
    }
  },
  subtotal: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    validate: {
      isDecimal: {
        msg: 'El subtotal debe ser un número válido'
      }
    }
  }
}, {
  tableName: 'purchase_details',
  timestamps: true,
  indexes: [
    {
      fields: ['purchase_id']
    },
    {
      fields: ['product_id']
    },
    {
      fields: ['purchase_id', 'product_id']
    }
  ]
});

// ============================================
// HOOKS - Definidos después de los modelos
// ============================================

/**
 * Hook para generar número de factura automáticamente
 * Se ejecuta como respaldo si no se proporciona en el controlador
 */
Purchase.addHook('beforeCreate', async (purchase, options) => {
  try {
    if (!purchase.numero_factura) {
      purchase.numero_factura = generateInvoiceNumber();
      console.log(`🧾 Número de factura generado automáticamente: ${purchase.numero_factura}`);
    }
  } catch (error) {
    console.error('❌ Error en hook beforeCreate de Purchase:', error);
    throw error;
  }
});

/**
 * Hook para validar que el número de factura no esté vacío antes de guardar
 */
Purchase.addHook('beforeSave', async (purchase, options) => {
  if (!purchase.numero_factura || purchase.numero_factura.trim() === '') {
    purchase.numero_factura = generateInvoiceNumber();
    console.log(`🛡️ Número de factura generado en beforeSave: ${purchase.numero_factura}`);
  }
});

/**
 * Hooks para cálculo automático de subtotales
 */
PurchaseDetail.addHook('beforeCreate', (detail) => {
  try {
    const cantidad = parseInt(detail.cantidad);
    const precioUnitario = parseFloat(detail.precio_unitario);
    detail.subtotal = (cantidad * precioUnitario).toFixed(2);
    
    console.log(`💰 Subtotal calculado: ${detail.cantidad} x ${detail.precio_unitario} = ${detail.subtotal}`);
  } catch (error) {
    console.error('❌ Error calculando subtotal en beforeCreate:', error);
    throw error;
  }
});

PurchaseDetail.addHook('beforeUpdate', (detail) => {
  try {
    if (detail.changed('precio_unitario') || detail.changed('cantidad')) {
      const cantidad = parseInt(detail.cantidad);
      const precioUnitario = parseFloat(detail.precio_unitario);
      detail.subtotal = (cantidad * precioUnitario).toFixed(2);
      
      console.log(`💰 Subtotal recalculado: ${detail.cantidad} x ${detail.precio_unitario} = ${detail.subtotal}`);
    }
  } catch (error) {
    console.error('❌ Error recalculando subtotal en beforeUpdate:', error);
    throw error;
  }
});

// ============================================
// MÉTODOS ESTÁTICOS ÚTILES
// ============================================

/**
 * Método estático para crear compra con validaciones
 */
Purchase.createPurchaseWithDetails = async (userId, productos, transaction = null) => {
  try {
    // Generar número de factura único
    const numeroFactura = generateInvoiceNumber();
    
    // Calcular total
    let total = 0;
    for (const item of productos) {
      const cantidad = parseInt(item.cantidad);
      const precioUnitario = parseFloat(item.precio_unitario);
      total += cantidad * precioUnitario;
    }
    
    // Crear la compra
    const purchase = await Purchase.create({
      user_id: userId,
      total: total.toFixed(2),
      numero_factura: numeroFactura,
      estado: 'completada'
    }, { transaction });
    
    console.log(`✅ Compra creada exitosamente: ${purchase.numero_factura}`);
    return purchase;
    
  } catch (error) {
    console.error('❌ Error en createPurchaseWithDetails:', error);
    throw error;
  }
};

/**
 * Método estático para verificar unicidad del número de factura
 */
Purchase.isInvoiceNumberUnique = async (numeroFactura) => {
  try {
    const existing = await Purchase.findOne({
      where: { numero_factura: numeroFactura }
    });
    return !existing;
  } catch (error) {
    console.error('❌ Error verificando unicidad del número de factura:', error);
    return false;
  }
};

// ============================================
// EXPORTAR MODELOS Y UTILIDADES
// ============================================

module.exports = {
  Purchase,
  PurchaseDetail,
  generateInvoiceNumber
};