'use strict';
module.exports = (sequelize, DataTypes) => {
  const Statistics = sequelize.define('Statistics', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    user_id: DataTypes.UUID,
    views: DataTypes.INTEGER,
    channel_id: DataTypes.UUID,
    token: DataTypes.STRING
  }, {
      freezeTableName: true,
      tableName: 'statistics',
      underscored: true
  });
  Statistics.associate = function(models) {
    // associations can be defined here
    Statistics.belongsTo(models.Users, { foreignKey: 'user_id', as: 'user' });
  };
  return Statistics;
};