'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("students", "roll_number", {
      type: Sequelize.INTEGER,
      allowNull: true, // Allow NULL first
      unique: true
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn("students", "roll_number");
  }
};
