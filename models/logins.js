'use strict';
module.exports = (sequelize, DataTypes) => {
  const Logins = sequelize.define('Logins', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    mac_address: DataTypes.STRING,
    subscriber_id: DataTypes.UUID
  }, {
      freezeTableName: true,
      tableName: 'logins',
      underscored: true
  });
  Logins.associate = function(models) {
    // associations can be defined here
//    Logins.belongsTo(models.Users, { foreignKey: 'user_id', as: 'user' });
//    Logins.belongsTo(models.Channels, { foreignKey: 'channel_id', as: 'channels' });
  };
  return Logins;
};