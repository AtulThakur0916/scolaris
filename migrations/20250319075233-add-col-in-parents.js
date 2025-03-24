'use strict';
const { STRING } = require('sequelize');

module.exports = {
  async up(queryInterface) {
    await queryInterface.addColumn('parents', 'fcm_token', {
      type: STRING,
      allowNull: true
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('parents', 'fcm_token');
  }
};
