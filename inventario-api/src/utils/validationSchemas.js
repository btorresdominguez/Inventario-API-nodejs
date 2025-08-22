const Joi = require('joi');

/**
 * Esquemas de validación usando Joi
 * Define las reglas de validación para diferentes endpoints
 */

// Validación para registro de usuario
const registerSchema = Joi.object({
  nombre: Joi.string()
    .min(2)
    .max(100)
    .required()
    .messages({
      'string.min': 'El nombre debe tener al menos 2 caracteres',
      'string.max': 'El nombre no puede exceder 100 caracteres',
      'any.required': 'El nombre es requerido'
    }),
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': 'Debe ser un email válido',
      'any.required': 'El email es requerido'
    }),
  password: Joi.string()
    .min(6)
    .required()
    .messages({
      'string.min': 'La contraseña debe tener al menos 6 caracteres',
      'any.required': 'La contraseña es requerida'
    }),
  role: Joi.string()
    .valid('admin', 'cliente')
    .default('cliente')
    .messages({
      'any.only': 'El rol debe ser admin o cliente'
    })
});

// Validación para login
const loginSchema = Joi.object({
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': 'Debe ser un email válido',
      'any.required': 'El email es requerido'
    }),
  password: Joi.string()
    .required()
    .messages({
      'any.required': 'La contraseña es requerida'
    })
});

// Validación para productos
const productSchema = Joi.object({
  numero_lote: Joi.string()
    .required()
    .messages({
      'any.required': 'El número de lote es requerido'
    }),
  nombre: Joi.string()
    .min(2)
    .max(200)
    .required()
    .messages({
      'string.min': 'El nombre debe tener al menos 2 caracteres',
      'string.max': 'El nombre no puede exceder 200 caracteres',
      'any.required': 'El nombre del producto es requerido'
    }),
  precio: Joi.number()
    .positive()
    .precision(2)
    .required()
    .messages({
      'number.positive': 'El precio debe ser mayor a 0',
      'any.required': 'El precio es requerido'
    }),
  cantidad_disponible: Joi.number()
    .integer()
    .min(0)
    .required()
    .messages({
      'number.integer': 'La cantidad debe ser un número entero',
      'number.min': 'La cantidad no puede ser negativa',
      'any.required': 'La cantidad disponible es requerida'
    }),
  fecha_ingreso: Joi.date()
    .default(Date.now),
  descripcion: Joi.string()
    .max(1000)
    .allow('')
    .messages({
      'string.max': 'La descripción no puede exceder 1000 caracteres'
    })
});

// Validación para actualización de productos
const updateProductSchema = Joi.object({
  numero_lote: Joi.string(),
  nombre: Joi.string()
    .min(2)
    .max(200)
    .messages({
      'string.min': 'El nombre debe tener al menos 2 caracteres',
      'string.max': 'El nombre no puede exceder 200 caracteres'
    }),
  precio: Joi.number()
    .positive()
    .precision(2)
    .messages({
      'number.positive': 'El precio debe ser mayor a 0'
    }),
  cantidad_disponible: Joi.number()
    .integer()
    .min(0)
    .messages({
      'number.integer': 'La cantidad debe ser un número entero',
      'number.min': 'La cantidad no puede ser negativa'
    }),
  fecha_ingreso: Joi.date(),
  descripcion: Joi.string()
    .max(1000)
    .allow('')
    .messages({
      'string.max': 'La descripción no puede exceder 1000 caracteres'
    }),
  activo: Joi.boolean()
});

// Validación para items de compra
const purchaseItemSchema = Joi.object({
  product_id: Joi.number()
    .integer()
    .positive()
    .required()
    .messages({
      'number.integer': 'El ID del producto debe ser un número entero',
      'number.positive': 'El ID del producto debe ser mayor a 0',
      'any.required': 'El ID del producto es requerido'
    }),
  cantidad: Joi.number()
    .integer()
    .min(1)
    .required()
    .messages({
      'number.integer': 'La cantidad debe ser un número entero',
      'number.min': 'La cantidad debe ser mayor a 0',
      'any.required': 'La cantidad es requerida'
    })
});

// Validación para compras
const purchaseSchema = Joi.object({
  productos: Joi.array()
    .items(purchaseItemSchema)
    .min(1)
    .required()
    .messages({
      'array.min': 'Debe incluir al menos un producto',
      'any.required': 'Los productos son requeridos'
    })
});

// Validación para parámetros de consulta
const queryParamsSchema = Joi.object({
  page: Joi.number()
    .integer()
    .min(1)
    .default(1)
    .messages({
      'number.integer': 'La página debe ser un número entero',
      'number.min': 'La página debe ser mayor a 0'
    }),
  limit: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .default(10)
    .messages({
      'number.integer': 'El límite debe ser un número entero',
      'number.min': 'El límite debe ser mayor a 0',
      'number.max': 'El límite no puede exceder 100'
    }),
  search: Joi.string()
    .max(100)
    .allow('')
    .messages({
      'string.max': 'El término de búsqueda no puede exceder 100 caracteres'
    }),
  sortBy: Joi.string()
    .valid('id', 'nombre', 'precio', 'cantidad_disponible', 'fecha_ingreso', 'created_at')
    .default('created_at'),
  order: Joi.string()
    .valid('ASC', 'DESC')
    .default('DESC')
});

module.exports = {
  registerSchema,
  loginSchema,
  productSchema,
  updateProductSchema,
  purchaseSchema,
  purchaseItemSchema,
  queryParamsSchema
};