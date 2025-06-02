'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.bulkUpdate(
      'roles',
      { name: 'School (Sub-Admin)' },
      { name: 'School' }
    );

    await queryInterface.bulkUpdate(
      'roles',
      { name: 'Administrator' },
      { name: 'SubAdmin' }
    );
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkUpdate(
      'roles',
      { name: 'School' },
      { name: 'School (Sub-Admin)' }
    );

    await queryInterface.bulkUpdate(
      'roles',
      { name: 'SubAdmin' },
      { name: 'Administrator' }
    );
  }
};
