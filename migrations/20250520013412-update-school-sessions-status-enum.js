'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add 'Inactive' to ENUM
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'enum_school_sessions_status'
        ) THEN
          CREATE TYPE enum_school_sessions_status AS ENUM ('Active', 'Completed', 'Inactive');
        ELSE
          ALTER TYPE enum_school_sessions_status ADD VALUE IF NOT EXISTS 'Inactive';
        END IF;
      END$$;
    `);
  },

  down: async (queryInterface, Sequelize) => {
    // Remove 'Inactive' from ENUM is not directly supported in PostgreSQL.
    // Workaround: Recreate ENUM without 'Inactive'
    await queryInterface.sequelize.query(`
      DO $$
      DECLARE
        current_default TEXT;
      BEGIN
        -- Store current default if needed

        -- Rename the existing type
        ALTER TYPE enum_school_sessions_status RENAME TO enum_school_sessions_status_old;

        -- Create the new ENUM without 'Inactive'
        CREATE TYPE enum_school_sessions_status AS ENUM ('Active', 'Completed');

        -- Alter the column to use the new ENUM type
        ALTER TABLE "school_sessions"
        ALTER COLUMN "status" DROP DEFAULT,
        ALTER COLUMN "status" TYPE enum_school_sessions_status
        USING status::text::enum_school_sessions_status;

        -- Drop the old ENUM
        DROP TYPE enum_school_sessions_status_old;
      END$$;
    `);
  }
};
