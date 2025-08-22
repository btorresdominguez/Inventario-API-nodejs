const { sequelize } = require('../config/database');
const User = require('./User');
const Product = require('./Product');
const { Purchase, PurchaseDetail } = require('./Purchase');

/**
 * Definición de relaciones entre modelos
 */

// Relación User - Purchase (Un usuario puede tener muchas compras)
User.hasMany(Purchase, {
  foreignKey: 'user_id',
  as: 'purchases'
});

Purchase.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user'
});

// Relación Purchase - PurchaseDetail (Una compra puede tener muchos detalles)
Purchase.hasMany(PurchaseDetail, {
  foreignKey: 'purchase_id',
  as: 'details'
});

PurchaseDetail.belongsTo(Purchase, {
  foreignKey: 'purchase_id',
  as: 'purchase'
});

// Relación Product - PurchaseDetail (Un producto puede estar en muchos detalles)
Product.hasMany(PurchaseDetail, {
  foreignKey: 'product_id',
  as: 'purchase_details'
});

PurchaseDetail.belongsTo(Product, {
  foreignKey: 'product_id',
  as: 'product'
});

// Relación Many-to-Many entre User y Product a través de Purchase y PurchaseDetail
User.belongsToMany(Product, {
  through: {
    model: PurchaseDetail,
    unique: false
  },
  foreignKey: 'user_id',
  otherKey: 'product_id',
  as: 'purchased_products'
});

Product.belongsToMany(User, {
  through: {
    model: PurchaseDetail,
    unique: false
  },
  foreignKey: 'product_id',
  otherKey: 'user_id',
  as: 'buyers'
});

module.exports = {
  sequelize,
  User,
  Product,
  Purchase,
  PurchaseDetail
};