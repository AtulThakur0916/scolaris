'use strict';
module.exports = (sequelize, DataTypes) => {
  const Notifications = sequelize.define('Notifications', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    message: DataTypes.STRING,
    notify_type: DataTypes.STRING,
    notify_for: DataTypes.STRING,
    status: DataTypes.BOOLEAN,
    sort_value: DataTypes.INTEGER
  }, {
      freezeTableName: true,
      tableName: 'notifications',
      underscored: true
  });
  Notifications.associate = function(models) {
    // associations can be defined here
  };
  return Notifications;
};