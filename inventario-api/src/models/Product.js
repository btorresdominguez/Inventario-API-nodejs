const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * Modelo de Producto
 * Representa los productos del inventario
 */
const Product = sequelize.define('Product', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  numero_lote: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: {
      msg: 'El número de lote ya existe'
    },
    validate: {
      notEmpty: {
        msg: 'El número de lote es requerido'
      }
    }
  },
  nombre: {
    type: DataTypes.STRING(200),
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'El nombre del producto es requerido'
      },
      len: {
        args: [2, 200],
        msg: 'El nombre debe tener entre 2 y 200 caracteres'
      }
    }
  },
  precio: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    validate: {
      isDecimal: {
        msg: 'El precio debe ser un número válido'
      },
      min: {
        args: [0.01],
        msg: 'El precio debe ser mayor a 0'
      }
    }
  },
  cantidad_disponible: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    validate: {
      isInt: {
        msg: 'La cantidad debe ser un número entero'
      },
      min: {
        args: [0],
        msg: 'La cantidad no puede ser negativa'
      }
    }
  },
  fecha_ingreso: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    validate: {
      isDate: {
        msg: 'La fecha de ingreso debe ser válida'
      }
    }
  },
  descripcion: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  activo: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'products',
  timestamps: true,
  indexes: [
    {
      fields: ['numero_lote']
    },
    {
      fields: ['nombre']
    },
    {
      fields: ['activo']
    }
  ]
});

/**
 * Método para verificar disponibilidad de stock
 * @param {number} cantidad - Cantidad solicitada
 * @returns {boolean} - Verdadero si hay stock suficiente
 */
Product.prototype.tieneStock = function(cantidad) {
  return this.cantidad_disponible >= cantidad;
};

/**
 * Método para reducir stock
 * @param {number} cantidad - Cantidad a reducir
 * @returns {boolean} - Verdadero si se pudo reducir el stock
 */
Product.prototype.reducirStock = async function(cantidad) {
  if (!this.tieneStock(cantidad)) {
    throw new Error(`Stock insuficiente. Disponible: ${this.cantidad_disponible}, Solicitado: ${cantidad}`);
  }
  
  this.cantidad_disponible -= cantidad;
  await this.save();
  return true;
};

/**
 * Método para aumentar stock
 * @param {number} cantidad - Cantidad a agregar
 */
Product.prototype.aumentarStock = async function(cantidad) {
  this.cantidad_disponible += cantidad;
  await this.save();
};

module.exports = Product;