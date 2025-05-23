'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Explicitly drop the unique constraint/index on account_number
    await queryInterface.removeConstraint('banking_details', 'banking_details_account_number_key');

    // Then change the column to just remove unique from the model definition (optional)
    await queryInterface.changeColumn('banking_details', 'account_number', {
      type: Sequelize.STRING(50),
      allowNull: false,
      unique: false, // optional
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Recreate the unique constraint
    await queryInterface.changeColumn('banking_details', 'account_number', {
      type: Sequelize.STRING(50),
      allowNull: false,
      unique: true
    });
  }
};
