'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("parent_students", "relations", {
      type: Sequelize.STRING,
      allowNull: true,
    }, {
      after: "student_id"
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn("parent_students", "relations");
  }
};

