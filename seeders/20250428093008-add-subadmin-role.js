'use strict';
const { v4: uuidv4 } = require('uuid');

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.bulkInsert('roles', [{
      id: uuidv4(),
      name: 'SubAdmin',
      description: 'Limited access with admin privileges'
    }], {});
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.bulkDelete('roles', {
      name: 'SubAdmin'
    }, {});
  }
};
