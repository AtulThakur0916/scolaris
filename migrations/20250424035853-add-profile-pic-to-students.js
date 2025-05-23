'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('students', 'profile_pic', {
      type: Sequelize.STRING,
      allowNull: true,
      comment: 'Profile picture URL or path'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('students', 'profile_pic');
  }
};
