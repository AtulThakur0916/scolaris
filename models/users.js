'use strict';
module.exports = (sequelize, DataTypes) => {
  const Users = sequelize.define('Users', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    }, school_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'schools',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    },
    name: DataTypes.STRING,
    email: { type: DataTypes.STRING, unique: true },
    password: DataTypes.STRING,
    contact_person: DataTypes.STRING,
    phone: DataTypes.STRING,
    role_id: DataTypes.UUID,
    status: DataTypes.BOOLEAN,
    reset_password_token: { type: DataTypes.STRING, unique: true },
    reset_password_expires: DataTypes.DATE,
    logo: DataTypes.STRING,
  }, {
    freezeTableName: true,
    tableName: 'users',
    underscored: true
  });
  Users.associate = function (models) {
    // associations can be defined here
    Users.belongsTo(models.Roles, { foreignKey: 'role_id', as: 'role' });
    Users.hasMany(models.Statistics, { foreignKey: 'user_id', as: 'statistics' });
  };
  return Users;
};