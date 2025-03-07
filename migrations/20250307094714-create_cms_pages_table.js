module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('cms_pages', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false,
        primaryKey: true,
        comment: 'Primary Key (UUID)'
      },
      title: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: 'CMS Page Title'
      },
      slug: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
        comment: 'URL-friendly identifier'
      },
      content: {
        type: Sequelize.TEXT,
        allowNull: false,
        comment: 'HTML Content of the Page'
      },
      status: {
        type: Sequelize.ENUM('0', '1'),
        allowNull: false,
        defaultValue: '1',
        comment: '0 = Inactive, 1 = Active'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
        comment: 'Record Creation Time'
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
        comment: 'Record Last Update Time'
      }
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('cms_pages');
  }
};
