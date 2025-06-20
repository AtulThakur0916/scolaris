'use strict';
module.exports = (sequelize, DataTypes) => {
  const Schools = sequelize.define('Schools', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    status: {
      type: DataTypes.ENUM('Pending', 'Approve', 'Reject'),
      allowNull: false,
      defaultValue: 'Pending'
    },
    subscription: {
      type: DataTypes.ENUM('1', '0'),
      allowNull: true,
      defaultValue: '0'
    },
    name: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    city: {
      type: DataTypes.STRING,
      allowNull: true
    },
    country: {
      type: DataTypes.STRING,
      allowNull: true
    },
    state: {
      type: DataTypes.STRING,
      allowNull: true
    },
    school_doc: {
      type: DataTypes.STRING,
      allowNull: true
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: true
    },
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
    Schools.hasMany(models.Classes, { foreignKey: 'school_id', as: 'classes' });
    Schools.hasMany(models.Students, { foreignKey: 'school_id', as: 'students' });
    Schools.hasMany(models.SchoolSessions, { foreignKey: 'school_id', as: 'sessions' });
    Schools.hasMany(models.Activity, { foreignKey: 'school_id', as: 'activities' });
    Schools.hasMany(models.BankingDetails, { foreignKey: 'school_id', as: 'BankingDetails' });

    Schools.belongsToMany(models.Parents, {
      through: 'ParentSchools',
      foreignKey: 'school_id',
      otherKey: 'parent_id',
      as: 'parents'
    });
  };

  return Schools;
};
