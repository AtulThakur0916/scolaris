'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Update the 'name' and 'address' fields to TEXT type
    await queryInterface.changeColumn('schools', 'name', {
      type: Sequelize.TEXT,
      allowNull: true, // Adjust as per your requirement
    });

    await queryInterface.changeColumn('schools', 'address', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Revert back to STRING type
    await queryInterface.changeColumn('schools', 'name', {
      type: Sequelize.STRING,
      allowNull: false, // Adjust as per your requirement
    });

    await queryInterface.changeColumn('schools', 'address', {
      type: Sequelize.STRING,
      allowNull: true,
    });
  }
};
