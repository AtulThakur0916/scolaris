'use strict';
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('schools', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false,
        primaryKey: true,
        autoIncrement: false
      },
      name: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      location: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      phone_number: {
        type: Sequelize.STRING(20),
        allowNull: true, // Optional
      },
      email: {
        type: Sequelize.STRING(255),
        allowNull: true,
        validate: {
          isEmail: true, // Ensure valid email format
        },
      },
      type: {
        type: Sequelize.ENUM('Preschool', 'Primary', 'Secondary', 'High School', 'University'),
        allowNull: false,
      },
      logo: {
        type: Sequelize.STRING(255),
        allowNull: true, // Optional field
      },
      created_at: {
        defaultValue: new Date(),
        type: Sequelize.DATE
      },
      updated_at: {
        defaultValue: new Date(),
        type: Sequelize.DATE
      }
    });
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.dropTable('schools');
  }
};
