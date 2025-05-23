'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {

    await queryInterface.addColumn('payments', 'school_id', {
      type: Sequelize.UUID,
      allowNull: true,
      after: 'id',
      references: {
        model: 'schools',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    });
    await queryInterface.addColumn('payments', 'school_sessions_id', {
      type: Sequelize.UUID,
      allowNull: true,
      after: 'id',
      references: {
        model: 'school_sessions',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    });
    await queryInterface.addColumn('payments', 'class_id', {
      type: Sequelize.UUID,
      allowNull: true,
      after: 'id',
      references: {
        model: 'classes',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('payments', 'student_fee_id');
  }
};
