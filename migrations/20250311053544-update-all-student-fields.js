'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // ✅ Step 1: Temporarily allow NULL for roll_number
    await queryInterface.changeColumn('students', 'roll_number', {
      type: Sequelize.STRING,
      allowNull: true, // Allow NULL temporarily
      unique: true
    });

    // ✅ Step 2: Populate existing NULL roll_number values with unique data
    await queryInterface.sequelize.query(`
      UPDATE students
      SET roll_number = CONCAT('RN', id)
      WHERE roll_number IS NULL;
    `);

    // ✅ Step 3: Set roll_number to NOT NULL after ensuring all rows have values
    await queryInterface.changeColumn('students', 'roll_number', {
      type: Sequelize.STRING,
      allowNull: false, // Now enforce NOT NULL
      unique: true
    });

    // ✅ Continue with the rest of the migration
    await queryInterface.changeColumn('students', 'id', {
      type: Sequelize.UUID,
      defaultValue: Sequelize.UUIDV4,
      allowNull: false,
      primaryKey: true
    });

    await queryInterface.changeColumn('students', 'name', {
      type: Sequelize.STRING,
      allowNull: true
    });

    await queryInterface.changeColumn('students', 'email', {
      type: Sequelize.STRING,
      allowNull: true,
      unique: true
    });

    await queryInterface.changeColumn('students', 'age', {
      type: Sequelize.STRING,
      allowNull: true
    });

    await queryInterface.sequelize.query(`
      ALTER TABLE students ALTER COLUMN status DROP DEFAULT;
      ALTER TABLE students ALTER COLUMN status TYPE BOOLEAN USING status::BOOLEAN;
      ALTER TABLE students ALTER COLUMN status SET DEFAULT true;
    `);

    await queryInterface.changeColumn('students', 'school_id', {
      type: Sequelize.UUID,
      allowNull: false,
      references: { model: 'schools', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    });

    await queryInterface.changeColumn('students', 'class_id', {
      type: Sequelize.UUID,
      allowNull: false,
      references: { model: 'classes', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    });

    await queryInterface.changeColumn('students', 'created_at', {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.fn('NOW')
    });

    await queryInterface.changeColumn('students', 'updated_at', {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.fn('NOW')
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('students', 'roll_number', {
      type: Sequelize.STRING,
      allowNull: true,
      unique: true
    });
  }
};
