'use strict';

module.exports = (sequelize, DataTypes) => {
  const BankingDetails = sequelize.define(
    'BankingDetails',
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        allowNull: false,
        defaultValue: DataTypes.UUIDV4,
      },
      school_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'schools',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      bank_name: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      business_name: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      settlement_bank: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      subaccount_code: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      paystack_id: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      account_number: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      account_holder: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      iban_document: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      freezeTableName: true,
      tableName: 'banking_details',
      underscored: true,
    }
  );

  // Define Associations
  BankingDetails.associate = function (models) {
    BankingDetails.belongsTo(models.Schools, {
      foreignKey: 'school_id',
      as: 'school',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    });
  };

  return BankingDetails;
};
