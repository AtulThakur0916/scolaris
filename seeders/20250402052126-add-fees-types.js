'use strict';

const { v4: uuidv4 } = require('uuid'); // Import UUID package

module.exports = {
  up: async (queryInterface, Sequelize) => { // ✅ Marked as async
    await queryInterface.bulkInsert('fees_types', [
      {
        id: uuidv4(), // ✅ Generates a valid UUID
        name: 'Tuition',
        description: 'Fees for academic tuition',
        status: 'Active',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: uuidv4(),
        name: 'Transport',
        description: 'Fees for school transportation',
        status: 'Active',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: uuidv4(),
        name: 'Cafeteria',
        description: 'Fees for school meals and cafeteria services',
        status: 'Active',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: uuidv4(),
        name: 'Exam',
        description: 'Fees for exam-related expenses',
        status: 'Active',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: uuidv4(),
        name: 'Boarding',
        description: 'Fees for boarding facilities',
        status: 'Active',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: uuidv4(),
        name: 'Events',
        description: 'Fees for school events and activities',
        status: 'Active',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: uuidv4(),
        name: 'Other',
        description: 'Miscellaneous fees',
        status: 'Active',
        created_at: new Date(),
        updated_at: new Date()
      }
    ]);
  },

  down: async (queryInterface, Sequelize) => { // ✅ Marked as async
    await queryInterface.bulkDelete('fees_types', null, {});
  }
};
