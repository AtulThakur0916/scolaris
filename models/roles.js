'use strict';
module.exports = (sequelize, DataTypes) => {
  const Roles = sequelize.define('Roles', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: DataTypes.STRING,
    description: DataTypes.STRING
  }, {
      freezeTableName: true,
      tableName: 'roles',
      underscored: true
  });
  Roles.associate = function(models) {
    // associations can be defined here
    Roles.hasMany(models.Users, {as: 'users', foreignKey: 'role_id' });
  };
  return Roles;
};