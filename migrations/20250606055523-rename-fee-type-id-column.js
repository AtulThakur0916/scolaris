'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.renameColumn('fees', 'fee_type_id', 'fees_type_id');
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.renameColumn('fees', 'fees_type_id', 'fee_type_id');
  }
};
