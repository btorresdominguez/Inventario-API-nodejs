# Sistema de Inventario API

API REST desarrollada con Node.js, Express, Sequelize y MySQL para la gestión de inventario con roles de usuario (Administrador y Cliente).

## Características

- Autenticación JWT con roles de usuario
- CRUD completo de productos (solo administradores)
- Sistema de compras para clientes
- Historial de compras y facturas
- Validación de datos con Joi
- Sistema de logs con Winston
- Manejo de errores centralizado
- Documentación API con ApiDoc

## Requisitos Previos

- Node.js (versión 16 o superior)
- MySQL (versión 8.0 o superior)
- npm o yarn

## Instalación

### Instalación Rápida

```bash
# 1. Clonar repositorio
git clone <url-del-repositorio>
cd inventario-api

# 2. Instalar dependencias
npm install

# 3. Configurar base de datos
# Ejecutar el script SQL base ubicado en: database/create_database.sql

# 4. Configurar variables de entorno
cp .env.example .env

# 5. Iniciar servidor
npm run dev
```

### Configuración de Base de Datos

El proyecto incluye un script base para la creación de la base de datos y sus tablas. Ejecute el siguiente archivo SQL antes de iniciar la aplicación:

**Archivo:** `database/create_database.sql`

Este script contiene:
- Creación de la base de datos
- Definición de todas las tablas necesarias
- Configuración de relaciones y constraints
- Datos iniciales de prueba

### Usuarios de Prueba

- Administrador: `admin@inventario.com` / `password123`
- Cliente: `maria@gmail.com` / `123456`

## Documentación API

#### Iniciar Sesión

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "juan@example.com",
  "password": "123456"
}
```

#### Registro de Usuario

```http
POST /api/auth/register
Content-Type: application/json

{
  "nombre": "Juan Pérez",
  "email": "juan@example.com",
  "password": "123456",
  "role": "cliente"
}
```

Respuesta de ejemplo:

```json
{
  "success": true,
  "message": "Usuario registrado exitosamente",
  "data": {
    "id": 1,
    "nombre": "Juan Pérez",
    "email": "juan@example.com",
    "role": "cliente"
  },
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

### Productos (Solo Administradores)

#### Crear Producto

```http
POST /api/products
Content-Type: application/json
Authorization: Bearer [TOKEN]

{
  "numero_lote": "TECH001",
  "nombre": "iPhone 15 Pro",
  "precio": 1199.99,
  "cantidad_disponible": 15,
  "descripcion": "iPhone 15 Pro 256GB"
}
```

#### Obtener Productos

```http
GET /api/products
Authorization: Bearer [TOKEN]
```

#### Actualizar Producto

```http
PUT /api/products/:id
Content-Type: application/json
Authorization: Bearer [TOKEN]

{
  "nombre": "iPhone 15 Pro Max",
  "precio": 1299.99,
  "cantidad_disponible": 10
}
```

#### Eliminar Producto

```http
DELETE /api/products/:id
Authorization: Bearer [TOKEN]
```

### Compras (Clientes)

#### Realizar Compra

```http
POST /api/purchases
Content-Type: application/json
Authorization: Bearer [TOKEN]

{
  "productos": [
    {
      "product_id": 1,
      "cantidad": 1
    }
  ]
}
```

### Respuesta de Compra Exitosa

```json
{
  "success": true,
  "message": "Compra realizada exitosamente",
  "data": {
    "id": 1,
    "numero_factura": "FAC-1705756200000-001",
    "fecha_compra": "2024-01-20T15:30:00.000Z",
    "total": "1199.99",
    "estado": "completada",
    "user": {
      "nombre": "Cliente Test",
      "email": "cliente@test.com"
    },
    "details": [
      {
        "cantidad": 1,
        "precio_unitario": "1199.99",
        "subtotal": "1199.99",
        "product": {
          "nombre": "iPhone 15 Pro",
          "numero_lote": "TECH001"
        }
      }
    ]
  }
}
```

## Estructura del Proyecto

```
inventario-api/
├── src/
│   ├── app.js              # App principal
│   ├── config/
│   │   └── database.js     # Config DB
│   ├── models/             # Modelos Sequelize
│   ├── routes/             # Rutas API
│   ├── middleware/         # Middleware custom
│   └── utils/              # Utilidades
├── database/
│   └── create_database.sql # Script base de BD
├── logs/                  # Archivos de log
├── docs/                  # Documentación generada
└── package.json
```

## Scripts Disponibles

```bash
npm start              # Producción
npm run dev           # Desarrollo con nodemon
npm run docs          # Generar documentación ApiDoc
```

## Características Técnicas

### Seguridad
- Autenticación JWT con expiración
- Validación de roles y permisos
- Sanitización de datos de entrada
- Manejo seguro de contraseñas con bcrypt

### Performance
- Paginación eficiente con count
- Índices en campos críticos
- Búsqueda optimizada con LIKE

### Arquitectura
- Separación de responsabilidades clara
- Middleware reutilizable
- Manejo de transacciones para compras
- Soft delete en productos

### Base de Datos
- Relaciones definidas
- Constraints y validaciones
- Triggers para auditoría
- Transacciones ACID