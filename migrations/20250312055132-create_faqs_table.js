'use strict';
const { UUID, UUIDV4, TEXT, STRING, ENUM, DATE } = require('sequelize');

/**
 * Migration to create the 'faqs' table.
 * Each field is nullable by default.
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('faqs', {
      id: {
        type: UUID,
        defaultValue: UUIDV4,
        allowNull: false,
        primaryKey: true,
        comment: 'Primary key',
      },
      question: {
        type: STRING,
        allowNull: true,
        comment: 'FAQ question',
      },
      answer: {
        type: TEXT,
        allowNull: true,
        comment: 'FAQ answer',
      },
      status: {
        type: ENUM('0', '1'),
        allowNull: true,
        defaultValue: '1',
        comment: 'Status: 0 - Inactive, 1 - Active',
      },
      created_at: {
        type: DATE,
        allowNull: true,
        defaultValue: new Date(),
        comment: 'Record creation timestamp',
      },
      updated_at: {
        type: DATE,
        allowNull: true,
        defaultValue: new Date(),
        comment: 'Record last update timestamp',
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('faqs');
  }
};
