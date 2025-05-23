'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('student_fees', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false,
        primaryKey: true
      },

      student_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'students',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },

      fee_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'fees',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },

      assigned_date: {
        type: Sequelize.DATEONLY,
        allowNull: true
      },
      due_date: {
        type: Sequelize.DATEONLY,
        allowNull: true
      },
      custom_amount: {
        type: Sequelize.FLOAT,
        allowNull: true
      },

      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },

      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },

      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      }
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('student_fees');
  }
};
