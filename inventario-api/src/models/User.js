const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const { sequelize } = require('../config/database');

/**
 * Modelo de Usuario
 * Maneja la información de usuarios del sistema
 */
const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  nombre: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'El nombre es requerido'
      },
      len: {
        args: [2, 100],
        msg: 'El nombre debe tener entre 2 y 100 caracteres'
      }
    }
  },
  email: {
    type: DataTypes.STRING(150),
    allowNull: false,
    unique: {
      msg: 'El email ya está registrado'
    },
    validate: {
      isEmail: {
        msg: 'Debe ser un email válido'
      },
      notEmpty: {
        msg: 'El email es requerido'
      }
    }
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'La contraseña es requerida'
      },
      len: {
        args: [6, 255],
        msg: 'La contraseña debe tener al menos 6 caracteres'
      }
    }
  },
  role: {
    type: DataTypes.ENUM('admin', 'cliente'),
    defaultValue: 'cliente',
    validate: {
      isIn: {
        args: [['admin', 'cliente']],
        msg: 'El rol debe ser admin o cliente'
      }
    }
  },
  activo: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'users',
  timestamps: true,
  hooks: {
    // Encriptar contraseña antes de crear usuario
    beforeCreate: async (user) => {
      if (user.password) {
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(user.password, salt);
      }
    },
    // Encriptar contraseña antes de actualizar
    beforeUpdate: async (user) => {
      if (user.changed('password')) {
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(user.password, salt);
      }
    }
  }
});

/**
 * Método para comparar contraseñas
 * @param {string} candidatePassword - Contraseña a verificar
 * @returns {boolean} - Verdadero si la contraseña coincide
 */
User.prototype.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

/**
 * Método para obtener datos públicos del usuario
 * @returns {Object} - Datos del usuario sin información sensible
 */
User.prototype.toJSON = function() {
  const values = Object.assign({}, this.get());
  delete values.password;
  return values;
};

module.exports = User;