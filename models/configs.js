'use strict';
module.exports = (sequelize, DataTypes) => {
  const Configs = sequelize.define('Configs', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    key: DataTypes.STRING,
    config_type: DataTypes.STRING,
    value: DataTypes.STRING,
    other: DataTypes.STRING,
    status: DataTypes.BOOLEAN
  }, {
      freezeTableName: true,
      tableName: 'configs',
      underscored: true
  });
  Configs.associate = function(models) {
    // associations can be defined here
  };
  return Configs;
};