'use strict';
const { v4: uuidv4 } = require('uuid');

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.bulkInsert('roles', [{
        id: uuidv4(),
        name: 'SuperAdmin',
        description: 'Full access'
      },
      {
        id: uuidv4(),
        name: 'Staff',
        description: 'Limited access'
      },
      {
        id: uuidv4(),
        name: 'Student',
        description: 'Limited access'
      },
      {
        id: uuidv4(),
        name: 'School',
        description: 'Limited access'
      }], {});
  },

  down: (queryInterface, Sequelize) => {
  }
};
