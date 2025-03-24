'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add school_sessions_id column
    await queryInterface.addColumn('students', 'school_sessions_id', {
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
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('students', 'school_sessions_id');
  }
};
