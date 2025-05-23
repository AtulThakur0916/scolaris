'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Remove the unique constraint from account_number
    await queryInterface.changeColumn('banking_details', 'account_number', {
      type: Sequelize.STRING(50),
      allowNull: false,
      unique: false // this line is optional; default is no unique
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Revert: Add the unique constraint back
    await queryInterface.changeColumn('banking_details', 'account_number', {
      type: Sequelize.STRING(50),
      allowNull: false,
      unique: true
    });
  }
};
