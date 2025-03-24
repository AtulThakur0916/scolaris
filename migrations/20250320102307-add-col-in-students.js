"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Remove the old unique constraint if it exists
    await queryInterface.removeConstraint('students', 'students_roll_number_key');

    // Add a composite unique constraint
    await queryInterface.addConstraint('students', {
      fields: ['school_id', 'class_id', 'school_sessions_id', 'roll_number'],
      type: 'unique',
      name: 'unique_roll_number_per_class_school_session'
    });
    await queryInterface.sequelize.query(`ALTER TABLE students DROP CONSTRAINT IF EXISTS students_roll_number_key2;`);
    await queryInterface.sequelize.query(`ALTER TABLE students DROP CONSTRAINT IF EXISTS students_roll_number_key1;`);
  },

  async down(queryInterface, Sequelize) {
    // Remove the new unique constraint in case of rollback
    await queryInterface.removeConstraint('students', 'unique_roll_number_per_class_school_session');
    await queryInterface.sequelize.query(`ALTER TABLE students ADD CONSTRAINT students_roll_number_key UNIQUE (roll_number);`);
    // Add back the original unique constraint on roll_number if needed
    await queryInterface.addConstraint('students', {
      fields: ['roll_number'],
      type: 'unique',
      name: 'students_roll_number_key'
    });
  }
};
