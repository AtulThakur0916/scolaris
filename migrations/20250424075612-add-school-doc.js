'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('schools', 'school_doc', {
      type: Sequelize.STRING,
      allowNull: true, // or false based on your requirement
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('schools', 'school_doc');
  }
};
