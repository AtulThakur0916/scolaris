'use strict';
module.exports = (sequelize, DataTypes) => {
  const Languages = sequelize.define('Languages', {
    id: {
      type: DataTypes.INTEGER,
      //defaultValue: DataTypes.UUIDV4,
      autoIncrement: true,
      primaryKey: true
    },
    insert_language: DataTypes.STRING,
    status: DataTypes.BOOLEAN,
    image: DataTypes.STRING,
    branch: DataTypes.STRING,
    website: DataTypes.BOOLEAN,
    sort_value: DataTypes.INTEGER,
    country: DataTypes.STRING
  }, {
      freezeTableName: true,
      tableName: 'languages',
      underscored: true
  });
  Languages.associate = function(models) {
    // associations can be defined here
  };
  return Languages;
};