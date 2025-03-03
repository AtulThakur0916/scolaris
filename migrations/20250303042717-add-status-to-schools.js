'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return queryInterface.addColumn('schools', 'status', {
      type: Sequelize.ENUM('Approve', 'Reject', 'Pending'),
      allowNull: false,
      defaultValue: 'Pending',
      after: 'logo' // Ensures the column is added after 'logo'
    });
  },

  down: async (queryInterface, Sequelize) => {
    return queryInterface.removeColumn('schools', 'status');
  }
};
