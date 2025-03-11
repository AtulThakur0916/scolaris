'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('parents', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: 'Full name of the parent'
      },
      mobile: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
        comment: 'Mobile number of the parent'
      },
      password: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: 'Hashed password for authentication'
      },
      otp: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'One-time password for verification'
      },
      otp_verified: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        comment: 'Indicates whether the OTP has been verified'
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
        allowNull: false
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
        allowNull: false
      }
    });

    // Junction table for parents and schools (Many-to-Many)
    await queryInterface.createTable('parent_schools', {
      parent_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'parents',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      school_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'schools',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      }
    });

    // Junction table for parents and students (Many-to-Many)
    await queryInterface.createTable('parent_students', {
      parent_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'parents',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      student_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'students',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      }
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('parent_students');
    await queryInterface.dropTable('parent_schools');
    await queryInterface.dropTable('parents');
  }
};
