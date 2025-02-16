'use strict';

/** @type {import('sequelize-cli').Migration} */
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

module.exports = {
  async up(queryInterface, Sequelize) {
    /**
     * Add seed commands here.
     *
     * Example:
     * await queryInterface.bulkInsert('People', [{
     *   name: 'John Doe',
     *   isBetaMember: false
     * }], {});
    */


    const adminRoleId = await queryInterface.rawSelect('roles', {
      where: { name: 'SuperAdmin' }
    }, ['id']);

    const staffRoleId = await queryInterface.rawSelect('roles', {
      where: { name: 'Staff' }
    }, ['id']);

    const hashedPassword = bcrypt.hashSync('password123', bcrypt.genSaltSync(10), null);

    return queryInterface.bulkInsert('users', [{
      id: uuidv4(),
      name: 'Admin User',
      email: 'lmsadmin@yopmail.com',
      password: hashedPassword,
      role_id: adminRoleId, // Assuming you have a role column
      created_at: new Date(),
      updated_at: new Date(),
    },
    {
      id: uuidv4(),
      name: 'Staff User',
      email: 'lmsstaff@yopmail.com',
      password: hashedPassword,
      role_id: staffRoleId, // Assuming you have a role column
      created_at: new Date(),
      updated_at: new Date(),
    }], {});

  },

  async down(queryInterface, Sequelize) {
    /**
     * Add commands to revert seed here.
     *
     * Example:
     * await queryInterface.bulkDelete('People', null, {});
     */
  }
};
