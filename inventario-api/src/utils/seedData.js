const { User, Product } = require('../models');
const logger = require('./logger');

/**
 * Crear datos iniciales para el sistema
 * Ejecutar una sola vez al configurar el sistema
 */
const seedData = async () => {
  try {
    // Verificar si ya existen datos
    const userCount = await User.count();
    if (userCount > 0) {
      logger.info('Ya existen datos en el sistema, omitiendo seed');
      return;
    }

    logger.info('Iniciando seed de datos...');

    // Crear usuario administrador
    const admin = await User.create({
      nombre: 'Administrador del Sistema',
      email: 'admin@inventario.com',
      password: 'admin123456',
      role: 'admin'
    });
    logger.info('Usuario administrador creado');

    // Crear usuario cliente de prueba
    const cliente = await User.create({
      nombre: 'Cliente de Prueba',
      email: 'cliente@test.com',
      password: 'cliente123',
      role: 'cliente'
    });
    logger.info('Usuario cliente creado');

    // Crear productos de ejemplo
    const productos = [
      {
        numero_lote: 'TECH001',
        nombre: 'Laptop HP Pavilion 15.6"',
        precio: 899.99,
        cantidad_disponible: 15,
        descripcion: 'Laptop HP Pavilion con procesador Intel Core i5, 8GB RAM, 256GB SSD'
      },
      {
        numero_lote: 'TECH002',
        nombre: 'Mouse Inalámbrico Logitech',
        precio: 29.99,
        cantidad_disponible: 50,
        descripcion: 'Mouse inalámbrico ergonómico con sensor óptico de alta precisión'
      },
      {
        numero_lote: 'TECH003',
        nombre: 'Teclado Mecánico RGB',
        precio: 79.99,
        cantidad_disponible: 25,
        descripcion: 'Teclado mecánico con retroiluminación RGB y switches Cherry MX'
      },
      {
        numero_lote: 'TECH004',
        nombre: 'Monitor LED 24" Full HD',
        precio: 189.99,
        cantidad_disponible: 12,
        descripcion: 'Monitor LED de 24 pulgadas con resolución Full HD 1920x1080'
      },
      {
        numero_lote: 'TECH005',
        nombre: 'Auriculares Bluetooth',
        precio: 59.99,
        cantidad_disponible: 30,
        descripcion: 'Auriculares inalámbricos con cancelación de ruido y hasta 20h de batería'
      },
      {
        numero_lote: 'OFF001',
        nombre: 'Cuaderno Universitario A4',
        precio: 4.99,
        cantidad_disponible: 100,
        descripcion: 'Cuaderno universitario de 100 hojas, rayado, tamaño A4'
      },
      {
        numero_lote: 'OFF002',
        nombre: 'Bolígrafo Azul Paquete 12u',
        precio: 8.50,
        cantidad_disponible: 75,
        descripcion: 'Paquete de 12 bolígrafos de tinta azul, punta media'
      },
      {
        numero_lote: 'HOME001',
        nombre: 'Cafetera Express 15 Bar',
        precio: 159.99,
        cantidad_disponible: 8,
        descripcion: 'Cafetera express con bomba de 15 bares, incluye vaporizador para leche'
      }
    ];

    for (const producto of productos) {
      await Product.create(producto);
    }
    
    logger.info(`Se crearon ${productos.length} productos de ejemplo`);
    logger.info('Seed de datos completado exitosamente');

    // Mostrar credenciales de acceso
    console.log('\n=== CREDENCIALES DE ACCESO ===');
    console.log('Administrador:');
    console.log('Email: admin@inventario.com');
    console.log('Password: admin123456');
    console.log('\nCliente:');
    console.log('Email: cliente@test.com');
    console.log('Password: cliente123');
    console.log('================================\n');

  } catch (error) {
    logger.error('Error al crear datos iniciales:', error);
    throw error;
  }
};

module.exports = seedData;

// Si el archivo se ejecuta directamente
if (require.main === module) {
  const { sequelize } = require('../config/database');
  
  (async () => {
    try {
      await sequelize.authenticate();
      await sequelize.sync({ force: false });
      await seedData();
      process.exit(0);
    } catch (error) {
      console.error('Error:', error);
      process.exit(1);
    }
  })();
}