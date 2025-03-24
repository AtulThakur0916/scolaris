'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('notifications', 'title', {
      type: Sequelize.STRING,
      allowNull: false,
      after: 'id'
    });

    await queryInterface.addColumn('notifications', 'parent_ids', {
      type: Sequelize.JSONB, // Use JSONB for PostgreSQL, JSON for MySQL
      allowNull: true,
      defaultValue: [],
      after: 'message'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Notifications', 'title');
    await queryInterface.removeColumn('Notifications', 'parent_ids');
  }
};
