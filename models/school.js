'use strict';
module.exports = (sequelize, DataTypes) => {
  const Schools = sequelize.define('Schools', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: DataTypes.STRING,
    location: DataTypes.TEXT,
    phone_number: DataTypes.STRING,
    email: DataTypes.STRING,
    type: DataTypes.STRING,
    logo: DataTypes.STRING
  }, {
    freezeTableName: true,
    tableName: 'schools',
    underscored: true
  });
  Schools.associate = function (models) {
    // associations can be defined here

  };
  return Schools;
};