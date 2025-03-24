'use strict';
const { STRING } = require('sequelize');

module.exports = {
  async up(queryInterface) {
    await queryInterface.addColumn('parents', 'email', {
      type: STRING,
      allowNull: true
    });
    await queryInterface.addColumn('parents', 'country', {
      type: STRING,
      allowNull: true
    });
    await queryInterface.addColumn('parents', 'state', {
      type: STRING,
      allowNull: true
    });
    await queryInterface.addColumn('parents', 'city', {
      type: STRING,
      allowNull: true
    });
    await queryInterface.addColumn('parents', 'address', {
      type: STRING,
      allowNull: true
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('parents', 'fcm_token');
  }
};
