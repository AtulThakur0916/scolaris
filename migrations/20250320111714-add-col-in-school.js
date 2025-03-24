'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add school_sessions_id column
    await queryInterface.addColumn('schools', 'country', {
      type: Sequelize.STRING,
      allowNull: true
    });
    await queryInterface.addColumn('schools', 'state', {
      type: Sequelize.STRING,
      allowNull: true
    });
    await queryInterface.addColumn('schools', 'city', {
      type: Sequelize.STRING,
      allowNull: true
    });

    await queryInterface.addColumn('schools', 'address', {
      type: Sequelize.STRING,
      allowNull: true
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('city', 'country', 'address', 'state');
  }
};
