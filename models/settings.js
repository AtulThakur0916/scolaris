'use strict';
module.exports = (sequelize, DataTypes) => {
  const Settings = sequelize.define('Settings', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    version: DataTypes.STRING,
    force_update: DataTypes.BOOLEAN,
    payment_activate: DataTypes.BOOLEAN,
    message: DataTypes.TEXT,
    sort_value: DataTypes.INTEGER,
    watch_api: DataTypes.BOOLEAN
  }, {
      freezeTableName: true,
      tableName: 'settings',
      underscored: true
  });
  Settings.associate = function(models) {
    // associations can be defined here
  };
  return Settings;
};