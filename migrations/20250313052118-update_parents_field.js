'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('parents', 'name', {
      type: Sequelize.STRING,
      allowNull: true
    });

    await queryInterface.changeColumn('parents', 'mobile', {
      type: Sequelize.STRING,
      allowNull: true,
      unique: true
    });

    await queryInterface.changeColumn('parents', 'password', {
      type: Sequelize.STRING,
      allowNull: true
    });
  },

  down: async (queryInterface, Sequelize) => {
  }
};
