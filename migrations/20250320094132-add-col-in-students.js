'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add school_sessions_id column
    await queryInterface.addColumn('students', 'country', {
      type: Sequelize.STRING,
      allowNull: true
    });
    await queryInterface.addColumn('students', 'state', {
      type: Sequelize.STRING,
      allowNull: true
    });
    await queryInterface.addColumn('students', 'city', {
      type: Sequelize.STRING,
      allowNull: true
    });

    await queryInterface.addColumn('students', 'address', {
      type: Sequelize.STRING,
      allowNull: true
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('city', 'country', 'address', 'state');
  }
};
