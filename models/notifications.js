'use strict';
module.exports = (sequelize, DataTypes) => {
  const Notifications = sequelize.define('Notifications', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false
    },
    message: {
      type: DataTypes.STRING,
      allowNull: false
    },
    notify_type: {
      type: DataTypes.STRING,
      allowNull: false
    },
    notify_for: {
      type: DataTypes.STRING,
      allowNull: false
    },
    parent_ids: {
      type: DataTypes.JSONB,
      defaultValue: []
    },
    status: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    sort_value: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    }
  }, {
    freezeTableName: true,
    tableName: 'notifications',
    underscored: true
  });

  Notifications.associate = function (models) {
    // Example association (if needed)
    // Notifications.belongsTo(models.Parents, { foreignKey: 'parent_id' });
  };

  return Notifications;
};
