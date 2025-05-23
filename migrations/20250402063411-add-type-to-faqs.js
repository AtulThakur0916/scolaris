"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return queryInterface.addColumn("faqs", "type", {
      type: Sequelize.ENUM("top", "other"),
      allowNull: false,
      defaultValue: "other",
    });
  },

  down: async (queryInterface, Sequelize) => {
    return queryInterface.removeColumn("faqs", "type");
  },
};
