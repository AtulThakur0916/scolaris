'use strict';

const { UUID, UUIDV4, STRING, TEXT, ENUM, DATE } = require('sequelize');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('activities', {
      id: {
        type: UUID,
        defaultValue: UUIDV4,
        primaryKey: true,
      },
      school_id: {
        type: UUID,
        allowNull: true,
        references: {
          model: 'schools',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      title: {
        type: STRING,
        allowNull: true,
      },
      description: {
        type: TEXT,
        allowNull: true,
      },
      status: {
        type: ENUM('0', '1'),
        defaultValue: '1',
        comment: '0: Inactive, 1: Active',
      },
      created_at: {
        type: DATE,
        allowNull: true,
        defaultValue: new Date(),
      },
      updated_at: {
        type: DATE,
        allowNull: true,
        defaultValue: new Date(),
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('activities');
  },
};
