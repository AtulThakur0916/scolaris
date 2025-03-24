'use strict';
const { STRING } = require('sequelize');

/**
 * Migration to add provider and provider_id columns to the parents table.
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.addColumn('parents', 'provider', {
      type: STRING,
      allowNull: true,
      comment: 'Social media provider (e.g., google, facebook)',
    });

    await queryInterface.addColumn('parents', 'provider_id', {
      type: STRING,
      allowNull: true,
      comment: 'Unique ID from social media provider',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('parents', 'provider');
    await queryInterface.removeColumn('parents', 'provider_id');
  }
};
