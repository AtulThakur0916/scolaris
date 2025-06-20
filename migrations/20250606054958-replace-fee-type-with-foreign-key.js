'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Remove the old enum column `fee_type`
    await queryInterface.removeColumn('fees', 'fee_type');

    // 2. Add the new `fee_type_id` column
    await queryInterface.addColumn('fees', 'fee_type_id', {
      type: Sequelize.UUID,
      allowNull: false,
      references: {
        model: 'fees_types',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT' // You can change this to CASCADE if you want to delete fees when a fee type is deleted
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Rollback: Remove the new column
    await queryInterface.removeColumn('fees', 'fee_type_id');

    // Re-add the original enum column
    await queryInterface.addColumn('fees', 'fee_type', {
      type: Sequelize.ENUM('Tuition', 'Transport', 'Cafeteria', 'Exam', 'Boarding', 'Events', 'Other'),
      allowNull: false
    });
  }
};
