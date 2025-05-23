'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('banking_details', 'business_name', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('banking_details', 'settlement_bank', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('banking_details', 'subaccount_code', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('banking_details', 'paystack_id', {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('banking_details', 'school_doc');
  }
};