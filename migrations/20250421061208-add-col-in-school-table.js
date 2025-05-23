'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('schools', 'subscription', {
      type: Sequelize.ENUM('1', '0'),
      allowNull: true,
      defaultValue: '0'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('subscription');
  }
};
