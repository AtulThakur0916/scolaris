'use strict';
module.exports = (sequelize, DataTypes) => {
  const SchoolSubscriptions = sequelize.define('SchoolSubscriptions', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    school_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'pending'
    },
    payment_date: {
      type: DataTypes.DATE,
      allowNull: false
    },
    reference: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    payment_type: {
      type: DataTypes.STRING,
      allowNull: false
    },
    transaction_data: {
      type: DataTypes.JSON,
      allowNull: true
    }
  }, {
    freezeTableName: true,
    tableName: 'school_subscriptions',
    underscored: true
  });

  SchoolSubscriptions.associate = function(models) {
    SchoolSubscriptions.belongsTo(models.Schools, {
      foreignKey: 'school_id',
      as: 'school'
    });
  };

  return SchoolSubscriptions;
};