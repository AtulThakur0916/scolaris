'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Explicitly drop the unique constraint/index on account_number
    await queryInterface.removeConstraint('payments', 'payments_reference_key');

    // Then change the column to just remove unique from the model definition (optional)
    await queryInterface.changeColumn('payments', 'reference', {
      type: Sequelize.STRING(50),
      allowNull: false,
      unique: false, // optional
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Recreate the unique constraint
    await queryInterface.changeColumn('payments', 'reference', {
      type: Sequelize.STRING(50),
      allowNull: false,
      unique: true
    });
  }
};
