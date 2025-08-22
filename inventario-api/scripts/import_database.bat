#!/bin/bash

# ============================================
# Script para importar la base de datos MySQL
# Sistema de Inventario API
# ============================================

echo "🗄️  Configurando Base de Datos MySQL para Sistema de Inventario"
echo "=============================================="

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Función para mostrar errores
show_error() {
    echo -e "${RED}❌ Error: $1${NC}"
}

# Función para mostrar éxito
show_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

# Función para mostrar información
show_info() {
    echo -e "${YELLOW}ℹ️  $1${NC}"
}

# Verificar si MySQL está instalado
if ! command -v mysql &> /dev/null; then
    show_error "MySQL no está instalado o no está en el PATH"
    echo "Por favor, instala MySQL primero:"
    echo "  - Ubuntu/Debian: sudo apt install mysql-server"
    echo "  - CentOS/RHEL: sudo yum install mysql-server"
    echo "  - macOS: brew install mysql"
    echo "  - Windows: Descargar desde https://dev.mysql.com/downloads/"
    exit 1
fi

# Verificar si el archivo SQL existe
if [ ! -f "database/create_database.sql" ]; then
    show_error "Archivo database/create_database.sql no encontrado"
    echo "Asegúrate de ejecutar este script desde la raíz del proyecto"
    exit 1
fi

# Solicitar credenciales de MySQL
echo ""
show_info "Ingresa las credenciales de MySQL"
echo "=============================================="
read -p "Usuario MySQL (generalmente 'root'): " MYSQL_USER
read -s -p "Contraseña MySQL: " MYSQL_PASSWORD
echo ""

# Verificar conexión a MySQL
echo ""
show_info "Verificando conexión a MySQL..."
mysql -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" -e "SELECT 1;" &> /dev/null

if [ $? -ne 0 ]; then
    show_error "No se pudo conectar a MySQL con las credenciales proporcionadas"
    exit 1
fi

show_success "Conexión a MySQL exitosa"

# Importar la base de datos
echo ""
show_info "Importando base de datos..."
mysql -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" < database/create_database.sql

if [ $? -eq 0 ]; then
    show_success "Base de datos importada exitosamente"
else
    show_error "Error al importar la base de datos"
    exit 1
fi

# Verificar que las tablas se crearon correctamente
echo ""
show_info "Verificando instalación..."
TABLES_COUNT=$(mysql -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" -D inventario_db -se "SHOW TABLES;" 2>/dev/null | wc -l)

if [ $TABLES_COUNT -eq 4 ]; then
    show_success "Todas las tablas creadas correctamente (4/4)"
else
    show_error "Algunas tablas no se crearon correctamente ($TABLES_COUNT/4)"
fi

# Verificar datos iniciales
USERS_COUNT=$(mysql -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" -D inventario_db -se "SELECT COUNT(*) FROM users;" 2>/dev/null)
PRODUCTS_COUNT=$(mysql -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" -D inventario_db -se "SELECT COUNT(*) FROM products;" 2>/dev/null)

echo ""
show_info "Datos iniciales:"
echo "  - Usuarios: $USERS_COUNT"
echo "  - Productos: $PRODUCTS_COUNT"

# Mostrar credenciales de acceso
echo ""
echo "🔐 CREDENCIALES DE ACCESO A LA API"
echo "=============================================="
echo -e "${GREEN}Administrador:${NC}"
echo "