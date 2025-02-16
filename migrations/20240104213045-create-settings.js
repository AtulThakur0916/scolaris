'use strict';
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('settings', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false,
        primaryKey: true,
        autoIncrement: false
      },
      version: {
        type: Sequelize.STRING
      },
      force_update: {
        type: Sequelize.BOOLEAN
      },
      payment_activate: {
        type: Sequelize.BOOLEAN
      },
      message: {
        type: Sequelize.TEXT
      },
      watch_api: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      sort_value: {
        type: Sequelize.INTEGER
      },
      created_at: {
        allowNull: false,
        defaultValue: new Date(),
        type: Sequelize.DATE
      },
      updated_at: {
        allowNull: false,
        defaultValue: new Date(),
        type: Sequelize.DATE
      }
    });
  },
  down: (queryInterface, Sequelize) => {
    return queryInterface.dropTable('settings');
  }
};