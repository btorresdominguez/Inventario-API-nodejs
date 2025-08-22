-- ============================================
-- Script de Creación de Base de Datos
-- Sistema de Inventario API
-- MySQL 8.0+
-- ============================================

-- 1. Crear base de datos
DROP DATABASE IF EXISTS inventario_db;
CREATE DATABASE inventario_db 
  CHARACTER SET utf8mb4 
  COLLATE utf8mb4_unicode_ci;

-- 2. Usar la base de datos
USE inventario_db;

-- ============================================
-- TABLA: users
-- Almacena información de usuarios del sistema
-- ============================================
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role ENUM('admin', 'cliente') DEFAULT 'cliente',
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Índices
  INDEX idx_email (email),
  INDEX idx_role (role),
  INDEX idx_activo (activo)
) ENGINE=InnoDB;

-- ============================================
-- TABLA: products
-- Almacena el inventario de productos
-- ============================================
CREATE TABLE products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  numero_lote VARCHAR(50) NOT NULL UNIQUE,
  nombre VARCHAR(200) NOT NULL,
  precio DECIMAL(10,2) NOT NULL CHECK (precio > 0),
  cantidad_disponible INT NOT NULL DEFAULT 0 CHECK (cantidad_disponible >= 0),
  fecha_ingreso DATE NOT NULL DEFAULT (CURRENT_DATE),
  descripcion TEXT,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Índices
  INDEX idx_numero_lote (numero_lote),
  INDEX idx_nombre (nombre),
  INDEX idx_activo (activo),
  INDEX idx_fecha_ingreso (fecha_ingreso),
  
  -- Full-text search para búsquedas
  FULLTEXT idx_search (nombre, descripcion)
) ENGINE=InnoDB;

-- ============================================
-- TABLA: purchases
-- Almacena las compras realizadas
-- ============================================
CREATE TABLE purchases (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  fecha_compra TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  total DECIMAL(12,2) NOT NULL CHECK (total > 0),
  estado ENUM('pendiente', 'completada', 'cancelada') DEFAULT 'completada',
  numero_factura VARCHAR(50) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Clave foránea
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  
  -- Índices
  INDEX idx_user_id (user_id),
  INDEX idx_fecha_compra (fecha_compra),
  INDEX idx_numero_factura (numero_factura),
  INDEX idx_estado (estado)
) ENGINE=InnoDB;

-- ============================================
-- TABLA: purchase_details
-- Almacena los detalles de cada compra
-- ============================================
CREATE TABLE purchase_details (
  id INT AUTO_INCREMENT PRIMARY KEY,
  purchase_id INT NOT NULL,
  product_id INT NOT NULL,
  cantidad INT NOT NULL CHECK (cantidad > 0),
  precio_unitario DECIMAL(10,2) NOT NULL CHECK (precio_unitario > 0),
  subtotal DECIMAL(12,2) NOT NULL CHECK (subtotal > 0),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Claves foráneas
  FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  
  -- Índices
  INDEX idx_purchase_id (purchase_id),
  INDEX idx_product_id (product_id),
  
  -- Índice compuesto para consultas frecuentes
  INDEX idx_purchase_product (purchase_id, product_id)
) ENGINE=InnoDB;

-- ============================================
-- TRIGGERS
-- ============================================

-- Trigger para validar subtotal en purchase_details
DELIMITER $$
CREATE TRIGGER trg_validate_subtotal_before_insert
BEFORE INSERT ON purchase_details
FOR EACH ROW
BEGIN
  SET NEW.subtotal = NEW.cantidad * NEW.precio_unitario;
END$$

CREATE TRIGGER trg_validate_subtotal_before_update
BEFORE UPDATE ON purchase_details
FOR EACH ROW
BEGIN
  SET NEW.subtotal = NEW.cantidad * NEW.precio_unitario;
END$$
DELIMITER ;

-- ============================================
-- VISTAS ÚTILES
-- ============================================

-- Vista de productos con stock bajo
CREATE VIEW productos_stock_bajo AS
SELECT 
  id,
  numero_lote,
  nombre,
  precio,
  cantidad_disponible,
  fecha_ingreso
FROM products 
WHERE cantidad_disponible < 10 AND activo = TRUE;

-- Vista de resumen de ventas por producto
CREATE VIEW resumen_ventas_productos AS
SELECT 
  p.id,
  p.numero_lote,
  p.nombre,
  COUNT(pd.id) as total_vendidos,
  SUM(pd.cantidad) as cantidad_total_vendida,
  SUM(pd.subtotal) as ingresos_totales,
  AVG(pd.precio_unitario) as precio_promedio
FROM products p
LEFT JOIN purchase_details pd ON p.id = pd.product_id
LEFT JOIN purchases pu ON pd.purchase_id = pu.id
WHERE pu.estado = 'completada'
GROUP BY p.id, p.numero_lote, p.nombre;

-- Vista de compras por usuario
CREATE VIEW compras_por_usuario AS
SELECT 
  u.id as user_id,
  u.nombre,
  u.email,
  COUNT(pu.id) as total_compras,
  SUM(pu.total) as total_gastado,
  MAX(pu.fecha_compra) as ultima_compra
FROM users u
LEFT JOIN purchases pu ON u.id = pu.user_id
WHERE u.role = 'cliente' AND u.activo = TRUE
GROUP BY u.id, u.nombre, u.email;

-- ============================================
-- PROCEDIMIENTOS ALMACENADOS
-- ============================================

-- Procedimiento para obtener reporte de ventas por período
DELIMITER $$
CREATE PROCEDURE GetSalesReport(
  IN p_start_date DATE,
  IN p_end_date DATE
)
BEGIN
  SELECT 
    DATE(pu.fecha_compra) as fecha,
    COUNT(pu.id) as total_compras,
    SUM(pu.total) as total_ventas,
    COUNT(DISTINCT pu.user_id) as clientes_unicos,
    AVG(pu.total) as ticket_promedio
  FROM purchases pu
  WHERE pu.fecha_compra BETWEEN p_start_date AND p_end_date
    AND pu.estado = 'completada'
  GROUP BY DATE(pu.fecha_compra)
  ORDER BY fecha DESC;
END$$

-- Procedimiento para verificar stock antes de compra
CREATE PROCEDURE CheckProductStock(
  IN p_product_id INT,
  IN p_quantity INT,
  OUT p_available BOOLEAN,
  OUT p_current_stock INT
)
BEGIN
  SELECT cantidad_disponible INTO p_current_stock
  FROM products 
  WHERE id = p_product_id AND activo = TRUE;
  
  SET p_available = (p_current_stock >= p_quantity);
END$$

DELIMITER ;

-- ============================================
-- DATOS INICIALES (OPCIONAL)
-- ============================================

-- Usuario administrador por defecto
INSERT INTO users (nombre, email, password, role) VALUES 
('Administrador Sistema', 'admin@inventario.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin');

-- Usuario cliente de prueba
INSERT INTO users (nombre, email, password, role) VALUES 
('Cliente Prueba', 'cliente@test.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'cliente');

-- Productos de ejemplo
INSERT INTO products (numero_lote, nombre, precio, cantidad_disponible, descripcion) VALUES
('TECH001', 'Laptop HP Pavilion 15.6"', 899.99, 15, 'Laptop HP Pavilion con procesador Intel Core i5, 8GB RAM, 256GB SSD'),
('TECH002', 'Mouse Inalámbrico Logitech', 29.99, 50, 'Mouse inalámbrico ergonómico con sensor óptico de alta precisión'),
('TECH003', 'Teclado Mecánico RGB', 79.99, 25, 'Teclado mecánico con retroiluminación RGB y switches Cherry MX'),
('TECH004', 'Monitor LED 24" Full HD', 189.99, 12, 'Monitor LED de 24 pulgadas con resolución Full HD 1920x1080'),
('TECH005', 'Auriculares Bluetooth', 59.99, 30, 'Auriculares inalámbricos con cancelación de ruido y hasta 20h de batería'),
('OFF001', 'Cuaderno Universitario A4', 4.99, 100, 'Cuaderno universitario de 100 hojas, rayado, tamaño A4'),
('OFF002', 'Bolígrafo Azul Paquete 12u', 8.50, 75, 'Paquete de 12 bolígrafos de tinta azul, punta media'),
('HOME001', 'Cafetera Express 15 Bar', 159.99, 8, 'Cafetera express con bomba de 15 bares, incluye vaporizador para leche');

-- ============================================
-- VERIFICAR INSTALACIÓN
-- ============================================

-- Mostrar tablas creadas
SHOW TABLES;

-- Mostrar estructura de tablas principales
DESCRIBE users;
DESCRIBE products;
DESCRIBE purchases;
DESCRIBE purchase_details;

-- Contar registros iniciales
SELECT 'users' as tabla, COUNT(*) as registros FROM users
UNION ALL
SELECT 'products' as tabla, COUNT(*) as registros FROM products
UNION ALL
SELECT 'purchases' as tabla, COUNT(*) as registros FROM purchases
UNION ALL
SELECT 'purchase_details' as tabla, COUNT(*) as registros FROM purchase_details;

-- ============================================
-- NOTAS DE CONFIGURACIÓN
-- ============================================

/*
NOTAS IMPORTANTES:

1. Ejecutar este script como usuario con permisos CREATE DATABASE
2. Las contraseñas en los datos iniciales están hasheadas con bcrypt
   - Contraseña por defecto: "password123"
3. Los triggers calculan automáticamente los subtotales
4. Las vistas proporcionan consultas frecuentes optimizadas
5. Los procedimientos almacenados ayudan con operaciones complejas

CREDENCIALES DE PRUEBA:
- Admin: admin@inventario.com / password123
- Cliente: cliente@test.com / password123

CONFIGURACIÓN RECOMENDADA EN .env:
DB_HOST=localhost
DB_PORT=3306
DB_NAME=inventario_db
DB_USER=tu_usuario_mysql
DB_PASSWORD=tu_password_mysql
*/