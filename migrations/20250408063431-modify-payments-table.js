'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Remove fee_id
    await queryInterface.removeColumn('payments', 'fee_id');

    // Add student_fee_id
    await queryInterface.addColumn('payments', 'student_fee_id', {
      type: Sequelize.UUID,
      allowNull: true, // change to false if you want to enforce it
      references: {
        model: 'student_fees',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Remove student_fee_id
    await queryInterface.removeColumn('payments', 'student_fee_id');

    // Restore fee_id
    await queryInterface.addColumn('payments', 'fee_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'fees',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });
  }
};
